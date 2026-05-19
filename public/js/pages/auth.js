/* ===========================
    登录/注册页组件
    邮箱验证码 + 密码强度 + 确认密码
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
          <h2 class="auth-title">// ${isLogin ? '账号登录' : '账号注册'}</h2>
          <p class="auth-subtitle">${isLogin ? '输入账号密码' : '创建新账号'}</p>
        </div>
        <form id="authForm" class="auth-form" autocomplete="off">
          <div class="admin-form-group">
            <label>用户名</label>
            <input type="text" id="authUsername" placeholder="3-20位用户名" required autocomplete="off" maxlength="20">
          </div>
          ${!isLogin ? `
          <div class="admin-form-group">
            <label>邮箱</label>
            <input type="email" id="authEmail" placeholder="your@email.com" required autocomplete="off">
            <button type="button" class="admin-btn" id="sendCodeBtn" style="margin-top:8px;font-size:0.78rem;padding:6px 14px;">发送验证码</button>
            <span id="codeCountdown" style="display:none;font-family:var(--font-mono);font-size:0.75rem;color:var(--neon-magenta);margin-left:8px;"></span>
          </div>
          <div class="admin-form-group">
            <label>验证码</label>
            <input type="text" id="authVerifyCode" placeholder="输入邮箱验证码" required autocomplete="off" maxlength="6">
          </div>
          ` : ''}
          <div class="admin-form-group">
            <label>密码</label>
            <input type="password" id="authPassword" placeholder="6-72位密码" required autocomplete="off">
            ${!isLogin ? '<div class="password-strength" id="pwdStrength"></div>' : ''}
          </div>
          ${!isLogin ? `
          <div class="admin-form-group">
            <label>确认密码</label>
            <input type="password" id="authPassword2" placeholder="再次输入密码" required autocomplete="off">
            <span id="pwdMatchHint" style="display:none;font-family:var(--font-mono);font-size:0.72rem;"></span>
          </div>
          <div class="admin-form-group">
            <label>账号类型</label>
            <select id="authRole">
              <option value="user">普通用户</option>
              <option value="vip">会员用户 (需要邀请码)</option>
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
              ${isLogin ? '↗ 去注册' : '↗ 去登录'}
            </button>
            ${isLogin ? '<a href="#forgot-password" class="admin-btn" style="text-decoration:none;">忘记密码?</a>' : ''}
            <button type="submit" class="admin-btn submit" id="authSubmit">
              ${isLogin ? '登录' : '注册'}
            </button>
          </div>
        </form>
      </div>
      <div class="auth-hint">
        <span class="tag-item">superadmin / admin123 (管理员)</span>
        <span class="tag-item">admin2 / admin456 (小编)</span>
        <span class="tag-item">vipuser / vip123 (会员)</span>
        <span class="tag-item">normal / user123 (普通)</span>
      </div>
    </div>
  `;

  // ========== 注册页额外逻辑 ==========
  if (!isLogin) {
    const roleSelect = document.getElementById('authRole');
    const inviteGroup = document.getElementById('inviteCodeGroup');
    roleSelect.addEventListener('change', () => {
      inviteGroup.style.display = roleSelect.value === 'vip' ? 'block' : 'none';
    });

    // 密码强度实时检测
    const pwdInput = document.getElementById('authPassword');
    const pwdStrength = document.getElementById('pwdStrength');
    pwdInput.addEventListener('input', () => {
      const pwd = pwdInput.value;
      if (!pwd) {
        pwdStrength.innerHTML = '';
        return;
      }
      let score = 0;
      if (pwd.length >= 6) score++;
      if (pwd.length >= 10) score++;
      if (/[A-Z]/.test(pwd)) score++;
      if (/[a-z]/.test(pwd)) score++;
      if (/\d/.test(pwd)) score++;
      if (/[^A-Za-z0-9]/.test(pwd)) score++;

      let color, text;
      if (score <= 1) { color = '#ff4444'; text = '弱 ░░░░░░'; }
      else if (score <= 3) { color = '#ffe600'; text = '中 ███░░░'; }
      else if (score <= 5) { color = '#00ff41'; text = '强 █████░'; }
      else { color = '#00ffff'; text = '极强 ██████'; }

      pwdStrength.innerHTML = `<span style="color:${color}">${text} (${score}/6)</span>`;
    });

    // 密码确认实时比对
    const pwd2Input = document.getElementById('authPassword2');
    const pwdMatchHint = document.getElementById('pwdMatchHint');
    const checkMatch = () => {
      const p1 = pwdInput.value;
      const p2 = pwd2Input.value;
      if (!p2) { pwdMatchHint.style.display = 'none'; return; }
      pwdMatchHint.style.display = 'inline';
      if (p1 === p2) {
        pwdMatchHint.textContent = '✓ 密码一致';
        pwdMatchHint.style.color = 'var(--neon-green)';
      } else {
        pwdMatchHint.textContent = '✕ 密码不一致';
        pwdMatchHint.style.color = '#ff4444';
      }
    };
    pwdInput.addEventListener('input', checkMatch);
    pwd2Input.addEventListener('input', checkMatch);

    // 发送验证码 + 60秒倒计时
    const sendBtn = document.getElementById('sendCodeBtn');
    const countdown = document.getElementById('codeCountdown');
    let countdownTimer = null;

    sendBtn.addEventListener('click', async () => {
      const email = document.getElementById('authEmail').value.trim();
      if (!email) {
        document.getElementById('authError').textContent = '请先输入邮箱';
        document.getElementById('authError').style.display = 'block';
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById('authError').textContent = '邮箱格式不正确';
        document.getElementById('authError').style.display = 'block';
        return;
      }
      try {
        sendBtn.disabled = true;
        await api.sendVerifyCode(email);
        showToast('验证码已发送，请查收邮箱', 'info');
        let sec = 60;
        countdown.style.display = 'inline';
        countdown.textContent = `${sec}s`;
        clearInterval(countdownTimer);
        countdownTimer = setInterval(() => {
          sec--;
          countdown.textContent = `${sec}s`;
          if (sec <= 0) {
            clearInterval(countdownTimer);
            countdown.style.display = 'none';
            sendBtn.disabled = false;
          }
        }, 1000);
      } catch (err) {
        sendBtn.disabled = false;
        document.getElementById('authError').textContent = err.message;
        document.getElementById('authError').style.display = 'block';
      }
    });
  }

  // 切换登录/注册
  document.getElementById('authSwitch').addEventListener('click', () => {
    triggerFlipTransition('auth', isLogin ? 'register' : 'login');
    renderAuth(isLogin ? 'register' : 'login', onLoginSuccess);
  });

  // 提交
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

    const submitBtn = document.getElementById('authSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = '...';

    try {
      let result;
      if (isLogin) {
        result = await api.login(username, password);
      } else {
        const password2 = document.getElementById('authPassword2').value.trim();
        const email = document.getElementById('authEmail').value.trim();
        const role = document.getElementById('authRole').value;
        const inviteCode = role === 'vip' ? document.getElementById('authInviteCode').value.trim() : null;
        const verifyCode = document.getElementById('authVerifyCode').value.trim();
        result = await api.register(username, password, password2, email, role, inviteCode, verifyCode);
      }

      setToken(result.token);
      if (onLoginSuccess) onLoginSuccess(result.user);
      window.location.hash = '#home';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? '登录' : '注册';
    }
  });
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
