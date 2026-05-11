/* ===========================
    3D 卡片翻转页面切换引擎
    纯 CSS 3D Transform 实现
    =========================== */

const pageNames = {
  home: 'ARTICLES',
  detail: 'DECRYPTING',
  projects: 'PROJECTS',
  about: 'ABOUT_ME',
  search: 'SEARCH',
  admin: 'ADMIN_PANEL',
};

export function triggerFlipTransition(fromRoute, toRoute) {
  const fromLabel = pageNames[fromRoute] || fromRoute.toUpperCase();
  const toLabel = pageNames[toRoute] || toRoute.toUpperCase();

  const overlay = document.createElement('div');
  overlay.className = 'flip-overlay';
  overlay.innerHTML = `
    <div class="flip-scene">
      <div class="flip-card">
        <div class="flip-card-face flip-card-front">
          <div class="flip-corner tl"></div>
          <div class="flip-corner tr"></div>
          <div class="flip-corner bl"></div>
          <div class="flip-corner br"></div>
          <span class="flip-label">EXITING</span>
          <span class="flip-page-name">// ${fromLabel}</span>
          <span class="flip-icon">⏎</span>
        </div>
        <div class="flip-card-face flip-card-back">
          <div class="flip-corner tl"></div>
          <div class="flip-corner tr"></div>
          <div class="flip-corner bl"></div>
          <div class="flip-corner br"></div>
          <span class="flip-label">ENTERING</span>
          <span class="flip-page-name">// ${toLabel}</span>
          <span class="flip-icon">⏎</span>
        </div>
      </div>
      <div class="flip-glow-line"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const card = overlay.querySelector('.flip-card');

  card.addEventListener(
    'transitionend',
    () => {
      setTimeout(() => overlay.remove(), 80);
    },
    { once: true }
  );

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      card.classList.add('flipping');
    });
  });
}

export function startParticleLoop() {}
export function triggerParticleTransition() {
  triggerFlipTransition('', '');
}
