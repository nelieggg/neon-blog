const express = require('express');
const router = express.Router();

function projectRowToObj(row, cols) {
  const obj = {};
  cols.forEach((c, i) => {
    if (c === 'tech') {
      try { obj[c] = JSON.parse(row[i]); } catch { obj[c] = []; }
    } else {
      obj[c] = row[i];
    }
  });
  return obj;
}

router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const rows = db.exec('SELECT * FROM projects ORDER BY id DESC');
    if (!rows.length || !rows[0].values.length) return res.json([]);
    const projects = rows[0].values.map(row => projectRowToObj(row, rows[0].columns));
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const rows = db.exec('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Project not found' });
    res.json(projectRowToObj(rows[0].values[0], rows[0].columns));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, description, tech, icon, link } = req.body;
    if (!name || !description) {
      return res.status(400).json({ error: 'name and description are required' });
    }
    const techJson = JSON.stringify(tech || []);
    db.run(
      'INSERT INTO projects (name, description, tech, icon, link) VALUES (?, ?, ?, ?, ?)',
      [name, description, techJson, icon || '⬡', link || '#']
    );
    const idRow = db.exec('SELECT last_insert_rowid()')[0];
    const projectId = idRow.values[0][0];
    const { saveDb } = require('../db/database');
    saveDb();
    const rows = db.exec('SELECT * FROM projects WHERE id = ?', [projectId]);
    res.status(201).json(projectRowToObj(rows[0].values[0], rows[0].columns));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = req.params.id;
    const rows = db.exec('SELECT * FROM projects WHERE id = ?', [id]);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Project not found' });
    const existing = projectRowToObj(rows[0].values[0], rows[0].columns);

    const { name, description, tech, icon, link } = req.body;
    const techJson = tech ? JSON.stringify(tech) : JSON.stringify(existing.tech || []);
    db.run(
      'UPDATE projects SET name=?, description=?, tech=?, icon=?, link=? WHERE id=?',
      [name || existing.name, description || existing.description, techJson,
       icon || existing.icon, link || existing.link, id]
    );
    const { saveDb } = require('../db/database');
    saveDb();
    const updated = db.exec('SELECT * FROM projects WHERE id = ?', [id]);
    res.json(projectRowToObj(updated[0].values[0], updated[0].columns));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = req.params.id;
    const rows = db.exec('SELECT * FROM projects WHERE id = ?', [id]);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Project not found' });
    db.run('DELETE FROM projects WHERE id = ?', [id]);
    const { saveDb } = require('../db/database');
    saveDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
