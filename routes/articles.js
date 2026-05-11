const express = require('express');
const { requireAuth, isAdmin } = require('../middleware/auth');
const router = express.Router();

function canSeeVIP(user) {
  return user && (user.role === 'vip' || user.role === 'admin' || user.role === 'superadmin');
}

function getArticleWithTags(db, id) {
  const rows = db.exec('SELECT * FROM articles WHERE id = ?', [id]);
  if (!rows.length || !rows[0].values.length) return null;
  const article = {};
  const cols = rows[0].columns;
  rows[0].values[0].forEach((v, i) => { article[cols[i]] = v; });
  const tagRows = db.exec(`SELECT t.name FROM tags t
    JOIN article_tags at2 ON t.id = at2.tag_id
    WHERE at2.article_id = ?`, [id]);
  article.tags = tagRows.length ? tagRows[0].values.map(r => r[0]) : [];
  return article;
}

function getAllArticles(db, tag, user) {
  let sql = 'SELECT a.* FROM articles a WHERE a.status = \'approved\'';
  const params = [];

  if (!canSeeVIP(user)) {
    sql += " AND a.visibility = 'public'";
  }

  if (tag && tag !== '全部') {
    sql += ` AND a.id IN (SELECT at2.article_id FROM article_tags at2 JOIN tags t ON at2.tag_id = t.id WHERE t.name = ?)`;
    params.push(tag);
  }

  sql += ' ORDER BY a.id DESC';

  const rows = db.exec(sql, params);
  if (!rows.length || !rows[0].values.length) return [];
  const articles = [];
  const cols = rows[0].columns;
  rows[0].values.forEach(row => {
    const article = {};
    cols.forEach((c, i) => { article[c] = row[i]; });
    article.tags = [];
    articles.push(article);
  });
  articles.forEach(a => {
    const tagRows = db.exec(`SELECT t.name FROM tags t
      JOIN article_tags at2 ON t.id = at2.tag_id
      WHERE at2.article_id = ?`, [a.id]);
    a.tags = tagRows.length ? tagRows[0].values.map(r => r[0]) : [];
  });
  return articles;
}

// Get pending articles for review (admin only)
function getPendingArticles(db) {
  const rows = db.exec('SELECT a.* FROM articles a WHERE a.status = \'pending\' ORDER BY a.created_at DESC');
  if (!rows.length || !rows[0].values.length) return [];
  const articles = [];
  const cols = rows[0].columns;
  rows[0].values.forEach(row => {
    const article = {};
    cols.forEach((c, i) => { article[c] = row[i]; });
    article.tags = [];
    articles.push(article);
  });
  articles.forEach(a => {
    const tagRows = db.exec(`SELECT t.name FROM tags t
      JOIN article_tags at2 ON t.id = at2.tag_id
      WHERE at2.article_id = ?`, [a.id]);
    a.tags = tagRows.length ? tagRows[0].values.map(r => r[0]) : [];
  });
  return articles;
}

function saveArticleTags(db, articleId, tags) {
  db.run('DELETE FROM article_tags WHERE article_id = ?', [articleId]);
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const insertMap = db.prepare('INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)');
  (tags || []).forEach(tagName => {
    insertTag.bind([tagName]);
    insertTag.step();
    insertTag.reset();
    const tagRow = db.exec('SELECT id FROM tags WHERE name = ?', [tagName])[0];
    if (tagRow) {
      insertMap.bind([articleId, tagRow.values[0][0]]);
      insertMap.step();
      insertMap.reset();
    }
  });
  insertTag.free();
  insertMap.free();
}

// ============ Public Routes ============

router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { tag } = req.query;
    const articles = getAllArticles(db, tag, req.user);
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const article = getArticleWithTags(db, req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    if (article.visibility === 'vip' && !canSeeVIP(req.user)) {
      return res.status(403).json({ error: '该文章仅VIP用户可查看', vipOnly: true });
    }
    if (article.status !== 'approved' && !isAdmin(req.user)) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { title, excerpt, content, date, read_time, icon, tags, visibility } = req.body;
    if (!title || !excerpt || !content) {
      return res.status(400).json({ error: 'title, excerpt, content are required' });
    }
    // Admin can directly approve; others go to pending
    const status = isAdmin(req.user) ? 'approved' : 'pending';
    db.run(
      'INSERT INTO articles (title, excerpt, content, date, read_time, icon, visibility, status, author_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, excerpt, content, date || new Date().toISOString().slice(0, 10), read_time || '5 min', icon || '⬡', visibility || 'public', status, req.user?.id || null]
    );
    const idRow = db.exec('SELECT last_insert_rowid()')[0];
    const articleId = idRow.values[0][0];
    saveArticleTags(db, articleId, tags);
    const { saveDb } = require('../db/database');
    saveDb();
    res.status(201).json(getArticleWithTags(db, articleId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = req.params.id;
    const existing = getArticleWithTags(db, id);
    if (!existing) return res.status(404).json({ error: 'Article not found' });

    const { title, excerpt, content, date, read_time, icon, tags, visibility } = req.body;
    db.run(
      `UPDATE articles SET title=?, excerpt=?, content=?, date=?, read_time=?, icon=?, visibility=?, updated_at=datetime('now')
       WHERE id=?`,
      [title || existing.title, excerpt || existing.excerpt, content || existing.content,
       date || existing.date, read_time || existing.read_time, icon || existing.icon, visibility || existing.visibility, id]
    );
    if (tags) saveArticleTags(db, id, tags);
    const { saveDb } = require('../db/database');
    saveDb();
    res.json(getArticleWithTags(db, id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = req.params.id;
    const existing = getArticleWithTags(db, id);
    if (!existing) return res.status(404).json({ error: 'Article not found' });
    db.run('DELETE FROM article_tags WHERE article_id = ?', [id]);
    db.run('DELETE FROM articles WHERE id = ?', [id]);
    const { saveDb } = require('../db/database');
    saveDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Admin Review Routes ============

// Get pending articles
router.get('/review/pending', requireAuth, (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: '权限不足' });
    const db = req.app.locals.db;
    const articles = getPendingArticles(db);
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve an article
router.post('/review/:id/approve', requireAuth, (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: '权限不足' });
    const db = req.app.locals.db;
    const existing = getArticleWithTags(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Article not found' });
    db.run('UPDATE articles SET status = \'approved\', updated_at = datetime(\'now\') WHERE id = ?', [req.params.id]);
    const { saveDb } = require('../db/database');
    saveDb();
    res.json(getArticleWithTags(db, req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject an article (delete it)
router.post('/review/:id/reject', requireAuth, (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: '权限不足' });
    const db = req.app.locals.db;
    const existing = getArticleWithTags(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Article not found' });
    db.run('DELETE FROM article_tags WHERE article_id = ?', [req.params.id]);
    db.run('DELETE FROM articles WHERE id = ?', [req.params.id]);
    const { saveDb } = require('../db/database');
    saveDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
