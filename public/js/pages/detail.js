/* ===========================
    文章详情页组件
    =========================== */

export function renderDetail(article, onBack, onTagClick) {
  const main = document.getElementById('mainContent');
  if (!main) return;

  let html = `
    <div class="article-detail">
      <div class="back-link" data-action="back">◂ BACK_TO_ARTICLES</div>
      <div class="detail-hero">
        <div class="corner-decor tl"></div>
        <div class="corner-decor tr"></div>
        <div class="corner-decor bl"></div>
        <div class="corner-decor br"></div>
        <div class="detail-header">
          <div class="detail-meta">
            <span class="detail-meta-item"><span class="meta-icon">⌬</span> ${article.icon}</span>
            <span class="detail-meta-item"><span class="meta-icon">⌚</span> [${article.date}]</span>
            <span class="detail-meta-item"><span class="meta-icon">⏱</span> ~${article.read_time} read</span>
          </div>
          <h1 class="detail-title">${escapeHtml(article.title)}</h1>
        </div>
      </div>
      <div class="detail-content">
        ${article.content}
      </div>
      <div class="detail-tags">
        <span style="color:var(--text-dim);font-family:var(--font-mono);font-size:0.8rem;">TAGS://</span>
        ${(article.tags || []).map((t) => `<span class="tag-item" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')}
      </div>
    </div>
  `;

  main.innerHTML = html;

  const backEl = main.querySelector('[data-action="back"]');
  if (backEl) {
    backEl.addEventListener('click', () => {
      if (onBack) onBack();
    });
  }

  main.querySelectorAll('.detail-tags .tag-item').forEach((tagEl) => {
    tagEl.addEventListener('click', () => {
      const tag = tagEl.dataset.tag;
      if (onTagClick) onTagClick(tag);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
