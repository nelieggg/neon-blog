const express = require('express');
const { requireAuth, isAdmin, isSuperAdmin } = require('../middleware/auth');
const marked_js = require('marked');
const router = express.Router();

// Markdown parser setup
marked_js.marked.setOptions({ breaks: true, gfm: true });

function canSeeVIP(user) {
  return user && (user.role === 'vip' || user.role === 'admin' || user.role === 'superadmin');
}

function getArticleWithTags(db, id) {
  const rows = db.exec('SELECT * FROM articles WHERE id = ?', [id]);
  if (!rows.length || !rows[0].values.length) return null;
  const article = {};
  const cols = rows[0].columns;
  rows[0].values[0].forEach((v, i) => { article[cols[i]] = v; });
  const tagRows = db.exec('SELECT t.name FROM tags t JOIN article_tags at2 ON t.id = at2.tag_id WHERE at2.article_id = ?', [id]);
  article.tags = tagRows.length ? tagRows[0].values.map(r => r[0]) : [];
  return article;
}

function attachTags(db, articles) {
  articles.forEach(a => {
    const rows = db.exec('SELECT t.name FROM tags t JOIN article_tags at2 ON t.id = at2.tag_id WHERE at2.article_id = ?', [a.id]);
    a.tags = rows.length ? rows[0].values.map(r => r[0]) : [];
  });
}

function getAllArticles(db, tag, user, page, limit) {
  let sql = "SELECT a.* FROM articles a WHERE a.status = 'approved'";
  const params = [];
  if (!canSeeVIP(user)) sql += " AND a.visibility = 'public'";
  if (tag && tag !== '全部') {
    sql += " AND a.id IN (SELECT at2.article_id FROM article_tags at2 JOIN tags t ON at2.tag_id = t.id WHERE t.name = ?)";
    params.push(tag);
  }

  // Get total count first
  const countRows = db.exec(`SELECT COUNT(*) as cnt FROM (${sql})`, params);
  const total = countRows.length && countRows[0].values.length ? countRows[0].values[0][0] : 0;

  const p = Math.max(1, page || 1);
  const l = Math.min(50, Math.max(1, limit || 9));
  const offset = (p - 1) * l;
  sql += ' ORDER BY a.id DESC LIMIT ? OFFSET ?';
  params.push(l, offset);

  const rows = db.exec(sql, params);
  const articles = [];
  if (rows.length && rows[0].values.length) {
    const cols = rows[0].columns;
    rows[0].values.forEach(row => {
      const article = {};
      cols.forEach((c, i) => { article[c] = row[i]; });
      article.tags = [];
      articles.push(article);
    });
  }
  attachTags(db, articles);
  return { articles, total, page: p, totalPages: Math.ceil(total / l) };
}

function saveArticleTags(db, articleId, tags) {
  db.run('DELETE FROM article_tags WHERE article_id = ?', [articleId]);
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const insertMap = db.prepare('INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)');
  (tags || []).forEach(tagName => {
    insertTag.bind([tagName]); insertTag.step(); insertTag.reset();
    const row = db.exec('SELECT id FROM tags WHERE name = ?', [tagName])[0];
    if (row) { insertMap.bind([articleId, row.values[0][0]]); insertMap.step(); insertMap.reset(); }
  });
  insertTag.free(); insertMap.free();
}

// ============ Routes ============

