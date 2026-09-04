(() => {
  'use strict';

  // TEMPORARY - lets the debug overlay in index.html prove which build of this
  // file is actually running (bump alongside the ?v= cache-busting query
  // string in index.html so a screenshot can never be mistaken for a stale
  // build again). Remove alongside the rest of the debug overlay.
  window.ironWodLedDisplayVersion = '20260904-8';

  const sourceStatus = document.getElementById('statusText');
  const sourceTimer = document.getElementById('timerText');
  const sourceFooter = document.getElementById('footerText');
  const sourceTimeCap = document.getElementById('timeCapText');
  const sourceScreenKind = document.getElementById('screenKindText');

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

  // Shrinks an element's font-size (inline, on top of whatever the CSS
  // clamp() set it to) just enough that its actual rendered width fits
  // within maxWidth, instead of guessing one fixed font-size that
  // assumes a specific font's character metrics. Different devices can
  // fall back to different fonts for the same font-family list (and the
  // --px HDMI density correction itself can land on a different branch
  // of a clamp() on different real hardware, producing a visibly
  // different size for the exact same string - confirmed on-device on a
  // Samsung TV vs a separate PC monitor), so a static guess/formula that
  // happens to fit on one can still clip - or collide with a neighboring
  // element - on another.
  //
  // Measuring is done with a Range over the element's contents, not
  // el.scrollWidth: scrollWidth only reports LAYOUT overflow (a child box
  // that's intrinsically wider than its parent). A fixed-width box like
  // .time-cap or .footer.intervals-total-footer (position: absolute with
  // both left and right set) never grows from its content, so text that
  // overflows it via white-space: nowrap is pure visual/ink overflow -
  // scrollWidth on that box stays equal to its own declared width no
  // matter how much text spills out, so the old check never fired for
  // these. A Range's bounding rect reflects the actual rendered text
  // extent regardless of the container's own box model, so it works for
  // both a shrink-to-fit box (the AMRAP caption lines) and a fixed-width
  // one (.time-cap, the Intervals footer) alike. Resets to the CSS size
  // first so it grows back once there's room again (e.g. a narrower
  // digit combination, or a shorter localized string, on the next
  // update).
  function measuredContentWidth(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().width;
  }

  // Shrinking font-size and re-measuring (an earlier approach) relies on text
  // width scaling exactly proportionally with font-size, which real on-device
  // testing showed isn't reliably true here (glyph hinting/rounding, and this
  // footer mixes two font-sizes via .intervals-round-number's 2em) - it
  // consistently left ~5-8% still overflowing even after repeated correction
  // passes.
  //
  // Applying transform: scale() directly to `el` (a second earlier approach)
  // is exact arithmetically but still didn't work, for a different reason
  // confirmed on-device via the debug overlay: `el` IS the element whose
  // CSS (position: absolute; left/right) declares the real, fixed box we're
  // trying to fit inside - scaling `el` itself shrinks THAT box by the same
  // factor as its overflowing content, since a transform scales everything
  // about an element's rendering uniformly. Box and content therefore always
  // shrink together, preserving the exact same overflow ratio no matter what
  // scale factor is computed - mathematically incapable of ever converging.
  // (Confirmed: box=3011px, content=3253px, scale(0.925) computed correctly
  // as 3011/3253 - but the box ends up 3011*0.925=2786px while the content
  // ends up 3253*0.925=3011px, i.e. still overflowing by exactly the
  // original 3011/2786 ratio.)
  //
  // The fix is a stable third element: wrap el's content in a fresh inner
  // span and scale THAT, leaving `el` itself - and therefore its real,
  // CSS-declared box - untouched. `el`'s box no longer moves, so shrinking
  // the wrapper's content by maxWidth/width is now a straight, one-shot fit.
  function fitTextToWidth(el, maxWidth, origin) {
    const wrapper = document.createElement('span');
    wrapper.style.display = 'inline-block';
    while (el.firstChild) wrapper.appendChild(el.firstChild);
    el.appendChild(wrapper);

    if (!maxWidth || maxWidth <= 0) return;
    const width = measuredContentWidth(wrapper);
    if (width <= maxWidth || width <= 0) return;
    wrapper.style.transformOrigin = (origin || 'center') + ' center';
    wrapper.style.transform = 'scale(' + (maxWidth / width) + ')';
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

  // Same 7-segment approach as renderDigits(), reused for the round/interval
  // badge numbers. Plain digit strings (no ':'), sized independently per
  // context via CSS (see ".interval-number .led-char" etc in receiver.css)
  // instead of a font - immune to any font/clamp()-related sizing quirk,
  // and to whatever was making these numbers flicker between two sizes.
  function renderLedNumber(container, value) {
    const raw = String(value || '').trim();
    container.textContent = '';
    container.setAttribute('aria-label', raw);

    for (const ch of raw) {
      const digit = document.createElement('span');
      digit.className = 'led-char';
      const active = new Set(SEGMENTS[ch] || []);

      for (const part of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
        const segment = document.createElement('span');
        segment.className = `led-seg led-${part}${active.has(part) ? ' on' : ''}`;
        digit.appendChild(segment);
      }
      container.appendChild(digit);
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

  // Structured/library WOD "block N/M" indicator - the app itself labels this
  // "INTERVALLO"/"INTERVAL"/"INTERVALO" in its own UI (it's not a separate tracked
  // concept from a block), so when a block also has its own rounds, the footer
  // carries both "ROUND x/y" and this "INTERVALLO n/m" side by side.
  function parseStructuredIntervalNumber(rawFooter) {
    const normalized = normalize(rawFooter);
    const match = normalized.match(/(?:INTERVALLO|INTERVAL|INTERVALO)\s+(\d+)\s*\/\s*(\d+)/);
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

  function parseStructuredAmrapRoundCount(rawFooter) {
    // Structured/library WOD AMRAP sub-blocks send "ROUND: N  •  AMRAP  •  Blocco x/y"
    // instead of standalone AMRAP's "ROUND COMPLETATI: N" - parseAmrapRoundCount's
    // trailing-number search would grab the block number (or find nothing) instead of
    // the actual round count, so this looks for "ROUND:" specifically instead.
    const match = String(rawFooter || '').match(/ROUND\s*:\s*(\d+)/i);
    const count = match ? match[1] : '0';
    const parts = String(rawFooter || '').split('•').map(part => part.trim()).filter(Boolean);
    const label = parts.length > 1 ? parts[1] : '';
    return { count, labelLines: label ? [label] : [] };
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
    // prefix. Both screens send the identical shape over the Cast Message
    // Channel, but the HDMI-only screenKind source element (never sent to a
    // real Cast receiver) tells them apart so each can get its own styling.
    const screenKind = sourceScreenKind ? (sourceScreenKind.textContent || '') : '';
    // Some FOR_TIME blocks are themselves round-based (e.g. "3 rounds for time"),
    // so their footer carries a "ROUND x/y" segment just like Tabata/manual
    // Intervals - without this exclusion roundsMode below claims them first and
    // they lose the has-fortime enlarged-clock treatment for the generic
    // has-rounds badge instead, even though screenKind already identifies them.
    const roundsMode = !interval && !emom && round && screenKind !== 'for_time';
    // For Time: footer is either "TIME CAP mm:ss"/"NO TIME CAP" (standalone) or,
    // for a structured/library WOD block, identified by screenKind instead (its
    // time cap travels through the separate timeCapText field - see forTimeActive
    // below) and may still carry its own "ROUND x/y" when it's round-based.
    const forTimeMode = !interval && !emom && !round && isForTimeFooter(rawFooter);
    // A structured/library WOD FOR_TIME block's own position in the sequence
    // (e.g. Gale Force's 2nd block) or, when it's round-based (e.g. Alec),
    // its round count - read once here so the badge below and the render
    // branch agree on the same value.
    const forTimeInterval = screenKind === 'for_time' ? parseStructuredIntervalNumber(rawFooter) : null;

    if (isIdleSource(rawStatus, timerText, rawFooter)) {
      activeVisualMode = '';
    } else if (interval || screenKind === 'structured_intervals') {
      // "CONFIGURA IL TIMER" hasn't started the interval countdown yet, so status
      // never contains "INTERVALLO n/N" for parseInterval to match - screenKind
      // keeps the clock styled consistently with the running state anyway.
      activeVisualMode = 'INTERVALS';
    } else if (emom) {
      activeVisualMode = 'EMOM';
    } else if (roundsMode) {
      // Structured/library WOD EMOM sub-blocks send a plain "ROUND x/y  •  EMOM  •  ..."
      // footer (no "EMOM ·" prefix, so parseEmomFooter's strict match above doesn't
      // fire), which is otherwise indistinguishable from Tabata/manual Intervals'
      // shape - screenKind (HDMI-only, never sent to a real Cast receiver) resolves it.
      activeVisualMode = screenKind === 'tabata'
        ? 'TABATA'
        : screenKind === 'intervals_manual'
          ? 'MANUAL_INTERVALS'
          : screenKind === 'emom'
            ? 'EMOM_STRUCTURED'
            : 'ROUNDS';
    } else if (isAmrapStatus(rawStatus) || screenKind === 'amrap' || screenKind === 'amrap_structured') {
      // Structured/library WOD AMRAP sub-blocks send statusText "WORK"/"REST" (from
      // the shared phaseLabel(), not the literal "AMRAP"), so isAmrapStatus alone
      // never matches them - screenKind resolves it the same way as above.
      activeVisualMode = 'AMRAP';
    } else if (isPlainTimerStatus(rawStatus) || screenKind === 'plain') {
      activeVisualMode = 'PLAIN';
    } else if (forTimeMode || screenKind === 'for_time') {
      // Structured/library WOD FOR_TIME sub-blocks send their time cap through the
      // separate timeCapText field, not folded into footerText like standalone
      // For Time does, so isForTimeFooter's "footer includes TIME CAP" check alone
      // never matches them.
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
    const roundsActive =
      (activeVisualMode === 'ROUNDS' || activeVisualMode === 'TABATA' ||
        activeVisualMode === 'MANUAL_INTERVALS' || activeVisualMode === 'EMOM_STRUCTURED') &&
      round && state !== 'state-prep';
    const forTimeActive = activeVisualMode === 'FORTIME' && state !== 'state-prep';
    const amrapActive = activeVisualMode === 'AMRAP' && state !== 'state-prep';
    // PLAIN's clock color/alignment rules use !important (needed to beat the
    // generic family rules), which also beats the base orange-during-prep
    // rule. Standalone Countdown/Count Up never actually hit PLAIN during
    // their own prep (isPlainTimerStatus only matches the literal running
    // status), so this never mattered before — but a structured/library
    // WOD's round-less sub-block DOES carry its block-type word in the
    // footer from the very start, including during prep. Gate it exactly
    // like every other mode so prep always falls through to the shared
    // centered/orange treatment.
    const plainActive = activeVisualMode === 'PLAIN' && state !== 'state-prep';
    // Every other mode's own render branch is gated on state !== 'state-prep', so
    // during the countdown its right-aligned clock never applies and it falls
    // through to the shared centered/orange treatment below - this one was
    // missing that gate, leaving the clock right-aligned during prep too.
    const intervalActive = !!interval && state !== 'state-prep';

    // Structured Intervals new protocol:
    // status = WORK/REST · INTERVALLO n/N
    // footer = ROUND x/y
    if (!interval && screenKind === 'structured_intervals' && state !== 'state-prep') {
      // "CONFIGURA IL TIMER": apply Structured Intervals' clock sizing/position for
      // consistency with the running state, but there's no real interval number yet.
      screen.classList.add('has-interval');
      intervalBadge.classList.add('hidden');
      const sourceFooterText = String(rawFooter).trim();
      footer.textContent = sourceFooterText;
      footer.className = 'footer';
      footer.classList.toggle('hidden', !sourceFooterText);
    } else if (intervalActive) {
      screen.classList.add('has-interval');

      // Big red current INTERVAL number on the left, drawn with the same
      // 7-segment LED code as the main clock instead of a font - its size
      // is fixed CSS box dimensions (see ".interval-number .led-char" in
      // receiver.css), not text that could overflow its badge.
      renderLedNumber(intervalNumber, interval.current);
      intervalBadge.classList.remove('hidden');
      intervalTotal.classList.add('hidden');

      // No extra blue counter at the top.
      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      // Bottom information:
      // ROUND mode -> ROUND x/y · INTERVALLI N
      // TIME mode  -> TEMPO TOTALE mm:ss · INTERVALLI N
      // The count number reuses .intervals-round-number so it renders at the
      // same size as the ROUND x/y numbers, while both spans keep the
      // .intervals-count class for its red color.
      const intervalsCountHtml =
        `<span class="intervals-count">INTERVALLI </span>` +
        `<span class="intervals-count intervals-round-number">${interval.total}</span>`;
      if (round) {
        footer.className = 'footer intervals-total-footer';
        footer.classList.remove('hidden');
        footer.innerHTML =
          `<span class="intervals-primary">ROUND ` +
          `<span class="intervals-round-number">${round.current}</span>/` +
          `<span class="intervals-round-number">${round.total}</span></span>` +
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
      renderLedNumber(intervalNumber, emom.current);
      renderLedNumber(intervalTotal, emom.total);
      intervalBadge.classList.remove('hidden');
      intervalTotal.classList.remove('hidden');

      topCounter.textContent = '';
      topCounter.classList.add('hidden');

      // Round info now lives in the left badge; the bottom footer is unused.
      footer.textContent = '';
      footer.className = 'footer hidden';
    } else if (
      (activeVisualMode === 'ROUNDS' || activeVisualMode === 'TABATA' ||
        activeVisualMode === 'MANUAL_INTERVALS' || activeVisualMode === 'EMOM_STRUCTURED') &&
      roundsActive
    ) {
      // has-rounds always applies as the shared base (badge layout, colors,
      // clock proportions); has-tabata/has-manual-intervals/has-emom only add
      // the higher-specificity overrides that make each mode's numbers look
      // different, instead of duplicating every shared rule. EMOM_STRUCTURED
      // reuses has-emom's own styling directly (a structured/library WOD's
      // EMOM sub-block, routed here because its footer lacks the "EMOM ·"
      // prefix the standalone EMOM screen sends).
      screen.classList.add('has-rounds');
      if (activeVisualMode === 'TABATA') screen.classList.add('has-tabata');
      if (activeVisualMode === 'MANUAL_INTERVALS') screen.classList.add('has-manual-intervals');
      if (activeVisualMode === 'EMOM_STRUCTURED') screen.classList.add('has-emom');

      // A structured/library WOD block can have its own rounds AND sit inside
      // one of several "INTERVALLO n/m" blocks at once - when both are present,
      // red shows the current block (interval) and gray shows the current round,
      // instead of gray repeating the round's own total.
      const structuredInterval = parseStructuredIntervalNumber(rawFooter);
      if (structuredInterval) {
        renderLedNumber(intervalNumber, structuredInterval.current);
        renderLedNumber(intervalTotal, round.current);
      } else {
        // Tabata / manual Intervals: same left-badge language as EMOM.
        renderLedNumber(intervalNumber, round.current);
        renderLedNumber(intervalTotal, round.total);
      }
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
      const amrapRound = screenKind === 'amrap_structured'
        ? parseStructuredAmrapRoundCount(rawFooter)
        : parseAmrapRoundCount(rawFooter);
      renderLedNumber(intervalNumber, amrapRound.count);
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
    } else if (plainActive) {
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
    } else if (activeVisualMode === 'FORTIME' && forTimeInterval && state === 'state-prep') {
      // The 3-2-1 countdown falls through to the shared generic/plain digit
      // treatment for every mode (see the *Active gates above, all excluding
      // state-prep) - fine for a plain full-width clock, but this block's
      // clock is narrower once has-fortime-badge applies (room for the red
      // badge next to it), so without this the countdown briefly renders at
      // the wider plain size and visibly jumps smaller the instant WORK
      // starts and the badge appears. Apply the same clock sizing early, with
      // no badge content yet (nothing meaningful to show during the count).
      screen.classList.add('has-fortime', 'has-fortime-badge');
      intervalBadge.classList.add('hidden');
      intervalTotal.classList.add('hidden');
      topCounter.textContent = '';
      topCounter.classList.add('hidden');
      footer.textContent = '';
      footer.className = 'footer hidden';
    } else if (forTimeActive) {
      screen.classList.add('has-fortime');

      if (forTimeInterval) {
        // Structured/library WOD FOR_TIME block with its own position in the
        // sequence (e.g. Gale Force's 2nd block) or, when it's round-based
        // (e.g. Alec's "N rounds for time" blocks), its round count - same
        // red-badge-next-to-the-clock language as every other family
        // (has-rounds/has-emom/...) instead of cramming "ROUND x/y . FOR TIME
        // . INTERVALLO x/y" into the small time-cap footer, which made it
        // unreadably huge/overflowing for anything longer than the plain
        // "TIME CAP mm:ss" that footer was actually sized for.
        screen.classList.add('has-fortime-badge');
        renderLedNumber(intervalNumber, forTimeInterval.current);
        if (round) {
          renderLedNumber(intervalTotal, round.current);
          intervalTotal.classList.remove('hidden');
        } else {
          intervalTotal.classList.add('hidden');
        }
        intervalBadge.classList.remove('hidden');
        topCounter.textContent = '';
        topCounter.classList.add('hidden');

        // The block position/round is also shown in the red badge now, but
        // the descriptive text (ROUND x/y / FOR TIME / INTERVALLO x/y, plus
        // any time cap) still belongs at the bottom too - it's what actually
        // labels the numbers up top. Only the size changes from before: the
        // plain, un-family-scoped .footer class (small clamp, same one every
        // untouched screen uses) instead of .fortime-footer, whose much
        // bigger clamp was tuned for "TIME CAP mm:ss" alone and is what
        // overflowed the screen for this longer combined text.
        const rawFooterTrimmed = String(rawFooter).trim();
        const sourceFooterText = capText
          ? [capText, rawFooterTrimmed].filter(Boolean).join('  •  ')
          : rawFooterTrimmed;
        footer.textContent = sourceFooterText;
        footer.className = 'footer';
        footer.classList.toggle('hidden', !sourceFooterText);
      } else {
        // No rounds at all: just the enlarged clock, full width, no left
        // badge. The time cap footer ("TIME CAP mm:ss" / "NO TIME CAP") is
        // shown bigger than the generic footer used by other screens.
        intervalBadge.classList.add('hidden');
        intervalTotal.classList.add('hidden');
        topCounter.textContent = '';
        topCounter.classList.add('hidden');

        // Structured/library WOD FOR_TIME sub-blocks send their time cap through
        // the separate timeCapText field instead of folding it into footerText
        // like standalone For Time does ("TIME CAP mm:ss"/"NO TIME CAP" is
        // already the whole footer there) - combined into this one footer line
        // instead of showing a second "TIME CAP" overlay that can collide with
        // the clock or this footer.
        const rawFooterTrimmed = String(rawFooter).trim();
        const sourceFooterText = capText
          ? [capText, rawFooterTrimmed].filter(Boolean).join('  •  ')
          : rawFooterTrimmed;
        footer.textContent = sourceFooterText;
        footer.className = 'footer fortime-footer';
        footer.classList.toggle('hidden', !sourceFooterText);
      }
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

    // For Time (forTimeActive) already folds capText into its own footer line above -
    // the separate .time-cap overlay would otherwise show the same text a second
    // time, positioned independently enough to collide with the clock or footer.
    timeCap.textContent = capText;
    timeCap.classList.toggle('hidden', !String(capText).trim() || forTimeActive);

    fitOverflowingTextToBounds();
  }

  // Single overflow guard for every mode instead of one bespoke fitTextToWidth
  // call per element/branch, added piecemeal as each got reported clipped on
  // a real device. A long localized string can render wider than its box on
  // some real HDMI/USB-C adapter or monitor regardless of which mode set it
  // (--px's own correction factor can differ enough between two real
  // displays to push the exact same clamp() rule down a different branch on
  // each - confirmed on-device: a Samsung TV and a separate PC monitor
  // disagreed on both direction and size for the same string), so this runs
  // unconditionally at the end of every render pass over the fixed, known
  // set of "must never overflow its own box" elements - status/footer/time-
  // cap, plus every text line inside the round badge - rather than trusting
  // each branch above to remember to call it for whatever it just set.
  function fitOverflowingTextToBounds() {
    // el itself is never transformed (fitTextToWidth scales an inner wrapper
    // instead, see its own doc comment for why), so el's own box measurement
    // here is always accurate without needing to reset anything first.
    [status, footer, timeCap].forEach(el => {
      if (!el || el.classList.contains('hidden')) return;
      fitTextToWidth(el, el.getBoundingClientRect().width);
    });

    if (intervalTotal && !intervalTotal.classList.contains('hidden')) {
      const budget = intervalTotal.getBoundingClientRect().width;
      Array.from(intervalTotal.children).forEach(lineEl => {
        if (lineEl.textContent && lineEl.textContent.trim()) {
          // Left-anchored: these lines are left-aligned against the badge's
          // own left edge (receiver.css), which is itself flush against the
          // screen edge - shrinking from the left would reopen the original
          // off-screen clip this was fixed for.
          fitTextToWidth(lineEl, budget, 'left');
        }
      });
    }
  }
  // Exposed only so the TEMPORARY debug overlay in index.html can prove this
  // function actually exists in the currently-loaded script (i.e. that the
  // WebView isn't serving a stale cached led-display.js) - not used by any
  // other code. Remove alongside the debug overlay once the bug is fixed.
  window.ironWodFitDebug = fitOverflowingTextToBounds;

  const observer = new MutationObserver(sync);
  [sourceStatus, sourceTimer, sourceFooter, sourceTimeCap, sourceScreenKind].filter(Boolean).forEach(node => {
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