/* ===========================
    管理后台 - 文章/项目 CRUD + 审核 + 邀请码 + 管理员创建
    =========================== */

import { api } from '../api.js';

let adminTab = 'articles';
let articlesData = [];
let projectsData = [];
let editingArticle = null;
let editingProject = null;
let currentUser = null;

export async function showAdmin(user) {
  currentUser = user;
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-loading"><div class="loader-text">LOADING_ADMIN_PANEL<span class="cursor-blink">█</span></div></div>';

  const [articles, projects] = await Promise.all([
    api.getArticles().catch(() => []),
    api.getProjects().catch(() => []),
  ]);
  articlesData = articles;
  projectsData = projects;

  renderAdminLayout(user);
}

function renderAdminLayout(user) {
  const main = document.getElementById('mainContent');
  const isSuper = user && user.role === 'superadmin';

  main.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">// ADMIN_PANEL</h1>
      <p class="page-subtitle">sys.admin.level: ${isSuper ? 'SUPER_ADMIN (L1)' : 'ADMIN (L2)'}</p>
    </div>
    <div class="admin-layout">
      <div class="admin-sidebar">
        <button class="admin-nav-item ${adminTab === 'articles' ? 'active' : ''}" data-tab="articles">⬡ 文章管理</button>
        <button class="admin-nav-item ${adminTab === 'review' ? 'active' : ''}" data-tab="review">⏳ 审核队列</button>
        <button class="admin-nav-item ${adminTab === 'projects' ? 'active' : ''}" data-tab="projects">⚙ 项目管理</button>
        <button class="admin-nav-item ${adminTab === 'invites' ? 'active' : ''}" data-tab="invites">🎫 邀请码</button>
        ${isSuper ? `<button class="admin-nav-item ${adminTab === 'createAdmin' ? 'active' : ''}" data-tab="createAdmin">👥 创建管理员</button>` : ''}
      </div>
      <div class="admin-panel" id="adminPanel"></div>
    </div>
  `;

  main.querySelectorAll('.admin-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      adminTab = btn.dataset.tab;
      renderAdminLayout(user);
    });
  });

  switch (adminTab) {
    case 'articles': renderArticleList(); break;
    case 'review': renderReviewQueue(); break;
    case 'projects': renderProjectList(); break;
    case 'invites': renderInvitesTab(); break;
    case 'createAdmin': renderCreateAdminTab(user); break;
  }
}

// ============ Articles ============

function renderArticleList() {
  const panel = document.getElementById('adminPanel');
  panel.innerHTML = `
    <div class="admin-panel-header">
      <span class="admin-panel-title">文章列表 (${articlesData.length})</span>
      <button class="admin-btn" id="addArticleBtn">+ 新建文章</button>
    </div>
    <div class="admin-list" id="adminList">
      ${articlesData.length === 0 ? renderEmpty('暂无文章') : articlesData.map(a => `
        <div class="admin-list-item">
          <div class="admin-list-icon">${a.icon || '⬡'}</div>
          <div class="admin-list-info">
            <div class="admin-list-name">${escapeHtml(a.title)}</div>
            <div class="admin-list-meta">
              [${a.date}] ~${a.read_time} | ${(a.tags||[]).join(', ')} 
              ${a.visibility === 'vip' ? '| <span style="color:var(--neon-yellow)">🔒VIP</span>' : ''}
              | <span style="color:${a.status === 'approved' ? 'var(--neon-green)' : 'var(--neon-yellow)'}">● ${a.status === 'approved' ? '已审核' : '待审核'}</span>
            </div>
          </div>
          <div class="admin-list-actions">
            <button class="admin-btn-sm" data-edit="${a.id}">EDIT</button>
            <button class="admin-btn-sm danger" data-delete="${a.id}">DEL</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('addArticleBtn').addEventListener('click', () => openArticleForm());
  panel.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openArticleForm(parseInt(btn.dataset.edit)));
  });
  panel.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteArticleItem(parseInt(btn.dataset.delete)));
  });
}

// ============ Review Queue ============

async function renderReviewQueue() {
  const panel = document.getElementById('adminPanel');
  panel.innerHTML = '<div class="admin-panel-header"><span class="admin-panel-title">审核队列</span></div><div class="page-loading" style="min-height:100px"><div class="loader-text">LOADING<span class="cursor-blink">█</span></div></div>';

  let pendingArticles = [];
  try {
    pendingArticles = await api.getPendingArticles();
  } catch (err) {
    pendingArticles = [];
  }

  panel.innerHTML = `
    <div class="admin-panel-header">
      <span class="admin-panel-title">待审核文章 (${pendingArticles.length})</span>
    </div>
    <div class="admin-list" id="adminList">
      ${pendingArticles.length === 0 ? renderEmpty('暂无待审核文章') : pendingArticles.map(a => `
        <div class="admin-list-item">
          <div class="admin-list-icon">${a.icon || '⬡'}</div>
          <div class="admin-list-info">
            <div class="admin-list-name">${escapeHtml(a.title)}</div>
            <div class="admin-list-meta">
              [${a.date}] | ${(a.tags||[]).join(', ')} | ${a.visibility === 'vip' ? '🔒VIP ' : ''}
            </div>
            <div class="review-excerpt" style="margin-top:6px;font-size:0.8rem;color:var(--text-secondary);">${escapeHtml(a.excerpt).slice(0, 120)}...</div>
          </div>
          <div class="admin-list-actions">
            <button class="admin-btn-sm" data-approve="${a.id}" style="color:var(--neon-green);border-color:rgba(0,255,65,0.4)">✓ 通过</button>
            <button class="admin-btn-sm danger" data-reject="${a.id}">✕ 拒绝</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  panel.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api.approveArticle(parseInt(btn.dataset.approve));
        showToast('文章已审核通过', 'info');
        renderReviewQueue();
      } catch (err) {
        showToast('审核失败: ' + err.message, 'error');
      }
    });
  });
  panel.querySelectorAll('[data-reject]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('确定拒绝并删除此文章?')) return;
      try {
        await api.rejectArticle(parseInt(btn.dataset.reject));
        showToast('文章已拒绝并删除', 'info');
        renderReviewQueue();
      } catch (err) {
        showToast('操作失败: ' + err.message, 'error');
      }
    });
  });
}

// ============ Invites ============

async function renderInvitesTab() {
  const panel = document.getElementById('adminPanel');

  let invites = [];
  try {
    invites = await api.getInvites();
  } catch (err) {
    invites = [];
  }

  panel.innerHTML = `
    <div class="admin-panel-header">
      <span class="admin-panel-title">邀请码管理 (${invites.length})</span>
    </div>
    <div class="admin-invite-form" style="padding:16px 24px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <input type="number" id="inviteCount" value="1" min="1" max="20" style="width:60px;padding:8px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-primary);font-family:var(--font-mono);">
      <span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-dim);">个邀请码</span>
      <input type="text" id="invitePrefix" placeholder="前缀(可选)" style="width:120px;padding:8px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-primary);font-family:var(--font-mono);font-size:0.82rem;">
      <button class="admin-btn submit" id="genInviteBtn">生成</button>
    </div>
    <div class="admin-list" id="adminList">
      ${invites.length === 0 ? renderEmpty('暂无邀请码') : invites.map(inv => `
        <div class="admin-list-item">
          <div class="admin-list-icon" style="color:${inv.is_used ? 'var(--text-dim)' : 'var(--neon-green)'}">${inv.is_used ? '⬡' : '🎫'}</div>
          <div class="admin-list-info">
            <div class="admin-list-name" style="font-family:var(--font-mono);letter-spacing:1px;color:${inv.is_used ? 'var(--text-dim)' : 'var(--neon-green)'}">
              ${inv.code} ${inv.is_used ? '(已使用)' : '(可用)'}
            </div>
            <div class="admin-list-meta">
              创建者: ${inv.created_by_name || 'system'} 
              ${inv.is_used ? `| 使用者: ${inv.used_by_name || 'N/A'} | ${inv.used_at || ''}` : ''}
            </div>
          </div>
          <div class="admin-list-actions">
            ${!inv.is_used ? `<button class="admin-btn-sm danger" data-delinv="${inv.id}">删除</button>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('genInviteBtn').addEventListener('click', async () => {
    const count = parseInt(document.getElementById('inviteCount').value) || 1;
    const prefix = document.getElementById('invitePrefix').value.trim();
    try {
      const result = await api.createInvites(count, prefix || null);
      showToast(`成功生成 ${result.codes.length} 个邀请码`, 'info');
      renderInvitesTab();
    } catch (err) {
      showToast('生成失败: ' + err.message, 'error');
    }
  });

  panel.querySelectorAll('[data-delinv]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('确定删除此邀请码?')) return;
      try {
        await api.deleteInvite(parseInt(btn.dataset.delinv));
        showToast('邀请码已删除', 'info');
        renderInvitesTab();
      } catch (err) {
        showToast('删除失败: ' + err.message, 'error');
      }
    });
  });
}

// ============ Create Admin (Superadmin only) ============

function renderCreateAdminTab(user) {
  const panel = document.getElementById('adminPanel');

  panel.innerHTML = `
    <div class="admin-panel-header">
      <span class="admin-panel-title">创建二级管理员</span>
    </div>
    <div style="padding:24px;">
      <div class="admin-form-group">
        <label>新管理员用户名</label>
        <input type="text" id="newAdminName" placeholder="输入用户名 (至少3字符)" style="max-width:300px">
      </div>
      <div class="admin-form-group">
        <label>新管理员密码</label>
        <input type="password" id="newAdminPwd" placeholder="输入密码 (至少6字符)" style="max-width:300px">
      </div>
      <div class="admin-form-actions" style="justify-content:flex-start">
        <button class="admin-btn submit" id="createAdminBtn">创建管理员</button>
      </div>
      <div class="admin-form-group" style="margin-top:20px">
        <label>现有管理员列表</label>
      </div>
      <div id="adminListContainer" style="color:var(--text-dim);font-family:var(--font-mono);font-size:0.82rem;">加载中...</div>
    </div>
  `;

  document.getElementById('createAdminBtn').addEventListener('click', async () => {
    const username = document.getElementById('newAdminName').value.trim();
    const password = document.getElementById('newAdminPwd').value.trim();
    if (!username || !password) {
      showToast('用户名和密码不能为空', 'warn');
      return;
    }
    try {
      const result = await api.createAdmin(username, password);
      showToast(result.message, 'info');
      document.getElementById('newAdminName').value = '';
      document.getElementById('newAdminPwd').value = '';
      // Refresh admin list
      loadAdminList();
    } catch (err) {
      showToast('创建失败: ' + err.message, 'error');
    }
  });

  loadAdminList();

  async function loadAdminList() {
    try {
      const users = await api.getUsers();
      const admins = users.filter(u => u.role === 'admin' || u.role === 'superadmin');
      const container = document.getElementById('adminListContainer');
      container.innerHTML = admins.map(u => `
        <div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03)">
          <span style="color:var(--neon-cyan)">${u.username}</span>
          <span class="user-role-badge ${u.role === 'superadmin' ? 'role-admin' : 'role-vip'}" style="margin-left:8px;display:inline-block;position:static">
            ${u.role === 'superadmin' ? 'L1 超级管理员' : 'L2 管理员'}
          </span>
          <span style="color:var(--text-dim);margin-left:8px;font-size:0.7rem;">${u.created_at}</span>
        </div>
      `).join('') || '<span style="color:var(--text-dim)">暂无其他管理员</span>';
    } catch {
      document.getElementById('adminListContainer').innerHTML = '<span style="color:#ff4444">加载失败</span>';
    }
  }
}

// ============ Article Form ============

function openArticleForm(id = null) {
  editingArticle = id ? articlesData.find(a => a.id === id) : null;
  const isEdit = !!editingArticle;

  const overlay = document.createElement('div');
  overlay.className = 'admin-form-overlay';
  overlay.id = 'articleFormOverlay';

  const tags = editingArticle ? (editingArticle.tags || []).join(', ') : '';

  overlay.innerHTML = `
    <div class="admin-form">
      <h3>${isEdit ? 'EDIT_ARTICLE' : 'NEW_ARTICLE'} //</h3>
      <div class="admin-form-group">
        <label>标题</label>
        <input type="text" id="afTitle" value="${isEdit ? escapeAttr(editingArticle.title) : ''}" placeholder="输入文章标题">
      </div>
      <div class="admin-form-group">
        <label>摘要</label>
        <textarea id="afExcerpt" rows="2" placeholder="输入摘要">${isEdit ? escapeHtml(editingArticle.excerpt) : ''}</textarea>
      </div>
      <div class="admin-form-group">
        <label>正文 (HTML)</label>
        <textarea id="afContent" rows="10" placeholder="输入正文HTML">${isEdit ? editingArticle.content : ''}</textarea>
      </div>
      <div class="admin-form-group">
        <label>标签 (逗号分隔)</label>
        <input type="text" id="afTags" value="${tags}" placeholder="如: Rust, 前端开发, 图形学">
      </div>
      <div class="admin-form-group">
        <label>日期</label>
        <input type="date" id="afDate" value="${isEdit ? editingArticle.date : '2088-01-01'}">
      </div>
      <div class="admin-form-group">
        <label>阅读时长</label>
        <input type="text" id="afReadTime" value="${isEdit ? editingArticle.read_time : '5 min'}" placeholder="如: 8 min">
      </div>
      <div class="admin-form-group">
        <label>图标 (Emoji)</label>
        <input type="text" id="afIcon" value="${isEdit ? editingArticle.icon : '⬡'}" placeholder="如: ⚛">
      </div>
      <div class="admin-form-group">
        <label>可见性</label>
        <select id="afVisibility">
          <option value="public" ${isEdit && editingArticle.visibility === 'public' ? 'selected' : ''}>公开</option>
          <option value="vip" ${isEdit && editingArticle.visibility === 'vip' ? 'selected' : ''}>VIP 专属</option>
        </select>
      </div>
      ${isEdit ? `<div class="admin-form-group"><label>状态</label><div style="font-family:var(--font-mono);color:${editingArticle.status==='approved'?'var(--neon-green)':'var(--neon-yellow)'};padding:10px 0">● ${editingArticle.status === 'approved' ? '已审核通过' : '待审核'}</div></div>` : ''}
      <div class="admin-form-actions">
        <button class="admin-btn" id="afCancel">CANCEL</button>
        <button class="admin-btn submit" id="afSave">${isEdit ? 'UPDATE' : 'CREATE'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('afCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('afSave').addEventListener('click', async () => {
    const title = document.getElementById('afTitle').value.trim();
    const excerpt = document.getElementById('afExcerpt').value.trim();
    const content = document.getElementById('afContent').value.trim();

    if (!title || !excerpt || !content) {
      showToast('标题、摘要、正文不能为空', 'warn');
      return;
    }

    const data = {
      title,
      excerpt,
      content,
      tags: document.getElementById('afTags').value.split(',').map(t => t.trim()).filter(Boolean),
      date: document.getElementById('afDate').value,
      read_time: document.getElementById('afReadTime').value.trim(),
      icon: document.getElementById('afIcon').value.trim(),
      visibility: document.getElementById('afVisibility').value,
    };

    try {
      if (isEdit) {
        await api.updateArticle(editingArticle.id, data);
        showToast('文章更新成功', 'info');
      } else {
        await api.createArticle(data);
        showToast('文章创建成功（管理员创建自动审核通过）', 'info');
      }
      overlay.remove();
      articlesData = await api.getArticles();
      renderAdminLayout(currentUser);
    } catch (err) {
      showToast('操作失败: ' + err.message, 'error');
    }
  });
}

async function deleteArticleItem(id) {
  if (!confirm(`确认删除文章 #${id}?`)) return;
  try {
    await api.deleteArticle(id);
    showToast('文章已删除', 'info');
    articlesData = await api.getArticles();
    renderAdminLayout(currentUser);
  } catch (err) {
    showToast('删除失败: ' + err.message, 'error');
  }
}

// ============ Projects ============

function renderProjectList() {
  const panel = document.getElementById('adminPanel');
  panel.innerHTML = `
    <div class="admin-panel-header">
      <span class="admin-panel-title">项目列表 (${projectsData.length})</span>
      <button class="admin-btn" id="addProjectBtn">+ 新建项目</button>
    </div>
    <div class="admin-list" id="adminList">
      ${projectsData.length === 0 ? renderEmpty('暂无项目') : projectsData.map(p => `
        <div class="admin-list-item">
          <div class="admin-list-icon">${p.icon || '⬡'}</div>
          <div class="admin-list-info">
            <div class="admin-list-name">${escapeHtml(p.name)}</div>
            <div class="admin-list-meta">${(p.tech||[]).join(', ')}</div>
          </div>
          <div class="admin-list-actions">
            <button class="admin-btn-sm" data-edit="${p.id}">EDIT</button>
            <button class="admin-btn-sm danger" data-delete="${p.id}">DEL</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('addProjectBtn').addEventListener('click', () => openProjectForm());
  panel.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openProjectForm(parseInt(btn.dataset.edit)));
  });
  panel.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteProjectItem(parseInt(btn.dataset.delete)));
  });
}

