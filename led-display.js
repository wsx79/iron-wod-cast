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
    if (
      value === 'OTC' ||
      value.includes('OVER TIME CAP') ||
      value.includes('OLTRE TIME CAP') ||
      value.includes('FUERA DEL TIME CAP')
    ) {
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

  function parseAmrapRoundCount(rawFooter) {
    // TimerBoard sends localized values such as:
    // "ROUND COMPLETATI: 3", "ROUNDS COMPLETED: 3", "RONDAS COMPLETADAS: 3".
    // Read the trailing number instead of depending on exact punctuation/language,
    // and reuse the label itself (already correctly localized by the app) for the
    // two-line caption under the badge instead of hardcoding it per language here.
    const text = String(rawFooter || '').trim();
    const match = text.match(/(\d+)\s*$/);
    const count = match ? match[1] : '0';
    const label = match
      ? text.slice(0, match.index).replace(/\s*:\s*$/, '').trim()
      : '';
    const lastSpace = label.lastIndexOf(' ');
    const labelLines = lastSpace > -1
      ? [label.slice(0, lastSpace), label.slice(lastSpace + 1)]
      : [label];
    return { count, labelLines };
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

  // Countdown / Count Up: no rounds at all, just WORK-style running status.
  function isPlainTimerStatus(rawStatus) {
    const value = normalize(cleanStatus(rawStatus));
    return value === 'COUNTDOWN' || value === 'COUNT UP';
  }

  // For Time: no rounds, elapsed clock with an optional soft time cap. It
  // never has an "INTERVALLO"/"EMOM ·"/"ROUND x/y" footer, but its footer is
  // always either "TIME CAP mm:ss" or the localized "NO TIME CAP" label.
  function isForTimeFooter(rawFooter) {
    return normalize(rawFooter).includes('TIME CAP');
  }

  // Structured/library WODs (StructuredWorkoutTimerScreen, e.g. a multi-block
  // benchmark like "Fight Gone Bad") always send literal "WORK"/"REST" status
  // text and a "ROUND x/y  •  MODE  •  BLOCCO n/m" footer, never the exact
  // shapes the standalone screens use. A round-bearing sub-block (EMOM/AMRAP/
  // Tabata-style) already matches roundsMode above via its "ROUND x/y"
  // segment. A round-less sub-block (Countdown/Count Up/For Time without its
  // own rounds) never matches anything else, so it falls back to PLAIN here
  // instead of the old untouched/tiny generic style. "MODE" itself is always
  // one of BuilderWorkoutType's English literal labels (COUNTDOWN, COUNT UP,
  // FOR TIME, EMOM, AMRAP, TABATA, INTERVALS, MANUAL INTERVALS), regardless
  // of the app's display language, since that enum label is never localized.
  const PLAIN_BLOCK_LABELS = /^(COUNTDOWN|COUNT UP|FOR TIME)$/;

  function stripPlainModeLabel(rawFooter) {
    return String(rawFooter || '')
      .split(/\s*•\s*/)
      .map(segment => segment.trim())
      .filter(segment => segment && !PLAIN_BLOCK_LABELS.test(normalize(segment)))
      .join('  •  ');
  }

  // True only when the footer contains one of the round-less block-type
  // words as its own "  •  "-joined segment. This is the ONLY reliable
  // signal that we're looking at a structured/library WOD's round-less
  // sub-block (Countdown/Count Up/For Time chained inside a multi-block
  // WOD) rather than any other screen's prep/rest/paused status — those
  // never put a bare block-type word in their footer, so this never
  // fires for them.
  function hasPlainBlockFooter(rawFooter) {
    return String(rawFooter || '')
      .split(/\s*•\s*/)
      .some(segment => PLAIN_BLOCK_LABELS.test(normalize(segment.trim())));
  }

  // Visual-only relabel of the running "FOR TIME" status to "IN TIME"
  // (green instead of orange). Every other For Time status (GET READY,
  // OLTRE TIME CAP/OVER TIME CAP/FUERA DEL TIME CAP, COMPLETATO..., PAUSED,
  // SET UP TIMER) is left exactly as sent.
  function relabelForTimeStatus(cleanedStatus) {
    return normalize(cleanedStatus) === 'FOR TIME' ? 'IN TIME' : cleanedStatus;
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

    // Tabata / manual Intervals: bare WORK/REST status + plain "ROUND x / y"
    // footer, no INTERVALLO suffix (Structured Intervals) and no "EMOM ·"
    // prefix. Both screens send the identical shape, so they share one mode.
    const roundsMode = !interval && !emom && round;
    // For Time: no rounds, footer is always "TIME CAP mm:ss" or "NO TIME CAP".
    const forTimeMode = !interval && !emom && !round && isForTimeFooter(rawFooter);

    if (isIdleSource(rawStatus, timerText, rawFooter)) {
      activeVisualMode = '';
    } else if (interval) {
      activeVisualMode = 'INTERVALS';
    } else if (emom) {
      activeVisualMode = 'EMOM';
    } else if (roundsMode) {
      activeVisualMode = 'ROUNDS';
    } else if (isAmrapStatus(rawStatus)) {
      activeVisualMode = 'AMRAP';
    } else if (isPlainTimerStatus(rawStatus)) {
      activeVisualMode = 'PLAIN';
    } else if (forTimeMode) {
      activeVisualMode = 'FORTIME';
    } else if (hasPlainBlockFooter(rawFooter)) {
      // A round-less sub-block chained inside a structured/library WOD
      // (Countdown/Count Up): same enlarged plain-clock family treatment as
      // the standalone Countdown/Count Up screens. Gated specifically on the
      // footer carrying one of those block-type words, NOT on "any non-idle
      // status" — every other screen's prep/rest/paused status must keep
      // falling through untouched below, exactly as before.
      activeVisualMode = 'PLAIN';
    }

    const state = visualState(rawStatus);
    screen.className = `timer-screen ${state}`;
    status.textContent = activeVisualMode === 'FORTIME' ? relabelForTimeStatus(clean) : clean;
    renderDigits(timerText);

    // EMOM/Tabata/manual Intervals send their round footer from the very
    // start, including during the preparation countdown before round 1
    // begins. For Time's "TIME CAP..." footer is likewise present from the
    // very start. Structured Intervals only exposes its INTERVALLO status
    // once WORK is actually running. Gate all of these on the same rule so
    // the preparation countdown always renders as a plain centered/orange
    // digit like every other mode, never the family's badge/right-aligned
    // treatment. AMRAP is included too: after a first run, activeVisualMode
    // stays 'AMRAP' from the previous session, so a second preparation
    // countdown (re-Start) needs the same guard, not just the very first one.
    const emomActive = emom && state !== 'state-prep';
    const roundsActive = activeVisualMode === 'ROUNDS' && round && state !== 'state-prep';
    const forTimeActive = activeVisualMode === 'FORTIME' && state !== 'state-prep';
    const amrapActive = activeVisualMode === 'AMRAP' && state !== 'state-prep';

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
      const intervalsCountHtml =
        `<span class="intervals-count">INTERVALLI ` +
        `<span class="intervals-count-number">${interval.total}</span></span>`;
      if (round) {
        footer.className = 'footer intervals-total-footer';
        footer.classList.remove('hidden');
        footer.innerHTML =
          `<span class="intervals-primary">ROUND ${round.current}/${round.total}</span>` +
          `<span class="intervals-separator"> · </span>` +
          intervalsCountHtml;
      } else if (totalTime) {
        footer.className = 'footer intervals-total-footer';
        footer.classList.remove('hidden');
        footer.innerHTML =
          `<span class="intervals-primary">TEMPO TOTALE ${totalTime}</span>` +
          `<span class="intervals-separator"> · </span>` +
          intervalsCountHtml;
      } else {
        footer.className = 'footer intervals-total-footer';
        footer.classList.remove('hidden');
        footer.innerHTML = intervalsCountHtml;
      }
    } else if (activeVisualMode === 'EMOM' && emomActive) {
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
    } else if (activeVisualMode === 'ROUNDS' && roundsActive) {
      screen.classList.add('has-rounds');

      // Tabata / manual Intervals: same left-badge language as EMOM.
      intervalNumber.textContent = String(round.current);
      intervalTotal.textContent = String(round.total);
      intervalBadge.classList.remove('hidden');
      intervalTotal.classList.remove('hidden');

      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      // Round info now lives in the left badge; the bottom footer is unused.
      footer.textContent = '';
      footer.className = 'footer hidden';
    } else if (amrapActive) {
      screen.classList.add('has-amrap');

      // Big red completed-rounds count on the left, same language as
      // Structured Intervals/EMOM. Underneath it, the app's own localized
      // "ROUND COMPLETATI"/"ROUNDS COMPLETED"/"RONDAS COMPLETADAS" caption,
      // split across two lines instead of a second number (AMRAP has no
      // fixed total).
      const amrapRound = parseAmrapRoundCount(rawFooter);
      intervalNumber.textContent = amrapRound.count;
      intervalTotal.textContent = '';
      amrapRound.labelLines.forEach(line => {
        const lineEl = document.createElement('div');
        lineEl.textContent = line;
        intervalTotal.appendChild(lineEl);
      });
      intervalBadge.classList.remove('hidden');
      intervalTotal.classList.remove('hidden');

      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      // Round count now lives in the left badge; the bottom footer is unused.
      footer.textContent = '';
      footer.className = 'footer hidden';
    } else if (activeVisualMode === 'PLAIN') {
      screen.classList.add('has-plain');

      // No rounds at all (Countdown/Count Up, or the same sub-block chained
      // inside a structured/library WOD): just the enlarged clock, full
      // width, no left badge. The block-type word itself (COUNTDOWN/COUNT
      // UP/FOR TIME) is stripped from the footer since it adds nothing once
      // the clock is already shown enlarged; any round/block info alongside
      // it is kept and shown bigger, same family treatment as For Time.
      intervalBadge.classList.add('hidden');
      intervalTotal.classList.add('hidden');
      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      const sourceFooterText = stripPlainModeLabel(rawFooter);
      footer.textContent = sourceFooterText;
      footer.className = 'footer plain-footer';
      footer.classList.toggle('hidden', !sourceFooterText);
    } else if (forTimeActive) {
      screen.classList.add('has-fortime');

      // No rounds at all: just the enlarged clock, full width, no left
      // badge. The time cap footer ("TIME CAP mm:ss" / "NO TIME CAP") is
      // shown bigger than the generic footer used by other screens.
      intervalBadge.classList.add('hidden');
      intervalTotal.classList.add('hidden');
      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      const sourceFooterText = String(rawFooter).trim();
      footer.textContent = sourceFooterText;
      footer.className = 'footer fortime-footer';
      footer.classList.toggle('hidden', !sourceFooterText);
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