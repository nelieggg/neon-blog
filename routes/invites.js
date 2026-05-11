const express = require('express');
const { requireAuth, isAdmin } = require('../middleware/auth');
const router = express.Router();

// Generate a random invite code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// List all invite codes
router.get('/', requireAuth, (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: '权限不足' });
    const db = req.app.locals.db;
    const rows = db.exec(`
      SELECT i.*, u.username as used_by_name, c.username as created_by_name
      FROM invite_codes i
      LEFT JOIN users u ON i.used_by = u.id
      LEFT JOIN users c ON i.created_by = c.id
      ORDER BY i.id DESC
    `);
    if (!rows.length || !rows[0].values.length) return res.json([]);
    const codes = rows[0].values.map(r => {
      const cols = rows[0].columns;
      const obj = {};
      cols.forEach((c, i) => { obj[c] = r[i]; });
      return obj;
    });
    res.json(codes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate new invite codes
router.post('/', requireAuth, (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: '权限不足' });
    const db = req.app.locals.db;
    const { count, prefix } = req.body;
    const n = Math.min(count || 1, 20);

    const codes = [];
    const stmt = db.prepare('INSERT INTO invite_codes (code, created_by) VALUES (?, ?)');
    for (let i = 0; i < n; i++) {
      const code = prefix ? `${prefix}-${generateCode().slice(0, 6)}` : generateCode();
      stmt.bind([code, req.user.id]);
      stmt.step();
      stmt.reset();
      codes.push(code);
    }
    stmt.free();

    const { saveDb } = require('../db/database');
    saveDb();
    res.status(201).json({ codes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an invite code
router.delete('/:id', requireAuth, (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: '权限不足' });
    const db = req.app.locals.db;
    db.run('DELETE FROM invite_codes WHERE id = ?', [req.params.id]);
    const { saveDb } = require('../db/database');
    saveDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
