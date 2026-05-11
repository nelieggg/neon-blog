/* ===========================
    主控制器 - 路由 / 导航 / 搜索 / 标签 / 认证
    =========================== */

import { triggerFlipTransition } from './transition.js';
import { fetchArticles, fetchArticleById, fetchProjects, searchArticles, fetchTags } from './data.js';
import { renderHome } from './pages/home.js';
import { renderDetail } from './pages/detail.js';
import { renderProjects } from './pages/projects.js';
import { showAdmin } from './pages/admin.js';
import { renderAuth } from './pages/auth.js';
import { api, getToken, setToken } from './api.js';

// ============ State ============

let currentRoute = '';
let activeTag = '全部';
let articlesCache = [];
let projectsCache = [];
let allTags = ['全部'];
let currentUser = null;

// ============ Initialization ============

async function init() {
  // Try to restore user session
  if (getToken()) {
    try {
      currentUser = await api.getMe();
    } catch {
      setToken(null);
    }
  }
  updateUserUI();

  const [articles, projects, tags] = await Promise.all([
    fetchArticles(),
    fetchProjects(),
    fetchTags(),
  ]);
  articlesCache = articles;
  projectsCache = projects;
  allTags = tags || ['全部'];

  bindNavEvents();
  bindSearchEvents();
  bindAuthEvents();
  renderTagBar();

  const hash = window.location.hash || '#home';
  handleRoute(hash, false);

  window.addEventListener('hashchange', () => {
    handleRoute(window.location.hash, true);
  });

  const logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('click', () => navigateTo('#home'));
  }
}

// ============ Auth UI ============

function updateUserUI() {
  const loginBtn = document.getElementById('loginBtn');
  const userInfo = document.getElementById('userInfo');
  const userName = document.getElementById('userName');
  const userRoleBadge = document.getElementById('userRoleBadge');
  const adminNav = document.getElementById('adminNav');

  if (currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (userName) userName.textContent = currentUser.username;
    if (userRoleBadge) {
      const labels = { superadmin: '🔧 L1', admin: '⚙ L2', vip: '💎 VIP', user: '👤 用户' };
      userRoleBadge.textContent = labels[currentUser.role] || '👤 用户';
      userRoleBadge.className = 'user-role-badge role-' + (currentUser.role === 'superadmin' ? 'admin' : currentUser.role);
    }
    if (adminNav && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
      adminNav.style.display = 'flex';
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'none';
    if (adminNav) adminNav.style.display = 'none';
  }
}

function bindAuthEvents() {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('#login');
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setToken(null);
      currentUser = null;
      updateUserUI();
      showToast('已退出登录', 'info');
      navigateTo('#home', false);
    });
  }
}

// ============ Navigation ============

function bindNavEvents() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const route = item.dataset.route;
      if (route) navigateTo(`#${route}`);
    });
  });
}

function bindSearchEvents() {
  const input = document.getElementById('searchInput');
  const btn = document.getElementById('searchBtn');

  function doSearch() {
    const query = input.value.trim();
    if (query) {
      activeTag = '全部';
      updateTagBarActive();
      performSearch(query);
    } else if (currentRoute === 'search') {
      navigateTo('#home');
    }
  }

  if (btn) btn.addEventListener('click', doSearch);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });
  }
}

function updateNavActive(route) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    const r = item.dataset.route;
    if (route === r || (route === 'detail' && r === 'home')) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

// ============ Tag Bar ============

function renderTagBar() {
  const list = document.getElementById('tagList');
  if (!list) return;

  list.innerHTML = allTags
    .map(
      (tag) =>
        `<span class="tag-item${tag === activeTag ? ' active' : ''}" data-tag="${tag}">#${tag}</span>`
    )
    .join('');

  list.querySelectorAll('.tag-item').forEach((el) => {
    el.addEventListener('click', () => {
      const tag = el.dataset.tag;
      activeTag = tag;
      updateTagBarActive();
      if (currentRoute === 'home' || currentRoute === 'search') {
        navigateTo('#home', true);
      } else if (currentRoute === 'projects') {
        navigateTo('#projects', true);
      }
    });
  });
}