function openProjectForm(id = null) {
  editingProject = id ? projectsData.find(p => p.id === id) : null;
  const isEdit = !!editingProject;

  const overlay = document.createElement('div');
  overlay.className = 'admin-form-overlay';
  overlay.id = 'projectFormOverlay';

  const tech = editingProject ? (editingProject.tech || []).join(', ') : '';

  overlay.innerHTML = `
    <div class="admin-form">
      <h3>${isEdit ? 'EDIT_PROJECT' : 'NEW_PROJECT'} //</h3>
      <div class="admin-form-group">
        <label>项目名称</label>
        <input type="text" id="pfName" value="${isEdit ? escapeAttr(editingProject.name) : ''}" placeholder="输入项目名称">
      </div>
      <div class="admin-form-group">
        <label>描述</label>
        <textarea id="pfDesc" rows="3" placeholder="输入项目描述">${isEdit ? escapeHtml(editingProject.description) : ''}</textarea>
      </div>
      <div class="admin-form-group">
        <label>技术栈 (逗号分隔)</label>
        <input type="text" id="pfTech" value="${tech}" placeholder="如: Rust, Tokio, Redis">
      </div>
      <div class="admin-form-group">
        <label>图标 (Emoji)</label>
        <input type="text" id="pfIcon" value="${isEdit ? editingProject.icon : '⬡'}" placeholder="如: ⚙">
      </div>
      <div class="admin-form-group">
        <label>链接</label>
        <input type="text" id="pfLink" value="${isEdit ? (editingProject.link || '#') : '#'}" placeholder="如: https://github.com/...">
      </div>
      <div class="admin-form-actions">
        <button class="admin-btn" id="pfCancel">CANCEL</button>
        <button class="admin-btn submit" id="pfSave">${isEdit ? 'UPDATE' : 'CREATE'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('pfCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('pfSave').addEventListener('click', async () => {
    const name = document.getElementById('pfName').value.trim();
    const description = document.getElementById('pfDesc').value.trim();

    if (!name || !description) {
      showToast('名称和描述不能为空', 'warn');
      return;
    }

    const data = {
      name,
      description,
      tech: document.getElementById('pfTech').value.split(',').map(t => t.trim()).filter(Boolean),
      icon: document.getElementById('pfIcon').value.trim(),
      link: document.getElementById('pfLink').value.trim(),
    };

    try {
      if (isEdit) {
        await api.updateProject(editingProject.id, data);
        showToast('项目更新成功', 'info');
      } else {
        await api.createProject(data);
        showToast('项目创建成功', 'info');
      }
      overlay.remove();
      projectsData = await api.getProjects();
      renderAdminLayout(currentUser);
    } catch (err) {
      showToast('操作失败: ' + err.message, 'error');
    }
  });
}

async function deleteProjectItem(id) {
  if (!confirm(`确认删除项目 #${id}?`)) return;
  try {
    await api.deleteProject(id);
    showToast('项目已删除', 'info');
    projectsData = await api.getProjects();
    renderAdminLayout(currentUser);
  } catch (err) {
    showToast('删除失败: ' + err.message, 'error');
  }
}

// ============ Helpers ============

function renderEmpty(msg) {
  return `<div class="empty-state" style="padding:40px"><div class="empty-icon">⌕</div><p class="empty-text">${msg}</p></div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
