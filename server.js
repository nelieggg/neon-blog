const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDb, closeDb } = require('./db/database');
const { authMiddleware, isAdmin } = require('./middleware/auth');
const articlesRouter = require('./routes/articles');
const projectsRouter = require('./routes/projects');
const authRouter = require('./routes/auth');
const invitesRouter = require('./routes/invites');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(authMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/invites', invitesRouter);

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
