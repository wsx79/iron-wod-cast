(() => {
  'use strict';

  const sourceStatus = document.getElementById('statusText');
  const sourceTimer = document.getElementById('timerText');
  const sourceFooter = document.getElementById('footerText');
  const sourceTimeCap = document.getElementById('timeCapText');
  const standby = document.getElementById('standbyScreen');
  const clock = document.getElementById('standbyClock');
  const timerScreen = document.getElementById('ledScreen');

  function normalize(value) {
    return String(value || '').trim().toUpperCase();
  }

  function isIdleSource() {
    return normalize(sourceStatus.textContent) === 'IRON WOD' &&
      String(sourceTimer.textContent || '').trim() === '00:00' &&
      normalize(sourceFooter.textContent) === 'TIMER' &&
      !String(sourceTimeCap.textContent || '').trim();
  }

  function syncVisibility() {
    const idle = isIdleSource();
    standby.classList.toggle('hidden', !idle);
    timerScreen.classList.toggle('standby-hidden', idle);
  }

  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    clock.textContent = `${hh}:${mm}:${ss}`;
  }

  const observer = new MutationObserver(syncVisibility);
  [sourceStatus, sourceTimer, sourceFooter, sourceTimeCap].forEach(node => {
    observer.observe(node, { childList: true, subtree: true, characterData: true });
  });

  updateClock();
  syncVisibility();
  setInterval(updateClock, 250);
})();
