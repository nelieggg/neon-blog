/* ===========================
    管理后台 - 文章/项目 CRUD + 审核 + 邀请码 + 管理员创建
    =========================== */

import { api } from '../api.js';

let adminTab = 'articles';
let articlesData = [];
let editingArticle = null;
let currentUser = null;

export async function showAdmin(user) {
  currentUser = user;
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div class="page-loading"><div class="loader-text">加载管理面板<span class="cursor-blink">█</span></div></div>';

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
      <h1 class="page-title">// 管理后台</h1>
      <p class="page-subtitle">管理权限: ${isSuper ? '管理员(L1)' : '小编(L2)'}</p>
    </div>
    <div class="admin-layout">
      <div class="admin-sidebar">
        <button class="admin-nav-item ${adminTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">📊 数据看板</button>
        <button class="admin-nav-item ${adminTab === 'articles' ? 'active' : ''}" data-tab="articles">⬡ 文章管理</button>
        <button class="admin-nav-item ${adminTab === 'review' ? 'active' : ''}" data-tab="review">⏳ 审核队列</button>
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
    case 'dashboard': renderDashboard(); break;
    case 'articles': renderArticleList(); break;
    case 'review': renderReviewQueue(); break;
    case 'invites': renderInvitesTab(); break;
    case 'createAdmin': renderCreateAdminTab(user); break;
  }
}