function updateTagBarActive() {
  document.querySelectorAll('#tagList .tag-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.tag === activeTag);
  });
}

// ============ Routing ============

async function navigateTo(hash, forceTransition = true) {
  if (window.location.hash !== hash) {
    window.location.hash = hash;
    return;
  }
  await handleRoute(hash, forceTransition);
}

async function handleRoute(hash, useTransition) {
  const route = parseHash(hash);
  if (route.name === currentRoute && route.param === undefined && route.name !== 'admin' && route.name !== 'login' && route.name !== 'register') return;

  const fromRoute = currentRoute;
  currentRoute = route.name;
  updateNavActive(route.name);

  if (useTransition) {
    triggerFlipTransition(fromRoute, route.name);
  }

  switch (route.name) {
    case 'home':
      await showHome();
      break;
    case 'detail':
      await showDetail(route.param);
      break;
    case 'projects':
      await showProjects();
      break;
    case 'about':
      showAbout();
      break;
    case 'admin':
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
        showToast('仅管理员可访问管理面板', 'warn');
        navigateTo('#home', false);
        return;
      }
      await showAdmin(currentUser);
      break;
    case 'login':
      renderAuth('login', (user) => {
        currentUser = user;
        updateUserUI();
      });
      break;
    case 'register':
      renderAuth('register', (user) => {
        currentUser = user;
        updateUserUI();
      });
      break;
    case 'search':
      break;
    default:
      await showHome();
  }
}

function parseHash(hash) {
  const h = hash.replace('#', '');
  if (!h || h === 'home') return { name: 'home' };
  if (h.startsWith('detail/')) return { name: 'detail', param: h.split('/')[1] };
  if (h === 'projects') return { name: 'projects' };
  if (h === 'about') return { name: 'about' };
  if (h === 'admin') return { name: 'admin' };
  if (h === 'login') return { name: 'login' };
  if (h === 'register') return { name: 'register' };
  return { name: 'home' };
}

// ============ Page Rendering ============

async function showHome() {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-loading"><div class="loader-text">LOADING_ARTICLES<span class="cursor-blink">█</span></div></div>';

  if (activeTag && activeTag !== '全部') {
    articlesCache = await fetchArticles(activeTag);
  } else {
    articlesCache = await fetchArticles();
  }

  renderHome(articlesCache, activeTag, (tag) => {
    activeTag = tag;
    updateTagBarActive();
    navigateTo('#home', true);
  }, (id) => {
    navigateTo(`#detail/${id}`);
  });

  updateTagBarActive();
}

async function showDetail(id) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-loading"><div class="loader-text">DECRYPTING_ARTICLE<span class="cursor-blink">█</span></div></div>';

  try {
    const article = await fetchArticleById(id);
    renderDetail(article, () => {
      navigateTo('#home');
    }, (tag) => {
      activeTag = tag;
      updateTagBarActive();
      navigateTo('#home', true);
    });
  } catch (err) {
    if (err.vipOnly) {
      main.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <p class="empty-text">VIP_ACCESS_REQUIRED // 该文章为VIP专属内容</p>
          <p class="empty-text" style="font-size:0.85rem;margin-top:8px">请使用VIP账号登录后查看</p>
          <div class="back-link" style="margin-top:16px;display:inline-flex;" onclick="window.location.hash='#home'">◂ BACK_TO_ARTICLES</div>
          <a href="#login" class="back-link" style="margin-top:8px;display:inline-flex;border-color:rgba(255,0,255,0.4);color:var(--neon-magenta);">⛊ LOGIN</a>
        </div>
      `;
    } else {
      main.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✕</div>
          <p class="empty-text">ARTICLE_NOT_FOUND // 文章不存在或已被删除</p>
          <div class="back-link" style="margin-top:16px;display:inline-flex;" onclick="window.location.hash='#home'">◂ BACK_TO_ARTICLES</div>
        </div>
      `;
    }
  }
}

