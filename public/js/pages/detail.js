/* ===========================
    文章详情页 + 评论 + 收藏 + 点赞 + 目录 + 推荐
    =========================== */

import { api, getToken } from '../api.js';

export function renderDetail(article, onBack, onTagClick) {
  const main = document.getElementById('mainContent');
  if (!main) return;
  const loggedIn = !!getToken();

  // Generate TOC from headings
  const toc = generateTOC(article.content);
  const tocHTML = toc.length ? `
    <div class="toc-sidebar">
      <div class="toc-title">📑 目录</div>
      ${toc.map(h => `<a class="toc-item toc-${h.level}" href="#${h.id}">${h.text}</a>`).join('')}
    </div>` : '';

  let html = `
    <div class="article-detail">
      <div class="back-link" data-action="back">◂ 返回文章列表</div>
      <div class="detail-hero">
        <div class="corner-decor tl"></div><div class="corner-decor tr"></div><div class="corner-decor bl"></div><div class="corner-decor br"></div>
        <div class="detail-header">
          <div class="detail-meta">
            <span class="detail-meta-item"><span class="meta-icon">⌬</span> ${escapeHtml(article.icon)}</span>
            <span class="detail-meta-item"><span class="meta-icon">⌚</span> [${escapeHtml(article.date)}]</span>
            <span class="detail-meta-item"><span class="meta-icon">⏱</span> ~${escapeHtml(article.read_time)} 阅读</span>
            <span class="detail-meta-item"><span class="meta-icon">👁</span> ${article.views || 0} 次阅读</span>
            <span class="detail-meta-item"><span class="meta-icon">📂</span> ${escapeHtml(article.category || '未分类')}</span>
          </div>
          <h1 class="detail-title">${escapeHtml(article.title)}</h1>
        </div>
      </div>
      <div class="detail-actions">
        ${loggedIn ? `<button class="admin-btn" id="favBtn" data-favid="${article.id}">☆ 收藏</button>` : ''}
        ${loggedIn ? `<button class="admin-btn" id="likeBtn" data-likeid="${article.id}">👍 点赞 (0)</button>` : ''}
      </div>
      <div class="detail-layout">
        <div class="detail-content" id="detailContent">${insertHeadingAnchors(article.content)}</div>
        ${tocHTML}
      </div>
      <div class="detail-tags">
        <span style="color:var(--text-dim);font-family:var(--font-mono);font-size:0.8rem;">标签://</span>
        ${(article.tags || []).map((t) => `<span class="tag-item" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')}
      </div>
      <div class="related-section" id="relatedSection">
        <div class="comments-title">// 相关推荐</div>
        <div id="relatedList">加载中...</div>
      </div>
      <div class="comments-section">
        <h3 class="comments-title">// 评论</h3>
        <div id="commentsList">加载中...</div>
        ${loggedIn ? `<div class="comment-form">
          <textarea id="commentInput" placeholder="写下你的评论..." rows="3"></textarea>
          <button class="admin-btn submit" id="sendCommentBtn">发送评论</button>
        </div>` : `<div class="back-link" style="cursor:pointer" onclick="window.location.hash='#login'">⛊ 登录后评论</div>`}
      </div>
    </div>
  `;

  main.innerHTML = html;

  document.querySelector('[data-action="back"]')?.addEventListener('click', () => onBack?.());
  document.querySelectorAll('.detail-tags .tag-item').forEach(tagEl => {
    tagEl.addEventListener('click', () => onTagClick?.(tagEl.dataset.tag));
  });

  if (loggedIn) {
    loadFavoriteState(article.id);
    loadComments(article.id);
    loadRelated(article.id);
  } else {
    loadRelated(article.id);
    loadComments(article.id);
  }

  // Comment
  const sendBtn = document.getElementById('sendCommentBtn');
  const commentInput = document.getElementById('commentInput');
  if (sendBtn && commentInput && loggedIn) {
    sendBtn.addEventListener('click', async () => {
      const content = commentInput.value.trim();
      if (!content) return showToast('评论内容不能为空', 'warn');
      try { await api.addComment(article.id, content); commentInput.value = ''; showToast('评论发送成功', 'info'); loadComments(article.id); }
      catch (err) { showToast(err.message, 'error'); }
    });
  }

  // Scroll to heading on TOC click
  document.querySelectorAll('.toc-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const id = item.getAttribute('href').replace('#', '');
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Like button
  if (loggedIn) loadLikeState(article);
}

function generateTOC(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  const headings = div.querySelectorAll('h2, h3');
  const toc = [];
  headings.forEach((h, i) => {
    const id = 'heading-' + i;
    h.id = h.id || id;
    toc.push({ id: h.id, text: h.textContent, level: h.tagName.toLowerCase() });
  });
  return toc;
}

function insertHeadingAnchors(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  div.querySelectorAll('h2, h3').forEach((h, i) => {
    h.id = h.id || 'heading-' + i;
  });
  return div.innerHTML;
}

async function loadFavoriteState(articleId) {
  try {
    const result = await api.checkFavorite(articleId);
    const btn = document.getElementById('favBtn');
    if (btn) { btn.innerHTML = result.favorited ? '★ 已收藏' : '☆ 收藏'; btn.style.color = result.favorited ? 'var(--neon-yellow)' : ''; }
  } catch {}
  document.getElementById('favBtn')?.addEventListener('click', async () => {
    try {
      const result = await api.toggleFavorite(articleId);
      const btn = document.getElementById('favBtn');
      btn.innerHTML = result.favorited ? '★ 已收藏' : '☆ 收藏';
      btn.style.color = result.favorited ? 'var(--neon-yellow)' : '';
      showToast(result.favorited ? '已收藏' : '已取消收藏', 'info');
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function loadLikeState(article) {
  try {
    // Get like count via related
    const btn = document.getElementById('likeBtn');
    btn.textContent = '👍 点赞';
  } catch {}
  document.getElementById('likeBtn')?.addEventListener('click', async () => {
    try {
      const slug = article.slug || article.id;
      const result = await api.toggleLike(slug);
      const btn = document.getElementById('likeBtn');
      btn.textContent = (result.liked ? '👍' : '👍') + ' 点赞 (' + result.likes + ')';
      btn.style.color = result.liked ? '#ff4444' : '';
      showToast(result.liked ? '已点赞' : '已取消点赞', 'info');
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function loadComments(articleId) {
  const list = document.getElementById('commentsList');
  if (!list) return;
  try {
    const comments = await api.getComments(articleId);
    if (comments.length === 0) { list.innerHTML = '<p style="color:var(--text-dim);font-family:var(--font-mono);font-size:0.85rem;">暂无评论，来写第一条吧</p>'; return; }
    list.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-meta"><span class="comment-user">${escapeHtml(c.username)}</span><span class="comment-time">${(c.created_at||'').slice(0,16)}</span></div>
        <div class="comment-content">${escapeHtml(c.content)}</div>
      </div>`).join('');
  } catch { list.innerHTML = '<p style="color:#ff4444">加载评论失败</p>'; }
}

async function loadRelated(articleId) {
  const list = document.getElementById('relatedList');
  if (!list) return;
  try {
    const related = await api.getRelated(articleId);
    if (!related.length) { list.innerHTML = '<p style="color:var(--text-dim);font-family:var(--font-mono);font-size:0.85rem;">暂无推荐</p>'; return; }
    list.innerHTML = related.map(a => `
      <div class="related-item" onclick="window.location.hash='#detail/${a.id}'">
        <span>${a.icon||'⬡'}</span>
        <span class="related-title">${escapeHtml(a.title)}</span>
        <span class="related-views">👁 ${a.views||0}</span>
      </div>`).join('');
  } catch { list.innerHTML = '<p style="color:#ff4444">加载失败</p>'; }
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str || ''; return div.innerHTML; }
function showToast(m, t) { const c = document.getElementById('toastContainer'); if (!c) return; const el = document.createElement('div'); el.className = `toast ${t}`; el.textContent = m; c.appendChild(el); setTimeout(() => el.remove(), 3000); }
