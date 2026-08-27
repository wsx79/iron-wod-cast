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

  // The standby screen has no active session of its own, so it can't read
  // the app's language the normal way. receiver.js remembers the most
  // recent voiceLanguage from a real timer message in localStorage; fall
  // back to the TV/Chromecast device's own locale only if no session has
  // ever reached this receiver yet.
  function resolveLocaleTag() {
    let stored = null;
    try { stored = localStorage.getItem('ironWodLastVoiceLanguage'); } catch (_) {}
    if (stored === 'it') return 'it-IT';
    if (stored === 'es') return 'es-ES';
    if (stored === 'en') return 'en-US';
    return navigator.language || 'it-IT';
  }

  let weekdayFormatter = null;
  let dateFormatter = null;
  let lastLocaleTag = '';

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

    // Weekday/date only change once a day (or when the app's language
    // changes); skip re-formatting on every tick otherwise.
    const localeTag = resolveLocaleTag();
    const dateKey = `${now.toDateString()}|${localeTag}`;
    if (dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      if (localeTag !== lastLocaleTag) {
        lastLocaleTag = localeTag;
        weekdayFormatter = new Intl.DateTimeFormat(localeTag, { weekday: 'long' });
        dateFormatter = new Intl.DateTimeFormat(localeTag, {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
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