// List articles with pagination
router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { tag, page, limit } = req.query;
    const result = getAllArticles(db, tag, req.user, parseInt(page), parseInt(limit));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single article
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
    db.run('UPDATE articles SET views = views + 1 WHERE id = ?', [req.params.id]);
    const { saveDb } = require('../db/database'); saveDb();
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create article
router.post('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { title, excerpt, content, content_md, cover, date, read_time, icon, tags, visibility } = req.body;
    if (!title || !excerpt) return res.status(400).json({ error: 'title and excerpt are required' });
    if (!content && !content_md) return res.status(400).json({ error: 'content or content_md is required' });

    const status = isAdmin(req.user) ? 'approved' : 'pending';
    const articleSlug = slug || title.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    db.run(
      'INSERT INTO articles (title, excerpt, content, content_md, cover, slug, category, date, read_time, icon, visibility, status, author_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, excerpt, htmlContent, mdSource, cover || '', articleSlug, category || '未分类', date || new Date().toISOString().slice(0, 10), read_time || '5 min', icon || '⬡', visibility || 'public', status, req.user?.id || null]
    );
    const idRow = db.exec('SELECT last_insert_rowid()')[0];
    const articleId = idRow.values[0][0];
    saveArticleTags(db, articleId, tags);
    const { saveDb } = require('../db/database'); saveDb();
    res.status(201).json(getArticleWithTags(db, articleId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update article
router.put('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = req.params.id;
    const existing = getArticleWithTags(db, id);
    if (!existing) return res.status(404).json({ error: 'Article not found' });

    const { title, excerpt, content, content_md, cover, slug, category, date, read_time, icon, tags, visibility } = req.body;

    let htmlContent = content || content_md || existing.content;
    let mdSource = existing.content_md || '';
    if (content_md) {
      mdSource = content_md;
      try { htmlContent = marked_js.marked.parse(content_md); } catch { htmlContent = content_md; }
    }

    db.run(
      'UPDATE articles SET title=?, excerpt=?, content=?, content_md=?, cover=?, slug=?, category=?, date=?, read_time=?, icon=?, visibility=?, updated_at=datetime(\'now\') WHERE id=?',
      [title || existing.title, excerpt || existing.excerpt, htmlContent, mdSource, cover ?? existing.cover ?? '', slug || existing.slug || '', category || existing.category || '未分类', date || existing.date, read_time || existing.read_time, icon || existing.icon, visibility || existing.visibility, id]
    );
    if (tags) saveArticleTags(db, id, tags);
    const { saveDb } = require('../db/database'); saveDb();
    res.json(getArticleWithTags(db, id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete article
router.delete('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = req.params.id;
    if (!getArticleWithTags(db, id)) return res.status(404).json({ error: 'Article not found' });
    db.run('DELETE FROM article_tags WHERE article_id = ?', [id]);
    db.run('DELETE FROM articles WHERE id = ?', [id]);
    const { saveDb } = require('../db/database'); saveDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Comments ============

router.get('/:id/comments', (req, res) => {
  try {
    const db = req.app.locals.db;
    const rows = db.exec('SELECT * FROM comments WHERE article_id = ? ORDER BY created_at ASC', [req.params.id]);
    if (!rows.length || !rows[0].values.length) return res.json([]);
    const comments = rows[0].values.map(r => {
      const obj = {};
      rows[0].columns.forEach((c, i) => { obj[c] = r[i]; });
      return obj;
    });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/comments', requireAuth, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: '评论内容不能为空' });
    if (!getArticleWithTags(db, req.params.id)) return res.status(404).json({ error: 'Article not found' });
    db.run('INSERT INTO comments (article_id, user_id, username, content) VALUES (?, ?, ?, ?)',
      [req.params.id, req.user.id, req.user.username, content.trim()]);
    const idRow = db.exec('SELECT last_insert_rowid()')[0];
    const { saveDb } = require('../db/database'); saveDb();
    res.status(201).json({ id: idRow.values[0][0], article_id: parseInt(req.params.id), user_id: req.user.id, username: req.user.username, content: content.trim(), created_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:articleId/comments/:commentId', requireAuth, (req, res) => {
  try {
    const db = req.app.locals.db;
    const rows = db.exec('SELECT * FROM comments WHERE id = ? AND article_id = ?', [req.params.commentId, req.params.articleId]);
    if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Comment not found' });
    const comment = {};
    rows[0].columns.forEach((c, i) => { comment[c] = rows[0].values[0][i]; });
    if (!isAdmin(req.user) && comment.user_id !== req.user.id) return res.status(403).json({ error: '权限不足' });
    db.run('DELETE FROM comments WHERE id = ?', [req.params.commentId]);
    const { saveDb } = require('../db/database'); saveDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Favorites ============

router.post('/:id/favorite', requireAuth, (req, res) => {
  try {
    const db = req.app.locals.db;
    const articleId = parseInt(req.params.id);
    const userId = req.user.id;
    if (!getArticleWithTags(db, articleId)) return res.status(404).json({ error: 'Article not found' });
    const existing = db.exec('SELECT id FROM favorites WHERE user_id = ? AND article_id = ?', [userId, articleId]);
    if (existing.length && existing[0].values.length) {
      db.run('DELETE FROM favorites WHERE user_id = ? AND article_id = ?', [userId, articleId]);
      const { saveDb } = require('../db/database'); saveDb();
      return res.json({ favorited: false });
    }
    db.run('INSERT INTO favorites (user_id, article_id) VALUES (?, ?)', [userId, articleId]);
    const { saveDb } = require('../db/database'); saveDb();
    res.status(201).json({ favorited: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if article is favorited
router.get('/:id/favorite', requireAuth, (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.exec('SELECT id FROM favorites WHERE user_id = ? AND article_id = ?', [req.user.id, req.params.id]);
    res.json({ favorited: !!(existing.length && existing[0].values.length) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Review ============

router.get('/review/pending', requireAuth, (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: '权限不足' });
    const db = req.app.locals.db;
    const rows = db.exec("SELECT a.* FROM articles a WHERE a.status = 'pending' ORDER BY a.created_at DESC");
    if (!rows.length || !rows[0].values.length) return res.json([]);
    const articles = rows[0].values.map(r => {
      const obj = {};
      rows[0].columns.forEach((c, i) => { obj[c] = r[i]; });
      obj.tags = [];
      return obj;
    });
    attachTags(db, articles);
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/review/:id/approve', requireAuth, (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: '权限不足' });
    const db = req.app.locals.db;
    if (!getArticleWithTags(db, req.params.id)) return res.status(404).json({ error: 'Article not found' });
    db.run("UPDATE articles SET status = 'approved', updated_at = datetime('now') WHERE id = ?", [req.params.id]);
    const { saveDb } = require('../db/database'); saveDb();
    res.json(getArticleWithTags(db, req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/review/:id/reject', requireAuth, (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: '权限不足' });
    const db = req.app.locals.db;
    if (!getArticleWithTags(db, req.params.id)) return res.status(404).json({ error: 'Article not found' });
    db.run('DELETE FROM article_tags WHERE article_id = ?', [req.params.id]);
    db.run('DELETE FROM articles WHERE id = ?', [req.params.id]);
    const { saveDb } = require('../db/database'); saveDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
