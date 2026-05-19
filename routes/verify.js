const nodemailer = require('nodemailer');
const express = require('express');
const router = express.Router();

// ============ SMTP 配置 - 改成你自己的 ============
const SMTP_CONFIG = {
  host: 'smtp.qq.com',
  port: 465,
  secure: true,
  auth: {
    user: '',   // ← 填你的 QQ 邮箱
    pass: '',          // ← 填 QQ 邮箱 SMTP 授权码
  },
  from: 'NEON_BLOG <>', // ← 填你的 QQ 邮箱
};
// ================================================

let transporter = null;
try {
  transporter = nodemailer.createTransport(SMTP_CONFIG);
} catch (e) {
  console.log('[VERIFY] SMTP 配置无效，验证码会打印到终端');
}

// 验证码存储：email -> {code, time}
const codeStore = new Map();

// 清理过期验证码
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of codeStore) {
    if (now - val.time > 300000) codeStore.delete(key);
  }
}, 60000);

// 发送验证码
router.post('/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: '邮箱不能为空' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }

  const existing = codeStore.get(email);
  if (existing && Date.now() - existing.time < 60000) {
    return res.status(429).json({ error: '请60秒后再发送' });
  }

  // 6位数字验证码
  const code = String(Math.floor(Math.random() * 900000 + 100000));
  codeStore.set(email, { code, time: Date.now() });

  if (transporter) {
    try {
      await transporter.sendMail({
        from: SMTP_CONFIG.from,
        to: email,
        subject: 'NEON_BLOG // 验证码 VERIFICATION_CODE',
        html: `<div style="background:#0a0a0f;color:#e0e0e0;padding:30px;font-family:Consolas,monospace;border:1px solid #00ffff;border-radius:6px;">
          <h2 style="color:#00ffff;text-shadow:0 0 8px rgba(0,255,255,0.4);">// VERIFICATION_CODE</h2>
          <p style="font-size:28px;letter-spacing:8px;color:#00ff41;font-weight:bold;margin:16px 0;">${code}</p>
          <p style="color:#8888aa;font-size:13px;">有效时间: 5分钟 | 如非本人操作请忽略</p>
          <hr style="border-color:rgba(0,255,255,0.15);margin:20px 0;">
          <p style="color:#555577;font-size:11px;">NEON_BLOG // 赛博空间</p>
        </div>`,
      });
    } catch (err) {
      console.log('[VERIFY] 邮件发送失败:', err.message);
      console.log('[VERIFY] 验证码:', code, '  邮箱:', email);
    }
  } else {
    console.log('\n============================================');
    console.log('  验证码 (终端模式):', code, '  邮箱:', email);
    console.log('============================================\n');
  }

  res.json({ message: '验证码已发送，5分钟内有效' });
});

// 验证验证码
router.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: '邮箱和验证码不能为空' });

  const stored = codeStore.get(email);
  if (!stored) return res.status(400).json({ error: '请先发送验证码' });
  if (Date.now() - stored.time > 300000) {
    codeStore.delete(email);
    return res.status(400).json({ error: '验证码已过期' });
  }
  if (stored.code !== code.trim()) {
    return res.status(400).json({ error: '验证码错误' });
  }

  codeStore.delete(email);
  res.json({ verified: true });
});

module.exports = router;
module.exports.codeStore = codeStore;
module.exports.SMTP_CONFIG = SMTP_CONFIG;