async function showProjects() {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-loading"><div class="loader-text">LOADING_PROJECTS<span class="cursor-blink">█</span></div></div>';

  projectsCache = await fetchProjects();
  renderProjects(projectsCache, activeTag);
  updateTagBarActive();
}

function showAbout() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">// ABOUT_ME</h1>
      <p class="page-subtitle">sys.info(user);</p>
    </div>
    <div class="about-layout">
      <div class="about-sidebar">
        <div class="avatar-box">⬡</div>
        <div class="social-links">
          <a href="#" class="social-link">↗ GITHUB // @neurodev</a>
          <a href="#" class="social-link">↗ X.COM // @neurodev</a>
          <a href="#" class="social-link">↗ EMAIL // dev@neonblog.io</a>
          <a href="#" class="social-link">↗ DISCORD // neurodev#0000</a>
        </div>
      </div>
      <div class="about-main">
        <div class="about-section">
          <div class="section-title">BIO_SCAN</div>
          <p style="color:var(--text-secondary);line-height:1.8;">
            全栈开发者 | 赛博空间居民 | 开源狂热者<br>
            专注于高性能后端系统、分布式架构和前端可视化。<br>
            热爱Rust、TypeScript和一切与计算机底层相关的事物。<br>
            相信代码即是艺术，技术即为创造。
          </p>
        </div>
        <div class="about-section">
          <div class="section-title">SKILL_MATRIX</div>
          ${renderSkillBars()}
        </div>
        <div class="about-section">
          <div class="section-title">STATUS_LOG</div>
          <p style="color:var(--neon-green);font-family:var(--font-mono);font-size:0.85rem;">
            > SYSTEM_STATUS: ONLINE<br>
            > CURRENT_PROJECT: NEON-BLOG v2.0<br>
            > UPTIME: 8472h<br>
            > COFFEE_LEVEL: CRITICAL
          </p>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    document.querySelectorAll('.skill-fill').forEach((bar) => {
      bar.style.width = bar.dataset.width || '0%';
    });
  }, 200);
}

function renderSkillBars() {
  const skills = [
    { name: 'Rust / C++', level: 90 },
    { name: 'TypeScript / Node.js', level: 88 },
    { name: 'WebGPU / Three.js', level: 80 },
    { name: 'Docker / K8s', level: 85 },
    { name: '分布式系统', level: 82 },
    { name: '密码学 / 区块链', level: 70 },
  ];
  return skills
    .map(
      (s) => `
    <div class="skill-bar">
      <div class="skill-name"><span>${s.name}</span><span>${s.level}%</span></div>
      <div class="skill-track">
        <div class="skill-fill" data-width="${s.level}%" style="width:0%"></div>
      </div>
    </div>`
    )
    .join('');
}

// ============ Search ============

async function performSearch(query) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-loading"><div class="loader-text">SEARCHING_DATABASE<span class="cursor-blink">█</span></div></div>';

  triggerFlipTransition(currentRoute, 'search');

  const results = await searchArticles(query);
  articlesCache = results;
  currentRoute = 'search';

  let html = `
    <div class="page-header">
      <h1 class="page-title">// SEARCH_RESULTS</h1>
      <p class="page-subtitle">query: "${escapeHtml(query)}" → ${results.length} matches</p>
    </div>
  `;

  if (results.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">⌕</div>
        <p class="empty-text">NO_MATCHES // 未找到相关内容，换个关键词试试</p>
      </div>
    `;
  } else {
    html += '<div class="articles-grid">';
    results.forEach((article) => {
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
          <p class="card-excerpt">${article.visibility === 'vip' ? '<span class="vip-overlay-text">🔒 VIP专属内容</span>' : escapeHtml(article.excerpt)}</p>
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
      navigateTo(`#detail/${card.dataset.id}`);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ============ Toast ============

export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============ Boot ============

document.addEventListener('DOMContentLoaded', init);
