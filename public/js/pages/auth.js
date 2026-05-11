/* ===========================
    登录/注册页组件
    =========================== */

import { api, setToken } from '../api.js';
import { triggerFlipTransition } from '../transition.js';

export function renderAuth(mode, onLoginSuccess) {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const isLogin = mode === 'login';

  main.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-icon">${isLogin ? '⛊' : '⧩'}</span>
          <h2 class="auth-title">// ${isLogin ? 'AUTH_LOGIN' : 'AUTH_REGISTER'}</h2>
          <p class="auth-subtitle">${isLogin ? 'sys.access_required' : 'sys.new_identity'}</p>
        </div>
        <form id="authForm" class="auth-form" autocomplete="off">
          <div class="admin-form-group">
            <label>USERNAME_</label>
            <input type="text" id="authUsername" placeholder="输入用户名" required autocomplete="off">
          </div>
          <div class="admin-form-group">
            <label>PASSWORD_</label>
            <input type="password" id="authPassword" placeholder="输入密码" required autocomplete="off">
          </div>
          ${!isLogin ? `
          <div class="admin-form-group">
            <label>ACCOUNT_TYPE_</label>
            <select id="authRole">
              <option value="user">普通用户</option>
              <option value="vip">VIP 用户 (需要邀请码)</option>
            </select>
          </div>
          <div class="admin-form-group" id="inviteCodeGroup" style="display:none">
            <label>INVITE_CODE_</label>
            <input type="text" id="authInviteCode" placeholder="输入VIP邀请码" autocomplete="off">
          </div>
          ` : ''}
          <div class="auth-error" id="authError" style="display:none"></div>
          <div class="admin-form-actions">
            <button type="button" class="admin-btn" id="authSwitch">
              ${isLogin ? '↗ REGISTER' : '↗ LOGIN'}
            </button>
            <button type="submit" class="admin-btn submit">
              ${isLogin ? 'AUTHENTICATE' : 'REGISTER'}
            </button>
          </div>
        </form>
      </div>
      <div class="auth-hint">
        <span class="tag-item">superadmin / admin123 (超级管理员)</span>
        <span class="tag-item">admin2 / admin456 (二级管理员)</span>
        <span class="tag-item">vipuser / vip123 (VIP用户)</span>
        <span class="tag-item">normal / user123 (普通用户)</span>
      </div>
    </div>
  `;

  // Show/hide invite code field based on role selection
  if (!isLogin) {
    const roleSelect = document.getElementById('authRole');
    const inviteGroup = document.getElementById('inviteCodeGroup');
    roleSelect.addEventListener('change', () => {
      inviteGroup.style.display = roleSelect.value === 'vip' ? 'block' : 'none';
    });
  }

  document.getElementById('authSwitch').addEventListener('click', () => {
    triggerFlipTransition('auth', isLogin ? 'register' : 'login');
    renderAuth(isLogin ? 'register' : 'login', onLoginSuccess);
  });

  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    const errEl = document.getElementById('authError');

    if (!username || !password) {
      errEl.textContent = '用户名和密码不能为空';
      errEl.style.display = 'block';
      return;
    }

    try {
      let result;
      if (isLogin) {
        result = await api.login(username, password);
      } else {
        const role = document.getElementById('authRole').value;
        const inviteCode = role === 'vip' ? document.getElementById('authInviteCode').value.trim() : null;
        result = await api.register(username, password, role, inviteCode);
      }

      setToken(result.token);

      if (onLoginSuccess) {
        onLoginSuccess(result.user);
      }

      window.location.hash = '#home';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}
