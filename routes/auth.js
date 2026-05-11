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

router.post('/register', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { username, password, role, inviteCode } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: '用户名至少3个字符' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6个字符' });
    }

    const existing = getUserByUsername(db, username);
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // Determine target role
    let userRole = 'user';
    if (role === 'vip') {
      // VIP requires invite code
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
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashed, userRole]);

    // Mark invite code as used
    if (userRole === 'vip') {
      const userId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      db.run('UPDATE invite_codes SET is_used = 1, used_by = ?, used_at = datetime(\'now\') WHERE code = ?', [userId, inviteCode.trim().toUpperCase()]);
    }

    const { saveDb } = require('../db/database');
    saveDb();

    const userId = db.exec('SELECT last_insert_rowid()');
    const id = userId[0] ? userId[0].values[0][0] : 0;
    const token = jwt.sign({ id, username, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { username, role: userRole } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Superadmin creates a new admin account
router.post('/create-admin', requireAuth, (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: '仅超级管理员可创建二级管理员' });
    }
    const db = req.app.locals.db;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 3) return res.status(400).json({ error: '用户名至少3个字符' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });

    const existing = getUserByUsername(db, username);
    if (existing) return res.status(400).json({ error: '用户名已存在' });

    const salt = bcrypt.genSaltSync(10);
    const hashed = bcrypt.hashSync(password, salt);
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashed, 'admin']);
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

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireAuth, (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = getUserByUsername(db, req.user.username);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users (admin only)
router.get('/users', requireAuth, (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: '权限不足' });
    const db = req.app.locals.db;
    const rows = db.exec('SELECT id, username, role, created_at FROM users ORDER BY id');
    const users = rows.length ? rows[0].values.map(r => ({ id: r[0], username: r[1], role: r[2], created_at: r[3] })) : [];
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
