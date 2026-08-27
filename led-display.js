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
  let intervalTotal = document.getElementById('ledIntervalTotal');

  // Visual mode memory only. This never touches Cast transport/audio.
  let activeVisualMode = '';

  // Older MirrorSafe index may not have the badge. Create it safely.
  if (!intervalBadge) {
    intervalBadge = document.createElement('div');
    intervalBadge.id = 'ledIntervalBadge';
    intervalBadge.className = 'interval-badge hidden';

    intervalNumber = document.createElement('div');
    intervalNumber.id = 'ledIntervalNumber';
    intervalNumber.className = 'interval-number';
    intervalBadge.appendChild(intervalNumber);

    // EMOM-only: smaller total-rounds number under the current round.
    // Hidden for Structured Intervals, which keeps its own frozen footer.
    intervalTotal = document.createElement('div');
    intervalTotal.id = 'ledIntervalTotal';
    intervalTotal.className = 'interval-total hidden';
    intervalBadge.appendChild(intervalTotal);

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

  function parseInterval(rawStatus) {
    const normalized = normalize(rawStatus);
    const match = normalized.match(
      /(?:INTERVALLO|INTERVALO|INTERVAL)\s+(\d+)\s*\/\s*(\d+)/
    );
    if (!match) return null;

    return {
      current: Number(match[1]),
      total: Number(match[2])
    };
  }

  function parseRound(rawFooter) {
    const normalized = normalize(rawFooter);
    const match = normalized.match(/(?:ROUND|RONDA)\s+(\d+)\s*\/\s*(\d+)/);
    if (!match) return null;

    return {
      current: Number(match[1]),
      total: Number(match[2])
    };
  }

  function cleanStatus(rawStatus) {
    const cleaned = String(rawStatus || '')
      .replace(
        /\s*·?\s*(?:INTERVALLO|INTERVALO|INTERVAL)\s+\d+\s*\/\s*\d+/i,
        ''
      )
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

  function parseTotalTime(rawFooter) {
    const normalized = normalize(rawFooter);
    const match = normalized.match(
      /(?:TEMPO TOTALE|TOTAL TIME|TIEMPO TOTAL)\s+([0-9]+:[0-9]{2})/
    );
    return match ? match[1] : null;
  }

  function isAmrapStatus(rawStatus) {
    return normalize(cleanStatus(rawStatus)) === 'AMRAP';
  }

  function isIdleSource(rawStatus, rawTimer, rawFooter) {
    return normalize(rawStatus) === 'IRON WOD' &&
      String(rawTimer || '').trim() === '00:00' &&
      normalize(rawFooter) === 'TIMER';
  }

  function renderAmrapFooter(rawFooter) {
    const text = String(rawFooter || '').trim();

    footer.className = 'footer amrap-footer';
    footer.classList.toggle('hidden', !text);

    if (!text) {
      footer.textContent = '';
      return;
    }

    // TimerBoard sends localized values such as:
    // "ROUND COMPLETATI: 3", "ROUNDS COMPLETED: 3", "RONDAS COMPLETADAS: 3".
    // Split the trailing number instead of depending on exact punctuation/language.
    const numberMatch = text.match(/(\d+)\s*$/);
    if (numberMatch) {
      const number = numberMatch[1];
      const label = text
        .slice(0, numberMatch.index)
        .replace(/\s*:\s*$/, '')
        .trim();

      if (label) {
        footer.innerHTML =
          `<span class="amrap-primary">${label}</span>` +
          `<span class="amrap-count">${number}</span>`;
        return;
      }
    }

    footer.textContent = text;
  }

  function parseEmomFooter(rawFooter) {
    const text = String(rawFooter || '').trim();
    const match = normalize(text).match(
      /^EMOM\s*[·\-]\s*ROUND\s+(\d+)\s*\/\s*(\d+)$/
    );
    if (!match) return null;
    return {
      current: Number(match[1]),
      total: Number(match[2])
    };
  }

  function sync() {
    const rawStatus = sourceStatus.textContent || '';
    const rawFooter = sourceFooter.textContent || '';
    const timerText = sourceTimer.textContent || '';
    const capText = sourceTimeCap.textContent || '';

    const interval = parseInterval(rawStatus);
    const round = parseRound(rawFooter);
    const totalTime = parseTotalTime(rawFooter);
    const emom = parseEmomFooter(rawFooter);
    const clean = cleanStatus(rawStatus);

    if (isIdleSource(rawStatus, timerText, rawFooter)) {
      activeVisualMode = '';
    } else if (interval) {
      activeVisualMode = 'INTERVALS';
    } else if (emom) {
      activeVisualMode = 'EMOM';
    } else if (isAmrapStatus(rawStatus)) {
      activeVisualMode = 'AMRAP';
    }

    screen.className = `timer-screen ${visualState(rawStatus)}`;
    status.textContent = clean;
    renderDigits(timerText);

    // Structured Intervals new protocol:
    // status = WORK/REST · INTERVALLO n/N
    // footer = ROUND x/y
    if (interval) {
      screen.classList.add('has-interval');

      // Big red current INTERVAL number on the left.
      intervalNumber.textContent = String(interval.current).padStart(2, '0');
      intervalBadge.classList.remove('hidden');
      intervalTotal.classList.add('hidden');

      // No extra blue counter at the top.
      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      // Bottom information:
      // ROUND mode -> ROUND x/y · INTERVALLI N
      // TIME mode  -> TEMPO TOTALE mm:ss · INTERVALLI N
      if (round) {
        footer.className = 'footer intervals-total-footer';
        footer.classList.remove('hidden');
        footer.innerHTML =
          `<span class="intervals-primary">ROUND ${round.current}/${round.total}</span>` +
          `<span class="intervals-separator"> · </span>` +
          `<span class="intervals-count">INTERVALLI ${interval.total}</span>`;
      } else if (totalTime) {
        footer.className = 'footer intervals-total-footer';
        footer.classList.remove('hidden');
        footer.innerHTML =
          `<span class="intervals-primary">TEMPO TOTALE ${totalTime}</span>` +
          `<span class="intervals-separator"> · </span>` +
          `<span class="intervals-count">INTERVALLI ${interval.total}</span>`;
      } else {
        footer.className = 'footer intervals-total-footer';
        footer.classList.remove('hidden');
        footer.innerHTML =
          `<span class="intervals-count">INTERVALLI ${interval.total}</span>`;
      }
    } else if (activeVisualMode === 'EMOM' && emom) {
      screen.classList.add('has-emom');

      // Big red current ROUND number on the left, smaller total rounds below it.
      intervalNumber.textContent = String(emom.current);
      intervalTotal.textContent = String(emom.total);
      intervalBadge.classList.remove('hidden');
      intervalTotal.classList.remove('hidden');

      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      // Round info now lives in the left badge; the bottom footer is unused.
      footer.textContent = '';
      footer.className = 'footer hidden';
    } else if (activeVisualMode === 'AMRAP') {
      screen.classList.add('has-amrap');

      intervalBadge.classList.add('hidden');
      intervalTotal.classList.add('hidden');
      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      renderAmrapFooter(rawFooter);
    } else {
      intervalBadge.classList.add('hidden');
      intervalTotal.classList.add('hidden');
      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      // Other timers are deliberately untouched for now.
      const sourceFooterText = String(rawFooter).trim();
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