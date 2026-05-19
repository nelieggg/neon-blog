/* ===========================
    首页 - 文章列表 + 分页
    =========================== */

import { api } from '../api.js';

export async function renderHome(activeTag, onTagClick, onArticleClick, page = 1) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-loading"><div class="loader-text">LOADING_ARTICLES<span class="cursor-blink">█</span></div></div>';

  let result;
  try {
    result = await api.getArticles(activeTag, page, 9);
  } catch {
    result = { articles: [], total: 0, page: 1, totalPages: 1 };
  }

  const { articles, total, page: curPage, totalPages } = result;
  const filtered = articles;

  let html = `
    <div class="page-header">
      <h1 class="page-title">// 最新文章</h1>
      <p class="page-subtitle">总计: ${total} 篇 | 第 ${curPage}/${totalPages} 页</p>
    </div>
  `;

  if (filtered.length === 0) {
    html += `<div class="empty-state"><div class="empty-icon">⌕</div><p class="empty-text">NO_ENTRIES_FOUND</p></div>`;
  } else {
    html += '<div class="articles-grid">';
    filtered.forEach((article) => {
      html += `
        <div class="article-card${article.visibility === 'vip' ? ' vip-card' : ''}" data-id="${article.id}" data-action="article">
          <div class="card-header">
            <div class="card-icon">${article.icon}</div>
            <div class="card-meta">
              <span class="card-date">[${article.date}]</span>
              <span class="card-read-time">~${article.read_time} 阅读${article.visibility === 'vip' ? ' <span class="vip-badge">🔒会员</span>' : ''}</span>
            </div>
          </div>
          ${article.cover ? `<div class="card-cover" style="background-image:url(${escapeAttr(article.cover)})"></div>` : ''}
          <h3 class="card-title">${escapeHtml(article.title)}</h3>
          <p class="card-excerpt">${article.visibility === 'vip' ? '<span class="vip-overlay-text">🔒 会员专属内容</span>' : escapeHtml(article.excerpt)}</p>
          <div class="card-tags">${(article.tags || []).map((t) => `<span class="card-tag">#${escapeHtml(t)}</span>`).join('')}</div>
          <div class="card-hint">> ${article.visibility === 'vip' ? '需要会员权限' : '阅读全文'}</div>
        </div>
      `;
    });
    html += '</div>';

    // Pagination
    if (totalPages > 1) {
      html += '<div class="pagination">';
      for (let i = 1; i <= totalPages; i++) {
        html += `<button class="pagination-btn${i === curPage ? ' active' : ''}" data-page="${i}">${i}</button>`;
      }
      html += '</div>';
    }
  }

  main.innerHTML = html;

  main.querySelectorAll('[data-action="article"]').forEach((card) => {
    card.addEventListener('click', () => {
      if (onArticleClick) onArticleClick(card.dataset.id);
    });
  });

  main.querySelectorAll('.card-tag').forEach((tagEl) => {
    tagEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onTagClick) onTagClick(tagEl.textContent.replace('#', ''));
    });
  });

  main.querySelectorAll('.pagination-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page);
      if (onArticleClick) onArticleClick(null, p);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;');
}
