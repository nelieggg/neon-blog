const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, requireAuth, isAdmin, isSuperAdmin } = require('../middleware/auth');

const router = express.Router();

function getUserByUsername(db, username) {
  const rows = db.exec('SELECT * FROM users WHERE username = ?', [username]);
  if (!rows.length || !rows[0].values.length) return null;
  const user = {};
  rows[0].columns.forEach((c, i) => { user[c] = rows[0].values[0][i]; });
  return user;
}

// 注册限流：IP -> {count, time}
const registerRateLimit = new Map();

router.post('/register', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { username, password, password2, email, role, inviteCode, verifyCode } = req.body;

    // 验证必填字段
    if (!username || !password || !email) {
      return res.status(400).json({ error: '用户名、密码、邮箱为必填项' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: '用户名至少3个字符' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6个字符' });
    }
    if (password.length > 72) {
      return res.status(400).json({ error: '密码不能超过72个字符' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // 校验密码确认
    if (!password2 || password !== password2) {
      return res.status(400).json({ error: '两次密码输入不一致' });
    }

    // 密码强度检查
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const strongEnough = [hasUpper, hasLower, hasDigit].filter(Boolean).length >= 2;
    if (!strongEnough) {
      return res.status(400).json({ error: '密码需包含大写字母、小写字母、数字中的至少两种' });
    }

    // 检查用户名是否已存在
    const existing = getUserByUsername(db, username);
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 检查邮箱是否已被注册
    const emailCheck = db.exec('SELECT id FROM users WHERE email = ?', [email]);
    if (emailCheck.length && emailCheck[0].values.length) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    // 验证邮箱验证码
    const verifyMod = require('./verify');
    const vcodeStore = verifyMod.codeStore;
    if (!vcodeStore) {
      return res.status(400).json({ error: '验证码服务未就绪' });
    }
    if (!verifyCode) {
      return res.status(400).json({ error: '请输入邮箱验证码' });
    }
    const stored = vcodeStore.get(email);
    if (!stored) {
      return res.status(400).json({ error: '请先获取邮箱验证码' });
    }
    if (Date.now() - stored.time > 300000) {
      vcodeStore.delete(email);
      return res.status(400).json({ error: '验证码已过期，请重新获取' });
    }
    if (stored.code !== verifyCode.trim()) {
      return res.status(400).json({ error: '验证码错误' });
    }
    vcodeStore.delete(email);

    // 注册限流：同IP每分钟最多3次
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const limit = registerRateLimit.get(ip);
    if (limit && Date.now() - limit.time < 60000 && limit.count >= 3) {
      return res.status(429).json({ error: '注册过于频繁，请稍后再试' });
    }
    if (!limit || Date.now() - limit.time >= 60000) {
      registerRateLimit.set(ip, { count: 1, time: Date.now() });
    } else {
      limit.count++;
    }

    // 确定角色
    let userRole = 'user';
    if (role === 'vip') {
      if (!inviteCode || !inviteCode.trim()) {
        return res.status(400).json({ error: '注册VIP需要邀请码' });
      }
      const codeRow = db.exec('SELECT * FROM invite_codes WHERE code = ? AND is_used = 0', [inviteCode.trim().toUpperCase()]);
      if (!codeRow.length || !codeRow[0].values.length) {
        return res.status(400).json({ error: '邀请码无效或已被使用' });
      }
      userRole = 'vip';
    }

    const salt = bcrypt.genSaltSync(10);
    const hashed = bcrypt.hashSync(password, salt);
    db.run('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)', [username, hashed, email, userRole]);

    if (userRole === 'vip') {
      const userId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run('UPDATE invite_codes SET is_used = 1, used_by = ?, used_at = datetime(\'now\') WHERE code = ?', [userId, inviteCode.trim().toUpperCase()]);
    }

    const { saveDb } = require('../db/database');
    saveDb();

    const userId = db.exec('SELECT last_insert_rowid()');
    const id = userId[0] ? userId[0].values[0][0] : 0;
    const token = jwt.sign({ id, username, email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { username, email, role: userRole, id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Superadmin creates admin
router.post('/create-admin', requireAuth, (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: '仅超级管理员可创建二级管理员' });
    }
    const db = req.app.locals.db;
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 3) return res.status(400).json({ error: '用户名至少3个字符' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });

    const existing = getUserByUsername(db, username);
    if (existing) return res.status(400).json({ error: '用户名已存在' });

    const salt = bcrypt.genSaltSync(10);
    const hashed = bcrypt.hashSync(password, salt);
    db.run('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)', [username, hashed, email || '', 'admin']);
    const { saveDb } = require('../db/database');
    saveDb();
    res.status(201).json({ success: true, message: `管理员 ${username} 创建成功` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const user = getUserByUsername(db, username);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { username: user.username, email: user.email, role: user.role, id: user.id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireAuth, (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = getUserByUsername(db, req.user.username);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', requireAuth, (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: '权限不足' });
    const db = req.app.locals.db;
    const rows = db.exec('SELECT id, username, email, role, created_at FROM users ORDER BY id');
    const users = rows.length ? rows[0].values.map(r => ({ id: r[0], username: r[1], email: r[2], role: r[3], created_at: r[4] })) : [];
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Forgot / Reset Password ============

// Step 1: send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: '请输入邮箱' });

    const userRow = db.exec('SELECT id, username FROM users WHERE email = ?', [email]);
    if (!userRow.length || !userRow[0].values.length) {
      return res.status(200).json({ message: '如果该邮箱已注册，重置链接已发送' });
    }

    const userId = userRow[0].values[0][0];
    const username = userRow[0].values[0][1];

    // 生成15分钟有效的重置 token
    const resetToken = jwt.sign({ id: userId, email, purpose: 'reset' }, JWT_SECRET, { expiresIn: '15m' });

    // 尝试发送邮件
    try {
      const nodemailer = require('nodemailer');
      const { SMTP_CONFIG } = require('./verify');
      const transporter = nodemailer.createTransport({
        host: SMTP_CONFIG.host, port: SMTP_CONFIG.port, secure: SMTP_CONFIG.secure, auth: SMTP_CONFIG.auth
      });
      const resetLink = `http://localhost:3000/#reset-password/${resetToken}`;
      await transporter.sendMail({
        from: SMTP_CONFIG.from,
        to: email,
        subject: 'NEON_BLOG // 密码重置 PASSWORD_RESET',
        html: `<div style="background:#0a0a0f;color:#e0e0e0;padding:30px;font-family:Consolas,monospace;border:1px solid #ff00ff;border-radius:6px;">
          <h2 style="color:#ff00ff;text-shadow:0 0 8px rgba(255,0,255,0.4);">// PASSWORD_RESET</h2>
          <p>用户 <span style="color:#00ffff;">${username}</span>，你正在重置密码。</p>
          <p>点击下方链接重置（15分钟内有效）：</p>
          <a href="${resetLink}" style="display:inline-block;margin:16px 0;padding:10px 24px;border:1px solid #ff00ff;border-radius:4px;color:#ff00ff;text-decoration:none;">重置密码</a>
          <p style="color:#555577;font-size:12px;">如非本人操作请忽略此邮件</p>
        </div>`,
      });
    } catch (mailErr) {
      console.log('[FORGOT] 邮件发送失败，重置 Token:', resetToken);
      console.log('[FORGOT] 重置链接: http://localhost:3000/#reset-password/' + resetToken);
    }

    res.json({ message: '如果该邮箱已注册，重置链接已发送' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2: reset password with token
router.post('/reset-password', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { token, password, password2 } = req.body;

    if (!token) return res.status(400).json({ error: '缺少重置令牌' });
    if (!password || !password2) return res.status(400).json({ error: '请输入新密码' });
    if (password !== password2) return res.status(400).json({ error: '两次密码不一致' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });
    if (password.length > 72) return res.status(400).json({ error: '密码不能超过72个字符' });

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    if ([hasUpper, hasLower, hasDigit].filter(Boolean).length < 2) {
      return res.status(400).json({ error: '密码需包含大写字母、小写字母、数字中的至少两种' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(400).json({ error: '重置链接已过期，请重新申请' });
    }

    if (decoded.purpose !== 'reset') {
      return res.status(400).json({ error: '无效的重置令牌' });
    }

    const user = db.exec('SELECT id FROM users WHERE id = ? AND email = ?', [decoded.id, decoded.email]);
    if (!user.length || !user[0].values.length) {
      return res.status(400).json({ error: '用户不存在' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashed = bcrypt.hashSync(password, salt);
    db.run('UPDATE users SET password = ?, updated_at = datetime(\'now\') WHERE id = ?', [hashed, decoded.id]);
    const { saveDb } = require('../db/database');
    saveDb();

    res.json({ message: '密码重置成功，请重新登录' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Change Password (logged in) ============

router.post('/change-password', requireAuth, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { oldPassword, newPassword, newPassword2 } = req.body;

    if (!oldPassword || !newPassword) return res.status(400).json({ error: '请输入旧密码和新密码' });
    if (newPassword !== newPassword2) return res.status(400).json({ error: '两次新密码不一致' });
    if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少6个字符' });
    if (newPassword.length > 72) return res.status(400).json({ error: '新密码不能超过72个字符' });

    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasDigit = /\d/.test(newPassword);
    if ([hasUpper, hasLower, hasDigit].filter(Boolean).length < 2) {
      return res.status(400).json({ error: '新密码需包含大写字母、小写字母、数字中的至少两种' });
    }

    const user = getUserByUsername(db, req.user.username);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const valid = bcrypt.compareSync(oldPassword, user.password);
    if (!valid) return res.status(400).json({ error: '旧密码错误' });

    const salt = bcrypt.genSaltSync(10);
    const hashed = bcrypt.hashSync(newPassword, salt);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
    const { saveDb } = require('../db/database');
    saveDb();

    res.json({ message: '密码修改成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Update Profile ============

router.put('/profile', requireAuth, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { email } = req.body;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    if (email) {
      const existing = db.exec('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
      if (existing.length && existing[0].values.length) {
        return res.status(400).json({ error: '该邮箱已被其他用户使用' });
      }
    }

    db.run('UPDATE users SET email = ? WHERE id = ?', [email || null, req.user.id]);
    const { saveDb } = require('../db/database');
    saveDb();

    const user = getUserByUsername(db, req.user.username);
    res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
