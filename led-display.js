(() => {
  'use strict';

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

  let intervalBadge = document.getElementById('ledIntervalBadge');
  let intervalNumber = document.getElementById('ledIntervalNumber');

  // Older MirrorSafe index may not have the badge. Create it safely.
  if (!intervalBadge) {
    intervalBadge = document.createElement('div');
    intervalBadge.id = 'ledIntervalBadge';
    intervalBadge.className = 'interval-badge hidden';

    intervalNumber = document.createElement('div');
    intervalNumber.id = 'ledIntervalNumber';
    intervalNumber.className = 'interval-number';
    intervalBadge.appendChild(intervalNumber);

    screen.appendChild(intervalBadge);
  }

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

  function parseRound(rawStatus) {
    const normalized = normalize(rawStatus);
    const match = normalized.match(/(?:ROUND|RONDA)\s+(\d+)\s*\/\s*(\d+)/);
    if (!match) return null;

    return {
      current: Number(match[1]),
      total: Number(match[2])
    };
  }

  function cleanStatus(rawStatus) {
    const cleaned = String(rawStatus || '')
      .replace(/\s*·?\s*(?:ROUND|RONDA)\s+\d+\s*\/\s*\d+/i, '')
      .trim();

    const normalized = normalize(cleaned);
    if (
      normalized === 'INTERVALS' ||
      normalized === 'INTERVALLI' ||
      normalized === 'INTERVALOS'
    ) {
      return '';
    }

    return cleaned;
  }

  function visualState(rawStatus) {
    const value = normalize(cleanStatus(rawStatus));

    if (value.includes('REST') || value.includes('RIPOSO') || value.includes('DESCANSO')) {
      return 'state-rest';
    }
    if (value.includes('WORK') || value.includes('LAVORO') || value.includes('TRABAJO')) {
      return 'state-work';
    }
    if (value.includes('PAUSA') || value.includes('PAUSED')) {
      return 'state-paused';
    }
    if (value.includes('PREPAR') || value.includes('GET READY')) {
      return 'state-prep';
    }
    if (value === 'OTC' || value.includes('OVER TIME CAP') || value.includes('OLTRE TIME CAP')) {
      return 'state-otc';
    }
    if (
      value.includes('COMPLET') ||
      value.includes('FINISH') ||
      value === 'DONE'
    ) {
      return 'state-finished';
    }
    if (
      value.includes('CONFIGURA') ||
      value.includes('SET UP') ||
      value.includes('CONFIGURE')
    ) {
      return 'state-config';
    }
    return 'state-idle';
  }

  function sync() {
    const rawStatus = sourceStatus.textContent || '';
    const timerText = sourceTimer.textContent || '';
    const capText = sourceTimeCap.textContent || '';
    const round = parseRound(rawStatus);
    const clean = cleanStatus(rawStatus);

    screen.className = `timer-screen ${visualState(rawStatus)}`;
    status.textContent = clean;
    renderDigits(timerText);

    // Structured Intervals: red round number at left, no blue round at top.
    if (round) {
      screen.classList.add('has-interval');
      intervalNumber.textContent = String(round.current).padStart(2, '0');
      intervalBadge.classList.remove('hidden');

      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      footer.textContent = `INTERVALLI ${round.current}/${round.total}`;
      footer.className = 'footer intervals-total-footer';
      footer.classList.remove('hidden');
    } else {
      intervalBadge.classList.add('hidden');
      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      // For non-Intervals keep the proven source footer for now.
      const sourceFooterText = String(sourceFooter.textContent || '').trim();
      footer.textContent = sourceFooterText;
      footer.className = 'footer';
      footer.classList.toggle('hidden', !sourceFooterText);
    }

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