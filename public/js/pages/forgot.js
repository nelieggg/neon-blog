/* ===========================
    忘记密码 / 重置密码页
    =========================== */

import { api } from '../api.js';
import { triggerFlipTransition } from '../transition.js';

export function renderForgotPassword() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-icon">🔄</span>
          <h2 class="auth-title">// 忘记密码</h2>
          <p class="auth-subtitle">输入注册邮箱，接收重置链接</p>
        </div>
        <form id="forgotForm" autocomplete="off">
          <div class="admin-form-group">
            <label>邮箱</label>
            <input type="email" id="forgotEmail" placeholder="your@email.com" required autocomplete="off">
          </div>
          <div class="auth-error" id="forgotError" style="display:none"></div>
          <div class="auth-success" id="forgotSuccess" style="display:none"></div>
          <div class="admin-form-actions">
            <button type="button" class="admin-btn" id="backToLogin">◂ 返回登录</button>
            <button type="submit" class="admin-btn submit">发送重置链接</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('backToLogin').addEventListener('click', () => {
    window.location.hash = '#login';
  });

  document.getElementById('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    const errEl = document.getElementById('forgotError');
    const successEl = document.getElementById('forgotSuccess');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent = '请输入有效的邮箱地址';
      errEl.style.display = 'block';
      return;
    }

    errEl.style.display = 'none';
    try {
      const result = await api.forgotPassword(email);
      successEl.innerHTML = `
        <p>${result.message}</p>
        <p class="auth-subtitle" style="margin-top:8px;">${email}</p>
      `;
      successEl.style.display = 'block';
      document.getElementById('forgotForm').style.display = 'none';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}

export function renderResetPassword(token) {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <span class="auth-icon">🔑</span>
          <h2 class="auth-title">// 重置密码</h2>
          <p class="auth-subtitle">输入新密码完成重置</p>
        </div>
        <form id="resetForm" autocomplete="off">
          <div class="admin-form-group">
            <label>新密码</label>
            <input type="password" id="resetPwd" placeholder="6-72位新密码" required autocomplete="off">
            <div class="password-strength" id="pwdStrength"></div>
          </div>
          <div class="admin-form-group">
            <label>确认密码</label>
            <input type="password" id="resetPwd2" placeholder="再次输入密码" required autocomplete="off">
            <span id="pwdMatchHint" style="display:none;font-family:var(--font-mono);font-size:0.72rem;"></span>
          </div>
          <div class="auth-error" id="resetError" style="display:none"></div>
          <div class="auth-success" id="resetSuccess" style="display:none"></div>
          <div class="admin-form-actions">
            <button type="button" class="admin-btn" id="backToLogin">◂ BACK_TO_LOGIN</button>
            <button type="submit" class="admin-btn submit">RESET</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Password strength check
  const pwdInput = document.getElementById('resetPwd');
  const pwdStrength = document.getElementById('pwdStrength');
  pwdInput.addEventListener('input', () => {
    const p = pwdInput.value;
    if (!p) { pwdStrength.innerHTML = ''; return; }
    let s = 0;
    if (p.length >= 6) s++; if (p.length >= 10) s++;
    if (/[A-Z]/.test(p)) s++; if (/[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
    let color, text;
    if (s <= 1) { color = '#ff4444'; text = '弱'; }
    else if (s <= 3) { color = '#ffe600'; text = '中'; }
    else if (s <= 5) { color = '#00ff41'; text = '强'; }
    else { color = '#00ffff'; text = '极强'; }
    pwdStrength.innerHTML = `<span style="color:${color}">${text} (${s}/6)</span>`;
  });

  // Password match check
  const pwd2Input = document.getElementById('resetPwd2');
  const matchHint = document.getElementById('pwdMatchHint');
  const checkMatch = () => {
    if (!pwd2Input.value) { matchHint.style.display = 'none'; return; }
    matchHint.style.display = 'inline';
    matchHint.textContent = pwdInput.value === pwd2Input.value ? '✓ 密码一致' : '✕ 密码不一致';
    matchHint.style.color = pwdInput.value === pwd2Input.value ? 'var(--neon-green)' : '#ff4444';
  };
  pwdInput.addEventListener('input', checkMatch);
  pwd2Input.addEventListener('input', checkMatch);

  document.getElementById('backToLogin').addEventListener('click', () => {
    window.location.hash = '#login';
  });

  document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('resetError');
    const successEl = document.getElementById('resetSuccess');
    try {
      await api.resetPassword(token, pwdInput.value.trim(), pwd2Input.value.trim());
      successEl.textContent = '密码重置成功！即将跳转到登录页...';
      successEl.style.display = 'block';
      errEl.style.display = 'none';
      document.getElementById('resetForm').style.display = 'none';
      setTimeout(() => { window.location.hash = '#login'; }, 2000);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      successEl.style.display = 'none';
    }
  });
}
