/* ===========================
    首页 - 文章列表组件
    =========================== */

export function renderHome(articles, activeTag, onTagClick, onArticleClick) {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const filtered = activeTag && activeTag !== '全部'
    ? articles.filter((a) => (a.tags || []).includes(activeTag))
    : articles;

  let html = `
    <div class="page-header">
      <h1 class="page-title">// LATEST_ARTICLES</h1>
      <p class="page-subtitle">total: ${filtered.length} entries found</p>
    </div>
  `;

  if (filtered.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">⌕</div>
        <p class="empty-text">NO_ENTRIES_FOUND // 未找到匹配文章</p>
      </div>
    `;
  } else {
    html += '<div class="articles-grid">';
    filtered.forEach((article) => {
      html += `
        <div class="article-card${article.visibility === 'vip' ? ' vip-card' : ''}" data-id="${article.id}" data-action="article" data-visibility="${article.visibility || 'public'}">
          <div class="card-header">
            <div class="card-icon">${article.icon}</div>
            <div class="card-meta">
              <span class="card-date">[${article.date}]</span>
              <span class="card-read-time">~${article.read_time} read${article.visibility === 'vip' ? ' <span class="vip-badge">🔒VIP</span>' : ''}</span>
            </div>
          </div>
          <h3 class="card-title">${escapeHtml(article.title)}</h3>
          <p class="card-excerpt">${article.visibility === 'vip' ? '<span class="vip-overlay-text">🔒 VIP专属内容，请登录VIP账号查看</span>' : escapeHtml(article.excerpt)}</p>
          <div class="card-tags">
            ${(article.tags || []).map((t) => `<span class="card-tag">#${escapeHtml(t)}</span>`).join('')}
          </div>
          <div class="card-hint">> ${article.visibility === 'vip' ? 'VIP_ACCESS_REQUIRED' : 'READ_MORE'}</div>
        </div>
      `;
    });
    html += '</div>';
  }

  main.innerHTML = html;

  main.querySelectorAll('[data-action="article"]').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      if (onArticleClick) onArticleClick(id);
    });
  });

  main.querySelectorAll('.card-tag').forEach((tagEl) => {
    tagEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagText = tagEl.textContent.replace('#', '');
      if (onTagClick) onTagClick(tagText);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
