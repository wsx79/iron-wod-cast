(() => {
  'use strict';

  /*
   * VISUAL MIRROR ONLY.
   * receiver.js remains the sole owner of Cast transport and audio.
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
      value.includes('TIME UP') ||
      value.includes('TEMPO TERMINATO') ||
      value.includes('TEMPO SCADUTO') ||
      value === 'DONE'
    ) return 'state-finished';

    if (
      value.includes('REST') ||
      value.includes('RIPOSO') ||
      value.includes('RECUPERO') ||
      value.includes('DESCANSO')
    ) return 'state-rest';

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

  function extractRound(rawStatus, rawFooter) {
    const combined = normalize(`${rawStatus || ''} ${rawFooter || ''}`);

    const standard = combined.match(/(?:ROUND|RONDA)\s+(\d+)\s*\/\s*(\d+)/);
    if (standard) {
      return {
        label: `ROUND ${standard[1]}/${standard[2]}`,
        current: Number(standard[1]),
        total: Number(standard[2])
      };
    }

    const legacy = combined.match(
      /(?:INTERVALLO\s+(\d+)\s+DI\s+(\d+)|INTERVAL\s+(\d+)\s+OF\s+(\d+)|INTERVALO\s+(\d+)\s+DE\s+(\d+))/
    );
    if (legacy) {
      const current = legacy[1] || legacy[3] || legacy[5];
      const total = legacy[2] || legacy[4] || legacy[6];
      return {
        label: `ROUND ${current}/${total}`,
        current: Number(current),
        total: Number(total)
      };
    }

    const completed = combined.match(
      /(?:ROUND COMPLETATI|ROUNDS COMPLETED|RONDAS COMPLETADAS)\s+(\d+)/
    );
    if (completed) {
      return {
        label: `ROUND ${completed[1]}`,
        current: Number(completed[1]),
        total: null
      };
    }

    return null;
  }

  function stripRoundFromStatus(rawStatus) {
    return String(rawStatus || '')
      .replace(/\s*·?\s*(?:ROUND|RONDA)\s+\d+\s*\/\s*\d+/i, '')
      .trim();
  }

  function isStaticModeLabel(value) {
    const n = normalize(value);
    return (
      n === 'AMRAP' ||
      n === 'FOR TIME' ||
      n === 'COUNTDOWN' ||
      n === 'COUNT UP'
    );
  }

  function cleanStatus(rawStatus) {
    const withoutRound = stripRoundFromStatus(rawStatus);
    return isStaticModeLabel(withoutRound) ? '' : withoutRound;
  }

  function isUsefulFooterPart(value) {
    const n = normalize(value);

    if (!n) return false;

    // Static/redundant mode labels are intentionally hidden.
    if (
      n === 'AMRAP' ||
      n === 'FOR TIME' ||
      n === 'COUNTDOWN' ||
      n === 'COUNT UP' ||
      n === 'EMOM' ||
      n === 'TABATA' ||
      n === 'INTERVALS' ||
      n === 'INTERVALLI'
    ) return false;

    // Round data is moved to the top status line.
    if (
      n.startsWith('ROUND') ||
      n.startsWith('RONDA') ||
      n.startsWith('INTERVALLO') ||
      n.startsWith('INTERVALO') ||
      n.startsWith('INTERVAL ')
    ) return false;

    // Redundant generic captions.
    if (
      n.includes('TEMPO RIMANENTE') ||
      n.includes('TIME REMAINING') ||
      n.includes('TIEMPO RESTANTE') ||
      n.includes('TEMPO TRASCORSO') ||
      n.includes('ELAPSED TIME') ||
      n.includes('TIEMPO TRANSCURRIDO') ||
      n.includes('NO TIME CAP') ||
      n.includes('SENZA TIME CAP')
    ) return false;

    return true;
  }

  function footerClass(value) {
    const n = normalize(value);
    if (n.startsWith('BLOCK') || n.startsWith('BLOCCO') || n.startsWith('BLOQUE')) {
      return 'footer-block';
    }
    return 'footer-mode';
  }

  function renderFooter(rawFooter) {
    const parts = String(rawFooter || '')
      .split('•')
      .map(part => part.trim())
      .filter(isUsefulFooterPart);

    footer.className = 'footer';

    if (!parts.length) {
      footer.textContent = '';
      footer.classList.add('hidden');
      return;
    }

    footer.classList.remove('hidden');
    footer.textContent = '';

    parts.forEach((part, index) => {
      if (index) {
        const sep = document.createElement('span');
        sep.className = 'footer-separator';
        sep.textContent = '  |  ';
        footer.appendChild(sep);
      }

      const node = document.createElement('span');
      node.className = footerClass(part);
      node.textContent = part;
      footer.appendChild(node);
    });
  }

  function applyState(statusText, roundInfo) {
    const state = stateFor(statusText);
    screen.className = `timer-screen ${state}`;

    const clean = cleanStatus(statusText);
    status.textContent = clean;

    const normalizedClean = normalize(clean);
    const isIntervalsState =
      !!roundInfo &&
      (
        normalizedClean === 'WORK' ||
        normalizedClean === 'REST' ||
        normalizedClean === 'LAVORO' ||
        normalizedClean === 'RIPOSO' ||
        normalizedClean === 'TRABAJO' ||
        normalizedClean === 'DESCANSO' ||
        normalizedClean === 'PAUSA' ||
        normalizedClean === 'PAUSED'
      );

    if (isIntervalsState) {
      // Intervals keeps the approved gym-timer layout:
      // large red current round number on the left.
      intervalNumber.textContent = String(roundInfo.current).padStart(2, '0');
      intervalLabel.textContent = '';
      intervalBadge.classList.remove('hidden');
      screen.classList.add('has-interval');

      // No blue ROUND n/N at the top for Intervals.
      topCounter.textContent = '';
      topCounter.classList.add('hidden');
    } else if (roundInfo) {
      topCounter.textContent = roundInfo.label;
      topCounter.classList.remove('hidden');
      screen.classList.add('has-round');
      intervalBadge.classList.add('hidden');
    } else {
      topCounter.textContent = '';
      topCounter.classList.add('hidden');
      intervalBadge.classList.add('hidden');
    }

    if (!clean) {
      screen.classList.add('status-hidden');
    }
  }

  function renderIntervalsBottomInfo(rawStatus, roundInfo) {
    const clean = normalize(cleanStatus(rawStatus));
    const isWorkOrRest =
      clean === 'WORK' ||
      clean === 'REST' ||
      clean === 'LAVORO' ||
      clean === 'RIPOSO' ||
      clean === 'TRABAJO' ||
      clean === 'DESCANSO';

    if (!isWorkOrRest || !roundInfo || !roundInfo.total) {
      return false;
    }

    footer.className = 'footer intervals-total-footer';
    footer.classList.remove('hidden');
    footer.textContent = `INTERVALLI ${roundInfo.current}/${roundInfo.total}`;
    return true;
  }

  function sync() {
    const rawStatus = sourceStatus.textContent || '';
    const timerText = sourceTimer.textContent || '';
    const footerText = sourceFooter.textContent || '';
    const capText = sourceTimeCap.textContent || '';

    const roundInfo = extractRound(rawStatus, footerText);

    applyState(rawStatus, roundInfo);
    renderDigits(timerText);

    const renderedIntervalsInfo = renderIntervalsBottomInfo(rawStatus, roundInfo);
    if (!renderedIntervalsInfo) {
      renderFooter(footerText);
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