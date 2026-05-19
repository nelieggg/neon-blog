const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDb, closeDb } = require('./db/database');
const { authMiddleware, isAdmin } = require('./middleware/auth');
const articlesRouter = require('./routes/articles');
const authRouter = require('./routes/auth');
const invitesRouter = require('./routes/invites');
const verifyRouter = require('./routes/verify');
const uploadRouter = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(authMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/verify', verifyRouter);
app.use('/api/upload', uploadRouter);

app.get('/api/tags', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const rows = db.exec('SELECT name FROM tags ORDER BY name');
    const tags = rows.length ? rows[0].values.map(r => r[0]) : [];
    res.json(['全部', ...tags]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { q } = req.query;
    if (!q) return res.json([]);

    const user = req.user;
    const canSeeVip = user && (user.role === 'vip' || user.role === 'admin' || user.role === 'superadmin');
    const visFilter = canSeeVip ? '' : " AND a.visibility = 'public'";

    const stmt = db.prepare(`
      SELECT DISTINCT a.* FROM articles a
      LEFT JOIN article_tags at2 ON a.id = at2.article_id
      LEFT JOIN tags t ON at2.tag_id = t.id
      WHERE a.status = 'approved' AND (a.title LIKE ? OR a.excerpt LIKE ? OR t.name LIKE ?)${visFilter}
      ORDER BY a.id DESC
    `);
    const pattern = `%${q}%`;
    stmt.bind([pattern, pattern, pattern]);
    const articles = [];
    while (stmt.step()) {
      articles.push(rowToArticle(db, stmt.getAsObject()));
    }
    stmt.free();
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function rowToArticle(db, row) {
  const tags = db.exec(`SELECT t.name FROM tags t
    JOIN article_tags at2 ON t.id = at2.tag_id
    WHERE at2.article_id = ?`, [row.id]);
  return {
    ...row,
    tags: tags.length ? tags[0].values.map(r => r[0]) : []
  };
}

async function start() {
  const db = await initDb();
  app.locals.db = db;
  app.locals.rowToArticle = rowToArticle;

  // Increment article view and return article by slug
  app.get('/article/:slug', (req, res) => {
    try {
      const db = app.locals.db;
      const rows = db.exec("SELECT * FROM articles WHERE slug = ? AND status = 'approved'", [req.params.slug]);
      if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: '文章不存在' });
      const article = {};
      rows[0].columns.forEach((c, i) => { article[c] = rows[0].values[0][i]; });
      if (article.visibility === 'vip' && !(req.user && (req.user.role === 'vip' || req.user.role === 'admin' || req.user.role === 'superadmin'))) {
        return res.status(403).json({ error: '需要VIP权限', vipOnly: true });
      }
      db.run('UPDATE articles SET views = views + 1 WHERE id = ?', [article.id]);
      const tags = db.exec('SELECT t.name FROM tags t JOIN article_tags at2 ON t.id = at2.tag_id WHERE at2.article_id = ?', [article.id]);
      article.tags = tags.length ? tags[0].values.map(r => r[0]) : [];
      res.json(article);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Get article comments by slug
  app.get('/article/:slug/comments', (req, res) => {
    try {
      const db = app.locals.db;
      const art = db.exec('SELECT id FROM articles WHERE slug = ?', [req.params.slug]);
      if (!art.length || !art[0].values.length) return res.json([]);
      const rows = db.exec('SELECT * FROM comments WHERE article_id = ? ORDER BY created_at ASC', [art[0].values[0][0]]);
      if (!rows.length || !rows[0].values.length) return res.json([]);
      const comments = rows[0].values.map(r => {
        const obj = {};
        rows[0].columns.forEach((c, i) => { obj[c] = r[i]; });
        return obj;
      });
      res.json(comments);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Like/Unlike article
  app.post('/article/:slug/like', (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: '请先登录' });
      const db = app.locals.db;
      const art = db.exec('SELECT id FROM articles WHERE slug = ?', [req.params.slug]);
      if (!art.length || !art[0].values.length) return res.status(404).json({ error: '文章不存在' });
      const articleId = art[0].values[0][0];
      const existing = db.exec('SELECT id FROM likes WHERE user_id = ? AND article_id = ?', [req.user.id, articleId]);
      if (existing.length && existing[0].values.length) {
        db.run('DELETE FROM likes WHERE user_id = ? AND article_id = ?', [req.user.id, articleId]);
      } else {
        db.run('INSERT INTO likes (user_id, article_id) VALUES (?, ?)', [req.user.id, articleId]);
      }
      const { saveDb } = require('./db/database'); saveDb();
      const likeCount = db.exec('SELECT COUNT(*) FROM likes WHERE article_id = ?', [articleId]);
      const count = likeCount.length && likeCount[0].values.length ? likeCount[0].values[0][0] : 0;
      res.json({ liked: !(existing.length && existing[0].values.length), likes: count });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Get related articles
  app.get('/api/articles/:id/related', (req, res) => {
    try {
      const db = app.locals.db;
      const tags = db.exec('SELECT t.name FROM tags t JOIN article_tags at2 ON t.id = at2.tag_id WHERE at2.article_id = ?', [req.params.id]);
      const tagNames = tags.length ? tags[0].values.map(r => r[0]) : [];
      if (!tagNames.length) return res.json([]);
      const placeholders = tagNames.map(() => '?').join(',');
      const rows = db.exec(
        `SELECT DISTINCT a.* FROM articles a JOIN article_tags at2 ON a.id = at2.article_id JOIN tags t ON at2.tag_id = t.id
         WHERE t.name IN (${placeholders}) AND a.id != ? AND a.status = 'approved'
         ORDER BY a.id DESC LIMIT 4`,
        [...tagNames, parseInt(req.params.id)]
      );
      if (!rows.length || !rows[0].values.length) return res.json([]);
      const articles = rows[0].values.map(r => { const o = {}; rows[0].columns.forEach((c, i) => { o[c] = r[i]; o.tags = []; }); return o; });
      articles.forEach(a => { const tr = db.exec('SELECT t.name FROM tags t JOIN article_tags at2 ON t.id = at2.tag_id WHERE at2.article_id = ?', [a.id]); a.tags = tr.length ? tr[0].values.map(v => v[0]) : []; });
      res.json(articles);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // RSS Feed
  app.get('/api/rss', (req, res) => {
    try {
      const db = app.locals.db;
      const rows = db.exec("SELECT * FROM articles WHERE status = 'approved' AND visibility = 'public' ORDER BY id DESC LIMIT 20");
      const articles = [];
      if (rows.length && rows[0].values.length) {
        const cols = rows[0].columns;
        rows[0].values.forEach(r => { const o = {}; cols.forEach((c, i) => { o[c] = r[i]; }); articles.push(o); });
      }
      const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>NEON_BLOG // 中文博客</title><link>http://localhost:3000</link><description>赛博朋克风格中文博客</description>
${articles.map(a => `<item><title>${a.title}</title><link>http://localhost:3000/#/article/${a.slug || a.id}</link><description>${a.excerpt}</description><pubDate>${a.date}</pubDate></item>`).join('\n')}
</channel></rss>`;
      res.type('application/xml');
      res.send(rss);
    } catch (err) { res.status(500).send('Error'); }
  });

  // Dashboard stats
  app.get('/api/dashboard', (req, res) => {
    try {
      const db = app.locals.db;
      const totalArticles = db.exec('SELECT COUNT(*) FROM articles')[0].values[0][0];
      const approvedArticles = db.exec("SELECT COUNT(*) FROM articles WHERE status = 'approved'")[0].values[0][0];
      const pendingArticles = db.exec("SELECT COUNT(*) FROM articles WHERE status = 'pending'")[0].values[0][0];
      const totalViews = db.exec('SELECT COALESCE(SUM(views), 0) FROM articles')[0].values[0][0];
      const totalUsers = db.exec('SELECT COUNT(*) FROM users')[0].values[0][0];
      const totalComments = db.exec('SELECT COUNT(*) FROM comments')[0].values[0][0];
      const totalLikes = db.exec('SELECT COUNT(*) FROM likes')[0].values[0][0];
      const totalFavorites = db.exec('SELECT COUNT(*) FROM favorites')[0].values[0][0];
      const today = new Date().toISOString().slice(0, 10);
      const todayViews = db.exec("SELECT COALESCE(SUM(views), 0) FROM articles WHERE date = ?", [today])[0].values[0][0];
      res.json({ totalArticles, approvedArticles, pendingArticles, totalViews, totalUsers, totalComments, totalLikes, totalFavorites, todayViews });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // User favorites list
  app.get('/api/user/favorites', (req, res) => {
    try {
      const db = req.app.locals.db;
      if (!req.user) return res.status(401).json({ error: '请先登录' });
      const rows = db.exec(
        'SELECT a.* FROM articles a JOIN favorites f ON a.id = f.article_id WHERE f.user_id = ? ORDER BY f.created_at DESC',
        [req.user.id]
      );
      if (!rows.length || !rows[0].values.length) return res.json([]);
      const articles = rows[0].values.map(r => {
        const obj = {};
        rows[0].columns.forEach((c, i) => { obj[c] = r[i]; obj.tags = []; });
        return obj;
      });
      articles.forEach(a => {
        const tr = db.exec('SELECT t.name FROM tags t JOIN article_tags at2 ON t.id = at2.tag_id WHERE at2.article_id = ?', [a.id]);
        a.tags = tr.length ? tr[0].values.map(v => v[0]) : [];
      });
      res.json(articles);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`[NEON_BLOG] Server running at http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await closeDb();
  process.exit(0);
});

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