async function renderDashboard() {
  const panel = document.getElementById('adminPanel');
  panel.innerHTML = '<div class="admin-panel-header"><span class="admin-panel-title">数据看板</span></div><div class="page-loading"><div class="loader-text">加载中...</div></div>';
  try {
    const stats = await api.getDashboard();
    panel.innerHTML = `
      <div class="admin-panel-header"><span class="admin-panel-title">数据看板</span></div>
      <div class="dashboard-grid">
        <div class="dashboard-card"><div class="dash-num">${stats.totalArticles}</div><div class="dash-label">文章总数</div></div>
        <div class="dashboard-card"><div class="dash-num green">${stats.approvedArticles}</div><div class="dash-label">已发布</div></div>
        <div class="dashboard-card"><div class="dash-num yellow">${stats.pendingArticles}</div><div class="dash-label">待审核</div></div>
        <div class="dashboard-card"><div class="dash-num">${stats.totalViews}</div><div class="dash-label">总阅读量</div></div>
        <div class="dashboard-card"><div class="dash-num">${stats.todayViews}</div><div class="dash-label">今日阅读</div></div>
        <div class="dashboard-card"><div class="dash-num">${stats.totalUsers}</div><div class="dash-label">用户数</div></div>
        <div class="dashboard-card"><div class="dash-num">${stats.totalComments}</div><div class="dash-label">评论数</div></div>
        <div class="dashboard-card"><div class="dash-num">${stats.totalLikes}</div><div class="dash-label">点赞数</div></div>
        <div class="dashboard-card"><div class="dash-num">${stats.totalFavorites}</div><div class="dash-label">收藏数</div></div>
      </div>
    `;
  } catch (err) { panel.innerHTML = '<div class="admin-panel-header"><span class="admin-panel-title">数据看板</span></div><p style="color:#ff4444;padding:20px;">加载失败</p>'; }
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
            <button class="admin-btn-sm" data-edit="${a.id}">编辑</button>
            <button class="admin-btn-sm danger" data-delete="${a.id}">删除</button>
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
      <div class="admin-form-group">
        <label>邮箱 (可选)</label>
        <input type="text" id="newAdminEmail" placeholder="admin@neonblog.io" style="max-width:300px">
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
    const email = document.getElementById('newAdminEmail').value.trim();
    if (!username || !password) {
      showToast('用户名和密码不能为空', 'warn');
      return;
    }
    try {
      const result = await api.createAdmin(username, password, email);
      showToast(result.message, 'info');
      document.getElementById('newAdminName').value = '';
      document.getElementById('newAdminPwd').value = '';
      document.getElementById('newAdminEmail').value = '';
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
          ${u.email ? `<span style="color:var(--text-dim);margin-left:8px;font-size:0.72rem;">${u.email}</span>` : ''}
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
      <h3>${isEdit ? '编辑文章' : '新建文章'}</h3>
      <div class="admin-form-group">
        <label>标题</label>
        <input type="text" id="afTitle" value="${isEdit ? escapeAttr(editingArticle.title) : ''}" placeholder="输入文章标题">
      </div>
      <div class="admin-form-group">
        <label>摘要</label>
        <textarea id="afExcerpt" rows="2" placeholder="输入摘要">${isEdit ? escapeHtml(editingArticle.excerpt) : ''}</textarea>
      </div>
      <div class="admin-form-group">
        <label>封面图 URL</label>
        <input type="text" id="afCover" value="${isEdit ? (editingArticle.cover || '') : ''}" placeholder="图片URL 或点击上传">
        <input type="file" id="afCoverFile" accept="image/*" style="margin-top:6px;font-size:0.78rem;color:var(--text-secondary);">
        <span id="coverUploadHint" style="display:none;font-family:var(--font-mono);font-size:0.7rem;color:var(--neon-magenta);margin-left:6px;"></span>
      </div>
      <div class="admin-form-group">
        <label>正文 (Markdown)</label>
        <textarea id="afContentMd" rows="12" placeholder="支持 Markdown 语法，如 # 标题、**加粗**、\`代码\`">${isEdit ? (editingArticle.content_md || '') : ''}</textarea>
        <button type="button" class="admin-btn-sm" id="mdPreviewBtn" style="margin-top:6px;">👁 预览</button>
        <div id="mdPreview" style="display:none;margin-top:8px;padding:16px;background:rgba(0,0,0,0.2);border:1px solid rgba(0,255,255,0.2);border-radius:4px;max-height:400px;overflow-y:auto;color:var(--text-primary);font-size:0.9rem;line-height:1.7;"></div>
      </div>
      <div class="admin-form-group">
        <label>分类</label>
        <input type="text" id="afCategory" value="${isEdit ? (editingArticle.category || '') : ''}" placeholder="如: 技术教程、生活随笔、前端开发" style="max-width:300px">
      </div>
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
        <button class="admin-btn" id="afCancel">取消</button>
        <button class="admin-btn submit" id="afSave">${isEdit ? '更新' : '创建'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('afCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Markdown preview
  const mdPreviewBtn = document.getElementById('mdPreviewBtn');
  const mdPreview = document.getElementById('mdPreview');
  const mdTextarea = document.getElementById('afContentMd');
  mdPreviewBtn.addEventListener('click', async () => {
    if (mdPreview.style.display === 'block') {
      mdPreview.style.display = 'none';
      mdPreviewBtn.textContent = '👁 预览';
      return;
    }
    const md = mdTextarea.value.trim();
    if (!md) { mdPreview.innerHTML = '<span style="color:var(--text-dim)">无内容</span>'; mdPreview.style.display = 'block'; mdPreviewBtn.textContent = '✏ 编辑'; return; }
    // Use marked if loaded, otherwise show raw
    if (typeof marked !== 'undefined' && marked.parse) {
      mdPreview.innerHTML = marked.parse(md);
    } else {
      mdPreview.innerHTML = `<pre style="white-space:pre-wrap;font-family:var(--font-mono);">${escapeHtml(md)}</pre>`;
    }
    mdPreview.style.display = 'block';
    mdPreviewBtn.textContent = '✏ 编辑';
  });

  // Cover image upload
  const coverFileInput = document.getElementById('afCoverFile');
  const coverHint = document.getElementById('coverUploadHint');
  coverFileInput.addEventListener('change', async () => {
    const file = coverFileInput.files[0];
    if (!file) return;
    coverHint.style.display = 'inline';
    coverHint.textContent = '上传中...';
    try {
      const result = await api.uploadFile(file);
      document.getElementById('afCover').value = result.url;
      coverHint.textContent = '✓ 上传成功';
      coverHint.style.color = 'var(--neon-green)';
    } catch (err) {
      coverHint.textContent = '上传失败: ' + err.message;
      coverHint.style.color = '#ff4444';
    }
  });

  document.getElementById('afSave').addEventListener('click', async () => {
    const title = document.getElementById('afTitle').value.trim();
    const excerpt = document.getElementById('afExcerpt').value.trim();
    const content_md = document.getElementById('afContentMd').value.trim();

    if (!title || !excerpt || !content_md) {
      showToast('标题、摘要、正文不能为空', 'warn');
      return;
    }

    const data = {
      title,
      excerpt,
      content_md,
      cover: document.getElementById('afCover').value.trim() || undefined,
      tags: document.getElementById('afTags').value.split(',').map(t => t.trim()).filter(Boolean),
      date: document.getElementById('afDate').value,
      read_time: document.getElementById('afReadTime').value.trim(),
      icon: document.getElementById('afIcon').value.trim(),
      visibility: document.getElementById('afVisibility').value,
      category: document.getElementById('afCategory').value.trim() || undefined,
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
