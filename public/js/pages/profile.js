/* ===========================
    个人中心页
    =========================== */

import { api } from '../api.js';

export function renderProfile(user) {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">// 个人中心</h1>
      <p class="page-subtitle">账号: ${user.username}</p>
    </div>
    <div class="profile-layout">
      <div class="profile-sidebar">
        <div class="profile-avatar">${user.role === 'superadmin' ? '🔧' : user.role === 'admin' ? '⚙' : user.role === 'vip' ? '💎' : '👤'}</div>
        <span class="user-role-badge role-${user.role === 'superadmin' ? 'admin' : user.role}" style="margin-top:8px;display:inline-block;position:static;">
          ${user.role === 'superadmin' ? 'L1 超级管理员' : user.role === 'admin' ? 'L2 管理员' : user.role === 'vip' ? 'VIP 用户' : '普通用户'}
        </span>
      </div>
      <div class="profile-main">
        <div class="about-section">
          <div class="section-title">基本信息</div>
          <div class="profile-field">
            <span class="profile-label">用户名</span>
            <span class="profile-value">${escapeHtml(user.username)}</span>
          </div>
          <div class="profile-field">
            <span class="profile-label">邮箱</span>
            <span class="profile-value" id="displayEmail">${escapeHtml(user.email || '未设置')}</span>
            <button class="admin-btn-sm" id="editEmailBtn">修改</button>
          </div>
          <div class="profile-field" id="editEmailForm" style="display:none">
            <span class="profile-label">NEW_EMAIL</span>
            <input type="email" id="newEmail" value="${escapeAttr(user.email || '')}" placeholder="new@email.com" style="width:240px;padding:6px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-primary);font-family:var(--font-mono);font-size:0.82rem;">
            <button class="admin-btn-sm" id="saveEmailBtn">保存</button>
            <button class="admin-btn-sm" id="cancelEmailBtn" style="color:#ff4444;border-color:rgba(255,0,0,0.3)">取消</button>
          </div>
          <div class="profile-field">
            <span class="profile-label">角色</span>
            <span class="profile-value" style="color:var(--neon-cyan)">${user.role}</span>
          </div>
          <div class="profile-field">
            <span class="profile-label">REGISTERED</span>
            <span class="profile-value">--</span>
          </div>
        </div>
        <div class="about-section">
          <div class="section-title">修改密码</div>
          <div id="pwdMsg" style="display:none;font-family:var(--font-mono);font-size:0.8rem;padding:8px;border-radius:4px;margin-bottom:12px;"></div>
          <div class="profile-field">
            <span class="profile-label">旧密码</span>
            <input type="password" id="oldPwd" placeholder="当前密码" style="width:240px;padding:6px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-primary);font-family:var(--font-mono);font-size:0.82rem;">
          </div>
          <div class="profile-field">
            <span class="profile-label">新密码</span>
            <input type="password" id="newPwd" placeholder="新密码" style="width:240px;padding:6px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-primary);font-family:var(--font-mono);font-size:0.82rem;">
          </div>
          <div class="profile-field">
            <span class="profile-label">确认</span>
            <input type="password" id="newPwd2" placeholder="确认新密码" style="width:240px;padding:6px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-primary);font-family:var(--font-mono);font-size:0.82rem;">
          </div>
          <div class="admin-form-actions" style="justify-content:flex-start;margin-top:12px;">
            <button class="admin-btn submit" id="changePwdBtn">修改密码</button>
          </div>
        </div>
        <div class="about-section">
          <div class="section-title">我的收藏</div>
          <div id="favoritesList" style="color:var(--text-dim);font-family:var(--font-mono);font-size:0.82rem;">加载中...</div>
        </div>
      </div>
    </div>
  `;

  loadFavorites();

  // Edit email
  document.getElementById('editEmailBtn').addEventListener('click', () => {
    document.getElementById('editEmailForm').style.display = '';
    document.getElementById('editEmailBtn').style.display = 'none';
  });
  document.getElementById('cancelEmailBtn').addEventListener('click', () => {
    document.getElementById('editEmailForm').style.display = 'none';
    document.getElementById('editEmailBtn').style.display = '';
  });
  document.getElementById('saveEmailBtn').addEventListener('click', async () => {
    const email = document.getElementById('newEmail').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('邮箱格式不正确', 'warn');
      return;
    }
    try {
      const updated = await api.updateProfile({ email });
      document.getElementById('displayEmail').textContent = updated.email;
      document.getElementById('editEmailForm').style.display = 'none';
      document.getElementById('editEmailBtn').style.display = '';
      showToast('邮箱已更新', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Change password
  document.getElementById('changePwdBtn').addEventListener('click', async () => {
    const oldPwd = document.getElementById('oldPwd').value.trim();
    const newPwd = document.getElementById('newPwd').value.trim();
    const newPwd2 = document.getElementById('newPwd2').value.trim();
    const msgEl = document.getElementById('pwdMsg');

    if (!oldPwd || !newPwd || !newPwd2) {
      msgEl.textContent = '请填写所有密码字段';
      msgEl.style.display = 'block';
      msgEl.style.color = '#ff4444';
      msgEl.style.border = '1px solid rgba(255,0,0,0.3)';
      msgEl.style.background = 'rgba(255,0,0,0.06)';
      return;
    }
    try {
      await api.changePassword(oldPwd, newPwd, newPwd2);
      msgEl.textContent = '✓ 密码修改成功';
      msgEl.style.display = 'block';
      msgEl.style.color = 'var(--neon-green)';
      msgEl.style.border = '1px solid rgba(0,255,65,0.3)';
      msgEl.style.background = 'rgba(0,255,65,0.06)';
      document.getElementById('oldPwd').value = '';
      document.getElementById('newPwd').value = '';
      document.getElementById('newPwd2').value = '';
      setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.style.display = 'block';
      msgEl.style.color = '#ff4444';
      msgEl.style.border = '1px solid rgba(255,0,0,0.3)';
      msgEl.style.background = 'rgba(255,0,0,0.06)';
    }
  });
}

async function loadFavorites() {
  const container = document.getElementById('favoritesList');
  try {
    const favs = await api.getFavorites();
    if (!favs.length) { container.innerHTML = '<span style="color:var(--text-dim)">暂无收藏</span>'; return; }
    container.innerHTML = favs.map(a => `
      <div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer;" onclick="window.location.hash='#detail/${a.id}'">
        <span>${a.icon || '⬡'}</span>
        <span style="color:var(--neon-cyan);margin-left:6px;">${escapeHtml(a.title)}</span>
        <span style="color:var(--text-dim);margin-left:8px;font-size:0.7rem;">${a.date}</span>
      </div>
    `).join('');
  } catch { container.innerHTML = '<span style="color:#ff4444">加载失败</span>'; }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
