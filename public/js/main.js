/* ===========================
    主控制器 - 路由 / 导航 / 搜索 / 标签 / 认证
    =========================== */

import { triggerFlipTransition } from './transition.js';
import { fetchArticles, fetchArticleById, searchArticles, fetchTags } from './data.js';
import { renderHome } from './pages/home.js';
import { renderDetail } from './pages/detail.js';
import { showAdmin } from './pages/admin.js';
import { renderAuth } from './pages/auth.js';
import { renderProfile } from './pages/profile.js';
import { renderForgotPassword, renderResetPassword } from './pages/forgot.js';
import { renderWrite } from './pages/write.js';
import { api, getToken, setToken } from './api.js';

// ============ State ============

let currentRoute = '';
let activeTag = '全部';
let articlesCache = [];
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

  const [articles, tags] = await Promise.all([
    fetchArticles(),
    fetchTags(),
  ]);
  articlesCache = articles;
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
      const labels = { superadmin: '🔧 L1', admin: '⚙ L2', vip: '💎 会员', user: '👤 用户' };
      userRoleBadge.textContent = labels[currentUser.role] || '👤 用户';
      userRoleBadge.className = 'user-role-badge role-' + (currentUser.role === 'superadmin' ? 'admin' : currentUser.role);
    }
    if (adminNav && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
      adminNav.style.display = 'flex';
    }
    const writeNav = document.getElementById('writeNav');
    if (writeNav) writeNav.style.display = 'flex';
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
    case 'profile':
      if (!currentUser) {
        showToast('请先登录', 'warn');
        navigateTo('#login', false);
        return;
      }
      renderProfile(currentUser);
      break;
    case 'forgot-password':
      renderForgotPassword();
      break;
    case 'reset-password':
      renderResetPassword(route.param);
      break;
    case 'write':
      if (!currentUser) {
        showToast('请先登录', 'warn');
        navigateTo('#login', false);
        return;
      }
      renderWrite(() => {});
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
  if (h === 'admin') return { name: 'admin' };
  if (h === 'login') return { name: 'login' };
  if (h === 'register') return { name: 'register' };
  if (h === 'profile') return { name: 'profile' };
  if (h === 'forgot-password') return { name: 'forgot-password' };
  if (h.startsWith('reset-password/')) return { name: 'reset-password', param: h.slice(15) };
  if (h === 'write') return { name: 'write' };
  return { name: 'home' };
}

// ============ Page Rendering ============

async function showHome(page = 1) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-loading"><div class="loader-text">加载文章列表<span class="cursor-blink">█</span></div></div>';

  await renderHome(activeTag, (tag) => {
    activeTag = tag;
    updateTagBarActive();
    navigateTo('#home', true);
  }, (id, p) => {
    if (id) navigateTo(`#detail/${id}`);
    else if (p) showHome(p);
  }, page);

  updateTagBarActive();
}

async function showDetail(id) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-loading"><div class="loader-text">加载中<span class="cursor-blink">█</span></div></div>';

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
          <div class="back-link" style="margin-top:16px;display:inline-flex;" onclick="window.location.hash='#home'">◂ 返回文章列表</div>
          <a href="#login" class="back-link" style="margin-top:8px;display:inline-flex;border-color:rgba(255,0,255,0.4);color:var(--neon-magenta);">⛊ 登录</a>
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

// ============ Search ============

async function performSearch(query) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-loading"><div class="loader-text">搜索中<span class="cursor-blink">█</span></div></div>';

  triggerFlipTransition(currentRoute, 'search');

  const results = await searchArticles(query);
  articlesCache = results;
  currentRoute = 'search';

  let html = `
    <div class="page-header">
      <h1 class="page-title">// 搜索结果</h1>
      <p class="page-subtitle">查询: "${escapeHtml(query)}" → ${results.length} 条结果</p>
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
          <p class="card-excerpt">${article.visibility === 'vip' ? '<span class="vip-overlay-text">🔒 会员专属内容</span>' : escapeHtml(article.excerpt)}</p>
          <div class="card-tags">
            ${(article.tags || []).map((t) => `<span class="card-tag">#${escapeHtml(t)}</span>`).join('')}
          </div>
          <div class="card-hint">> ${article.visibility === 'vip' ? '需要会员权限' : '阅读全文'}</div>
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
