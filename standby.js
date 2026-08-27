(() => {
  'use strict';

  const sourceStatus = document.getElementById('statusText');
  const sourceTimer = document.getElementById('timerText');
  const sourceFooter = document.getElementById('footerText');
  const sourceTimeCap = document.getElementById('timeCapText');
  const standby = document.getElementById('standbyScreen');
  const clock = document.getElementById('standbyClock');
  const weekday = document.getElementById('standbyWeekday');
  const dateLine = document.getElementById('standbyDate');
  const timerScreen = document.getElementById('ledScreen');

  // Uses the TV/Chromecast device's own locale (not the phone app's
  // language), since the standby screen has no active session to read a
  // language from. "lunedi 27 agosto 2026"-style names come for free from
  // Intl in whatever language the device is set to.
  const localeTag = navigator.language || 'it-IT';
  const weekdayFormatter = new Intl.DateTimeFormat(localeTag, { weekday: 'long' });
  const dateFormatter = new Intl.DateTimeFormat(localeTag, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

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

  let lastDateKey = '';

  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    clock.textContent = `${hh}:${mm}:${ss}`;

    // Weekday/date only change once a day; skip re-formatting on every tick.
    const dateKey = now.toDateString();
    if (dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      weekday.textContent = capitalize(weekdayFormatter.format(now));
      dateLine.textContent = capitalize(dateFormatter.format(now));
    }
  }

  const observer = new MutationObserver(syncVisibility);
  [sourceStatus, sourceTimer, sourceFooter, sourceTimeCap].forEach(node => {
    observer.observe(node, { childList: true, subtree: true, characterData: true });
  });

  updateClock();
  syncVisibility();
  setInterval(updateClock, 250);
})();
