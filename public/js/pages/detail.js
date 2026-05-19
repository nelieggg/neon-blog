/* ===========================
    文章详情页 + 评论 + 收藏
    =========================== */

import { api, getToken } from '../api.js';

export function renderDetail(article, onBack, onTagClick) {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const loggedIn = !!getToken();

  let html = `
    <div class="article-detail">
      <div class="back-link" data-action="back">◂ 返回文章列表</div>
      <div class="detail-hero">
        <div class="corner-decor tl"></div><div class="corner-decor tr"></div><div class="corner-decor bl"></div><div class="corner-decor br"></div>
        <div class="detail-header">
          <div class="detail-meta">
            <span class="detail-meta-item"><span class="meta-icon">⌬</span> ${escapeHtml(article.icon)}</span>
            <span class="detail-meta-item"><span class="meta-icon">⌚</span> [${escapeHtml(article.date)}]</span>
            <span class="detail-meta-item"><span class="meta-icon">⏱</span> ~${escapeHtml(article.read_time)} read</span>
          </div>
          <h1 class="detail-title">${escapeHtml(article.title)}</h1>
        </div>
      </div>
      <div class="detail-actions">
        ${loggedIn ? `<button class="admin-btn" id="favBtn" data-favid="${article.id}">☆ 收藏</button>` : ''}
      </div>
      <div class="detail-content">${article.content}</div>
      <div class="detail-tags">
        <span style="color:var(--text-dim);font-family:var(--font-mono);font-size:0.8rem;">TAGS://</span>
        ${(article.tags || []).map((t) => `<span class="tag-item" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')}
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

  // Back button
  main.querySelector('[data-action="back"]')?.addEventListener('click', () => onBack?.());

  // Tag clicks
  main.querySelectorAll('.detail-tags .tag-item').forEach(tagEl => {
    tagEl.addEventListener('click', () => onTagClick?.(tagEl.dataset.tag));
  });

  // Favorite
  if (loggedIn) loadFavoriteState(article.id);
  if (loggedIn) loadComments(article.id);

  // Send comment
  const sendBtn = document.getElementById('sendCommentBtn');
  const commentInput = document.getElementById('commentInput');
  if (sendBtn && commentInput) {
    sendBtn.addEventListener('click', async () => {
      const content = commentInput.value.trim();
      if (!content) return showToast('评论内容不能为空', 'warn');
      try {
        await api.addComment(article.id, content);
        commentInput.value = '';
        showToast('评论发送成功', 'info');
        loadComments(article.id);
      } catch (err) { showToast(err.message, 'error'); }
    });
  }
}

async function loadFavoriteState(articleId) {
  try {
    const result = await api.checkFavorite(articleId);
    const btn = document.getElementById('favBtn');
    if (btn) {
      btn.innerHTML = result.favorited ? '★ 已收藏' : '☆ 收藏';
      btn.style.color = result.favorited ? 'var(--neon-yellow)' : '';
    }
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

async function loadComments(articleId) {
  const list = document.getElementById('commentsList');
  if (!list) return;
  try {
    const comments = await api.getComments(articleId);
    if (comments.length === 0) {
      list.innerHTML = '<p style="color:var(--text-dim);font-family:var(--font-mono);font-size:0.85rem;">暂无评论，来写第一条吧</p>';
      return;
    }
    list.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-meta">
          <span class="comment-user">${escapeHtml(c.username)}</span>
          <span class="comment-time">${c.created_at?.slice(0, 16) || ''}</span>
        </div>
        <div class="comment-content">${escapeHtml(c.content)}</div>
      </div>
    `).join('');
  } catch { list.innerHTML = '<p style="color:#ff4444">加载评论失败</p>'; }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showToast(message, type) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
