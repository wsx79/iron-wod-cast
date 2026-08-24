(() => {
  'use strict';

  /*
   * VISUAL MIRROR ONLY.
   * No Cast APIs are used here.
   * receiver.js remains the sole owner of receiving timer messages.
   */
  const sourceStatus = document.getElementById('statusText');
  const sourceTimer = document.getElementById('timerText');
  const sourceFooter = document.getElementById('footerText');
  const sourceTimeCap = document.getElementById('timeCapText');

  const screen = document.getElementById('ledScreen');
  const topCounter = document.getElementById('ledTopCounter');
  const status = document.getElementById('ledStatus');
  const timer = document.getElementById('ledTimer');
  const footer = document.getElementById('ledFooter');
  const timeCap = document.getElementById('ledTimeCap');
  const intervalBadge = document.getElementById('ledIntervalBadge');
  const intervalNumber = document.getElementById('ledIntervalNumber');
  const intervalLabel = document.getElementById('ledIntervalLabel');

  // Separate visual-layer alert. It has no Cast APIs and cannot interfere
  // with receiver.js. Used only when the configured interval step changes.
  const intervalAlert = new Audio('sounds/countdown.mp3');
  intervalAlert.preload = 'auto';
  intervalAlert.volume = 1.0;

  let lastIntervalKey = null;
  let hasSeenRunningInterval = false;

  const SEGMENTS = Object.freeze({
    '0': ['a','b','c','d','e','f'],
    '1': ['b','c'],
    '2': ['a','b','g','e','d'],
    '3': ['a','b','c','d','g'],
    '4': ['f','g','b','c'],
    '5': ['a','f','g','c','d'],
    '6': ['a','f','g','e','c','d'],
    '7': ['a','b','c'],
    '8': ['a','b','c','d','e','f','g'],
    '9': ['a','b','c','d','f','g']
  });

  function normalize(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function renderDigits(value) {
    const raw = String(value || '').trim();
    timer.textContent = '';
    timer.setAttribute('aria-label', raw);

    if (!/^[0-9:]+$/.test(raw)) {
      const fallback = document.createElement('div');
      fallback.className = 'fallback-timer-text';
      fallback.textContent = raw;
      timer.appendChild(fallback);
      return;
    }

    for (const ch of raw) {
      if (ch === ':') {
        const colon = document.createElement('span');
        colon.className = 'led-colon';
        timer.appendChild(colon);
        continue;
      }

      const digit = document.createElement('span');
      digit.className = 'led-char';
      const active = new Set(SEGMENTS[ch] || []);

      for (const part of ['a','b','c','d','e','f','g']) {
        const segment = document.createElement('span');
        segment.className = `led-seg led-${part}${active.has(part) ? ' on' : ''}`;
        digit.appendChild(segment);
      }

      timer.appendChild(digit);
    }
  }

  function stateFor(statusText) {
    const value = normalize(statusText);

    if (
      value === 'OTC' ||
      value.includes('OVER TIME CAP') ||
      value.includes('OLTRE TIME CAP')
    ) return 'state-otc';

    if (
      value.includes('COMPLET') ||
      value.includes('COMPLETE') ||
      value.includes('FINISH') ||
      value.includes('FINITO') ||
      value === 'DONE'
    ) return 'state-finished';

    if (value.includes('REST') || value.includes('RIPOSO') || value.includes('DESCANSO')) {
      return 'state-rest';
    }

    if (
      value.includes('CONFIGURA') ||
      value.includes('SET UP') ||
      value.includes('CONFIGURE') ||
      value.includes('CONFIGURAR')
    ) return 'state-config';

    if (
      value.includes('PREPAR') ||
      value.includes('GET READY') ||
      value === 'PREP'
    ) return 'state-prep';

    if (value.includes('PAUSA') || value.includes('PAUSED')) return 'state-paused';

    if (
      value.includes('WORK') ||
      value.includes('LAVORO') ||
      value.includes('TRABAJO')
    ) return 'state-work';

    return 'state-idle';
  }

  function setState(statusText) {
    const hasInterval = screen.classList.contains('has-interval');
    screen.className = `timer-screen ${stateFor(statusText)}`;
    if (hasInterval) screen.classList.add('has-interval');
  }

  function classifyFooterPart(value) {
    const n = normalize(value);
    if (n.startsWith('BLOCK') || n.startsWith('BLOCCO') || n.startsWith('BLOQUE')) {
      return 'footer-block';
    }
    if (
      n.startsWith('ROUND') ||
      n.startsWith('RONDA') ||
      n.startsWith('INTERVALLO') ||
      n.startsWith('INTERVALO')
    ) {
      return 'footer-round';
    }
    return 'footer-mode';
  }

  function parseIntervalStep(rawFooter) {
    const raw = String(rawFooter || '').trim();
    const normalized = normalize(raw);

    const patterns = [
      /INTERVALLO\s+(\d+)\s+DI\s+(\d+)/,
      /INTERVAL\s+(\d+)\s+OF\s+(\d+)/,
      /INTERVALO\s+(\d+)\s+DE\s+(\d+)/
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        return {
          current: Number(match[1]),
          total: Number(match[2])
        };
      }
    }

    return null;
  }

  function playIntervalAlert(interval) {
    if (!interval) return;

    const key = `${interval.current}/${interval.total}`;
    if (key === lastIntervalKey) return;

    lastIntervalKey = key;

    // Do not beep merely because a configuration screen is rendered.
    // The first real WORK/REST interval and every subsequent step change
    // receive one short alert.
    const statusValue = normalize(sourceStatus.textContent || '');
    const isRunningStep =
      statusValue.includes('WORK') ||
      statusValue.includes('REST') ||
      statusValue.includes('LAVORO') ||
      statusValue.includes('RIPOSO') ||
      statusValue.includes('TRABAJO') ||
      statusValue.includes('DESCANSO');

    if (!isRunningStep) return;

    hasSeenRunningInterval = true;

    try {
      intervalAlert.pause();
      intervalAlert.currentTime = 0;
      const result = intervalAlert.play();
      if (result && typeof result.catch === 'function') {
        result.catch(error => {
          console.warn('[IRON WOD LED] interval alert rejected:', error);
        });
      }
    } catch (error) {
      console.warn('[IRON WOD LED] interval alert failed:', error);
    }
  }

  function renderIntervalBadge(interval) {
    if (!interval) {
      intervalBadge.classList.add('hidden');
      screen.classList.remove('has-interval');
      return;
    }

    intervalNumber.textContent = String(interval.current).padStart(2, '0');
    intervalLabel.textContent = 'INTERVALLO';
    intervalBadge.classList.remove('hidden');
    screen.classList.add('has-interval');
    playIntervalAlert(interval);
  }

  function renderFooter(rawFooter, rawStatus) {
    const parts = String(rawFooter || '')
      .split('•')
      .map(part => part.trim())
      .filter(Boolean);

    footer.className = 'footer';

    if (!parts.length) {
      footer.textContent = 'TIMER';
      return;
    }

    footer.textContent = '';
    parts.forEach((part, index) => {
      if (index) {
        const sep = document.createElement('span');
        sep.className = 'footer-separator';
        sep.textContent = '  |  ';
        footer.appendChild(sep);
      }

      const node = document.createElement('span');
      node.className = classifyFooterPart(part);
      node.textContent = part;
      footer.appendChild(node);
    });
  }

  function sync() {
    const statusText = sourceStatus.textContent || '';
    const timerText = sourceTimer.textContent || '';
    const footerText = sourceFooter.textContent || '';
    const capText = sourceTimeCap.textContent || '';

    const activeInterval = parseIntervalStep(footerText);

    renderIntervalBadge(activeInterval);
    status.textContent = statusText;
    setState(statusText);
    renderDigits(timerText);
    renderFooter(footerText, statusText);

    timeCap.textContent = capText;
    timeCap.classList.toggle('hidden', !String(capText).trim());
  }

  const observer = new MutationObserver(sync);
  [sourceStatus, sourceTimer, sourceFooter, sourceTimeCap].forEach(node => {
    observer.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  });

  sync();
})();
