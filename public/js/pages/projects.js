/* ===========================
    项目作品集页组件
    =========================== */

export function renderProjects(projects, activeTag) {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const filtered = activeTag && activeTag !== '全部'
    ? projects.filter((p) => (p.tech || []).some((t) => t.toLowerCase().includes(activeTag.toLowerCase())))
    : projects;

  let html = `
    <div class="page-header">
      <h1 class="page-title">// PROJECT_SHOWCASE</h1>
      <p class="page-subtitle">total: ${filtered.length} projects deployed</p>
    </div>
  `;

  if (filtered.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">⬡</div>
        <p class="empty-text">NO_PROJECTS_FOUND // 该分类下暂无项目</p>
      </div>
    `;
  } else {
    html += '<div class="projects-grid">';
    filtered.forEach((proj) => {
      html += `
        <div class="project-card" data-action="project" data-id="${proj.id}">
          <div class="project-image">
            <span class="proj-icon">${proj.icon}</span>
          </div>
          <div class="project-body">
            <h3 class="project-name">${escapeHtml(proj.name)}</h3>
            <p class="project-desc">${escapeHtml(proj.description)}</p>
            <div class="project-tech">
              ${(proj.tech || []).map((t) => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  main.innerHTML = html;

  main.querySelectorAll('[data-action="project"]').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const proj = projects.find((p) => p.id === parseInt(id, 10));
      if (proj) {
        showToast(`PROJECT // ${proj.name} — 详情页开发中...`, 'info');
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
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
