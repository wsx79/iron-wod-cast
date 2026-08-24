(() => {
  'use strict';

  const NAMESPACE = 'urn:x-cast:com.example.crossboxpro.timer';
  const statusEl = document.getElementById('statusText');
  const timerEl = document.getElementById('timerText');
  const footerEl = document.getElementById('footerText');
  const timeCapEl = document.getElementById('timeCapText');
  const roundEl = document.getElementById('roundText');
  const screenEl = document.getElementById('timerScreen');

  let lastStatus = '';
  let lastTimer = '';
  let audioContext = null;

  const voicePlayer = new Audio();
  voicePlayer.preload = 'none';
  voicePlayer.volume = 1.0;

  const soundPlayer = new Audio();
  soundPlayer.preload = 'auto';
  soundPlayer.volume = 1.0;
  let activeVoiceAudio = null;
  let lastAudioMode = '';
  let lastVoiceLanguage = '';
  const AUDIO_ASSET_VERSION = '20260821-stable-audio3';
  const SOUND_ASSET_VERSION = '20260821-htmlaudio-beeps1';

  function normalizeLanguage(language) {
    const raw = String(language || '').trim().toLowerCase();
    const primary = raw.split(/[-_]/)[0];
    return ['it', 'en', 'es'].includes(primary) ? primary : 'en';
  }

  function normalizeStatus(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function voiceUrl(name, language) {
    const lang = normalizeLanguage(language);
    const safeName = String(name).replace(/[^a-z0-9_-]/gi, '');
    return new URL(
      `voice/${lang}/${safeName}.mp3?v=${AUDIO_ASSET_VERSION}`,
      window.location.href
    ).href;
  }

  function soundUrl(name) {
    const safeName = String(name).replace(/[^a-z0-9_-]/gi, '');
    return new URL(
      `sounds/${safeName}.mp3?v=${SOUND_ASSET_VERSION}`,
      window.location.href
    ).href;
  }

  function prefetchAsset(url) {
    try {
      fetch(url, { cache: 'force-cache' }).catch(error => {
        console.warn('[IRON WOD audio] prefetch failed:', url, error);
      });
    } catch (error) {
      console.warn('[IRON WOD audio] prefetch exception:', url, error);
    }
  }

  function prewarmAudioAssets() {
    ['countdown', 'work', 'rest', 'complete'].forEach(name => {
      prefetchAsset(soundUrl(name));
    });

    ['it', 'en', 'es'].forEach(language => {
      for (let number = 1; number <= 10; number += 1) {
        prefetchAsset(voiceUrl(String(number), language));
      }
      ['go', 'work', 'rest', 'complete'].forEach(name => {
        prefetchAsset(voiceUrl(name, language));
      });
    });
  }

  function localizedFallbackText(name, language) {
    const lang = normalizeLanguage(language);
    const cue = String(name);

    if (/^\d+$/.test(cue)) return cue;

    const words = {
      it: { go: 'via', work: 'lavoro', rest: 'riposo', complete: 'completato' },
      en: { go: 'go', work: 'work', rest: 'rest', complete: 'complete' },
      es: { go: 'vamos', work: 'trabajo', rest: 'descanso', complete: 'completado' }
    };

    return words[lang][cue] || cue;
  }

  function stopVoiceAudio() {
    try {
      voicePlayer.pause();
      voicePlayer.removeAttribute('src');
      voicePlayer.load();
    } catch (_) {}
    activeVoiceAudio = null;
  }

  function playVoiceAsset(name, language) {
    try {
      stopVoiceAudio();

      voicePlayer.src = voiceUrl(name, language);
      voicePlayer.currentTime = 0;
      voicePlayer.volume = 1.0;
      activeVoiceAudio = voicePlayer;

      voicePlayer.onended = () => {
        activeVoiceAudio = null;
      };

      voicePlayer.onerror = () => {
        if (activeVoiceAudio === voicePlayer) activeVoiceAudio = null;
        console.warn(
          '[IRON WOD audio] voice asset error:',
          name,
          normalizeLanguage(language),
          voicePlayer.error ? `code=${voicePlayer.error.code}` : 'unknown'
        );
        const spoken = speakCue(localizedFallbackText(name, language), language, true);
        if (!spoken) fallbackSoundForCue(name);
      };

      voicePlayer.load();
      const result = voicePlayer.play();

      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          if (activeVoiceAudio === voicePlayer) activeVoiceAudio = null;
          const spoken = speakCue(localizedFallbackText(name, language), language, true);
          if (!spoken) fallbackSoundForCue(name);
        });
      }

      return true;
    } catch (_) {
      const spoken = speakCue(localizedFallbackText(name, language), language, true);
      if (!spoken) fallbackSoundForCue(name);
      return spoken;
    }
  }

  function stopSoundAudio() {
    try {
      soundPlayer.pause();
      soundPlayer.currentTime = 0;
    } catch (_) {}
  }

  function playSoundAsset(name) {
    const url = soundUrl(name);

    try {
      stopSoundAudio();

      soundPlayer.onerror = () => {
        const mediaError = soundPlayer.error;
        console.warn(
          '[IRON WOD audio] sound asset error:',
          name,
          url,
          mediaError ? `code=${mediaError.code}` : 'unknown'
        );
        playToneFallback(name);
      };

      soundPlayer.src = url;
      soundPlayer.currentTime = 0;
      soundPlayer.volume = 1.0;
      soundPlayer.load();

      const result = soundPlayer.play();
      if (result && typeof result.catch === 'function') {
        result.catch(error => {
          console.warn(
            '[IRON WOD audio] soundPlayer.play() rejected:',
            name,
            error
          );
          playToneFallback(name);
        });
      }
      return true;
    } catch (error) {
      console.warn('[IRON WOD audio] sound playback exception:', name, error);
      playToneFallback(name);
      return false;
    }
  }

  function ensureAudio() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioContext = new AudioContextClass();
    }
    return audioContext;
  }

  function scheduleTone(ctx, frequency, durationMs, gainValue, delayMs = 0) {
    const startAt = ctx.currentTime + delayMs / 1000;
    const endAt = startAt + durationMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(endAt + 0.02);
  }

  function tone(frequency, durationMs, gainValue, delayMs = 0) {
    const ctx = ensureAudio();
    if (!ctx) {
      console.warn('[IRON WOD audio] WebAudio unavailable');
      return false;
    }

    if (ctx.state === 'suspended') {
      ctx.resume()
        .then(() => {
          scheduleTone(ctx, frequency, durationMs, gainValue, delayMs);
        })
        .catch(error => {
          console.warn('[IRON WOD audio] AudioContext.resume() rejected:', error);
        });
      return true;
    }

    try {
      scheduleTone(ctx, frequency, durationMs, gainValue, delayMs);
      return true;
    } catch (error) {
      console.warn('[IRON WOD audio] WebAudio tone failed:', error);
      return false;
    }
  }

  function playToneFallback(name) {
    const cue = String(name);

    if (cue === 'countdown') {
      tone(920, 120, 0.34);
      return;
    }

    if (cue === 'rest') {
      tone(650, 190, 0.34);
      return;
    }

    if (cue === 'complete') {
      tone(880, 150, 0.34);
      tone(1120, 170, 0.36, 165);
      tone(1420, 240, 0.38, 350);
      return;
    }

    tone(1180, 140, 0.36);
    tone(1480, 150, 0.34, 150);
  }

  function primeAudioPipeline() {
    prewarmAudioAssets();

    try {
      voicePlayer.preload = 'auto';
      soundPlayer.preload = 'auto';

      soundPlayer.src = soundUrl('countdown');
      soundPlayer.load();

      voicePlayer.src = voiceUrl('1', 'it');
      voicePlayer.load();
    } catch (error) {
      console.warn('[IRON WOD audio] HTMLAudio prime failed:', error);
    }

    const ctx = ensureAudio();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(error => {
        console.warn('[IRON WOD audio] initial AudioContext.resume() rejected:', error);
      });
    }
  }

  const countdownCue = () => playSoundAsset('countdown');
  const restCue = () => playSoundAsset('rest');

  function workCue() {
    playSoundAsset('work');
  }

  function finishCue() {
    playSoundAsset('complete');
  }


  function fallbackSoundForCue(name) {
    const cue = String(name);
    if (/^\d+$/.test(cue)) {
      countdownCue();
    } else if (cue === 'rest') {
      restCue();
    } else if (cue === 'complete') {
      finishCue();
    } else {
      workCue();
    }
  }

  function speakCue(text, language, cancelPrevious = true) {
    if (!('speechSynthesis' in window)) return false;

    try {
      if (cancelPrevious) window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const lang = normalizeLanguage(language);
      utterance.lang = lang === 'it' ? 'it-IT' : (lang === 'es' ? 'es-ES' : 'en-US');
      utterance.rate = 1.35;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (_) {
      return false;
    }
  }

  function isPreparingStatus(status) {
    const text = normalizeStatus(status);
    return text.includes('PREPAR') ||
      text.includes('GET READY') ||
      text === 'PREP';
  }

  function isRestStatus(status) {
    const text = normalizeStatus(status);
    return text.includes('REST') ||
      text.includes('RECUPERO') ||
      text.includes('RIPOS') ||
      text.includes('DESCANS') ||
      text === 'PAUSA';
  }

  function isActiveWorkStatus(status) {
    const text = normalizeStatus(status);
    return (
      text === 'WORK' ||
      text.startsWith('WORK ') ||
      text.includes('LAVOR') ||
      text.includes('TRABAJO') ||
      text === 'AMRAP' ||
      text === 'COUNTDOWN' ||
      text === 'COUNT UP' ||
      text === 'FOR TIME' ||
      text.startsWith('ROUND ')
    );
  }

  function isFinishStatus(status) {
    const text = normalizeStatus(status);
    return text.includes('FINE') ||
      text.includes('DONE') ||
      text.includes('COMPLET') ||
      text.includes('FINISH') ||
      text.includes('TIME UP') ||
      text.includes('TEMPO TERMINATO') ||
      text.includes('TEMPO SCADUTO') ||
      text.includes('TIEMPO AGOTADO') ||
      text.includes('TERMIN');
  }

  function maybePlayCue(statusText, timerText, audioMode, voiceLanguage) {
    const status = normalizeStatus(statusText);
    const prev = normalizeStatus(lastStatus);
    const timer = String(timerText || '').trim();
    const rawMode = String(audioMode || 'SOUNDS').trim().toUpperCase();
    const mode = ['VOICE', 'SOUNDS', 'SILENT'].includes(rawMode)
      ? rawMode
      : 'SOUNDS';
    const normalizedLanguage = normalizeLanguage(voiceLanguage);

    if (mode !== lastAudioMode || normalizedLanguage !== lastVoiceLanguage) {
      stopVoiceAudio();
      stopSoundAudio();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      lastStatus = '';
      lastTimer = '';
      lastAudioMode = mode;
      lastVoiceLanguage = normalizedLanguage;
    }

    const preparing = isPreparingStatus(status);
    const previousPreparing = isPreparingStatus(prev);
    const activeWork = isActiveWorkStatus(status);
    const restStatus = isRestStatus(status);

    const configuringOrReady =
      status.includes('CONFIGURA') ||
      status.includes('SET UP') ||
      status === 'PRONTO' ||
      status === 'READY';

    if (
      configuringOrReady ||
      (previousPreparing && !preparing && !activeWork && !restStatus)
    ) {
      stopVoiceAudio();
      stopSoundAudio();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      lastStatus = statusText || '';
      lastTimer = timer;
      return;
    }

    if (
      mode === 'SOUNDS' &&
      preparing &&
      timer !== lastTimer &&
      /^\d+$/.test(timer)
    ) {
      countdownCue();
    }

    if (
      mode === 'VOICE' &&
      preparing &&
      timer !== lastTimer &&
      /^\d+$/.test(timer)
    ) {
      if (!previousPreparing && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      if (!playVoiceAsset(timer, voiceLanguage)) {
        speakCue(timer, voiceLanguage, true);
      }
    }

    if (status !== prev && mode !== 'SILENT') {
      if (isFinishStatus(status)) {
        if (mode === 'VOICE') {
          if (!playVoiceAsset('complete', voiceLanguage)) finishCue();
        } else {
          finishCue();
        }
      } else if (restStatus) {
        if (mode === 'VOICE') {
          if (!playVoiceAsset('rest', voiceLanguage)) restCue();
        } else {
          restCue();
        }
      } else if (activeWork && (previousPreparing || isRestStatus(prev))) {
        if (mode === 'VOICE') {
          const cueName = previousPreparing ? 'go' : 'work';
          if (!playVoiceAsset(cueName, voiceLanguage)) workCue();
        } else {
          workCue();
        }
      }
    }

    lastStatus = statusText || '';
    lastTimer = timer;
  }

  const LED_SEGMENTS = Object.freeze({
    '0': ['a', 'b', 'c', 'd', 'e', 'f'],
    '1': ['b', 'c'],
    '2': ['a', 'b', 'g', 'e', 'd'],
    '3': ['a', 'b', 'c', 'd', 'g'],
    '4': ['f', 'g', 'b', 'c'],
    '5': ['a', 'f', 'g', 'c', 'd'],
    '6': ['a', 'f', 'g', 'e', 'c', 'd'],
    '7': ['a', 'b', 'c'],
    '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    '9': ['a', 'b', 'c', 'd', 'f', 'g']
  });

  function renderLedTimer(value) {
    const raw = String(value || '').trim();
    timerEl.textContent = '';
    timerEl.setAttribute('aria-label', raw);
    timerEl.classList.toggle('single-digit', /^\d$/.test(raw));

    for (const ch of raw) {
      if (ch === ':') {
        const colon = document.createElement('span');
        colon.className = 'led-colon';
        timerEl.appendChild(colon);
        continue;
      }

      if (!/^\d$/.test(ch)) {
        // Rare non-numeric final state: keep it readable instead of breaking layout.
        timerEl.textContent = raw;
        timerEl.style.fontFamily = '"Courier New", monospace';
        timerEl.style.fontSize = 'clamp(150px, 22vw, 430px)';
        timerEl.style.fontWeight = '700';
        timerEl.style.letterSpacing = '.03em';
        return;
      }

      const digit = document.createElement('span');
      digit.className = 'led-char';
      const active = new Set(LED_SEGMENTS[ch]);

      for (const seg of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
        const node = document.createElement('span');
        node.className = `led-seg led-${seg}${active.has(seg) ? ' on' : ''}`;
        digit.appendChild(node);
      }
      timerEl.appendChild(digit);
    }
  }

  function classifyVisualState(statusText) {
    const value = normalizeStatus(statusText);

    if (
      value === 'OTC' ||
      value.includes('OVER TIME CAP') ||
      value.includes('OLTRE TIME CAP')
    ) return 'state-otc';

    if (isFinishStatus(value)) return 'state-finished';
    if (isRestStatus(value)) return 'state-rest';

    if (
      value.includes('PREPAR') ||
      value.includes('GET READY') ||
      value === 'PREP'
    ) return 'state-prep';

    if (
      value.includes('PAUSA') ||
      value.includes('PAUSED')
    ) return 'state-paused';

    if (isActiveWorkStatus(value)) return 'state-work';
    return 'state-idle';
  }

  function applyVisualState(statusText) {
    const states = [
      'state-idle',
      'state-work',
      'state-rest',
      'state-otc',
      'state-finished',
      'state-prep',
      'state-paused'
    ];
    screenEl.classList.remove(...states);
    screenEl.classList.add(classifyVisualState(statusText));
  }

  function resolveStatusAndTimeCap(data) {
    const rawStatus = String(data.statusText || '');
    const parts = rawStatus.split('•').map(part => part.trim()).filter(Boolean);

    let legacyTimeCap = '';
    const baseParts = [];

    parts.forEach(part => {
      if (!legacyTimeCap && normalizeStatus(part).startsWith('TIME CAP')) {
        legacyTimeCap = part;
      } else {
        baseParts.push(part);
      }
    });

    return {
      statusText: String(data.statusBaseText || baseParts[0] || rawStatus || 'IRON WOD'),
      timeCapText: String(data.timeCapText || legacyTimeCap || '')
    };
  }

  function classifyFooterPart(text) {
    const normalized = normalizeStatus(text);

    if (
      normalized.startsWith('ROUND') ||
      normalized.startsWith('ROUNDS') ||
      normalized.startsWith('RONDA')
    ) {
      return 'footer-round';
    }

    if (
      normalized.startsWith('BLOCCO') ||
      normalized.startsWith('BLOCK') ||
      normalized.startsWith('BLOQUE')
    ) {
      return 'footer-block';
    }

    return 'footer-mode';
  }

  function renderFooter(footerText) {
    const raw = String(footerText || '').trim();

    if (!raw) {
      roundEl.textContent = '';
      roundEl.classList.add('hidden');
      footerEl.textContent = 'TIMER';
      return;
    }

    const parts = raw
      .split('•')
      .map(part => part.trim())
      .filter(Boolean);

    const roundParts = parts.filter(part => classifyFooterPart(part) === 'footer-round');
    const bottomParts = parts.filter(part => classifyFooterPart(part) !== 'footer-round');

    if (roundParts.length > 0) {
      roundEl.textContent = roundParts[0];
      roundEl.classList.remove('hidden');
    } else {
      roundEl.textContent = '';
      roundEl.classList.add('hidden');
    }

    if (bottomParts.length === 0) {
      footerEl.textContent = '';
      return;
    }

    footerEl.textContent = '';

    bottomParts.forEach((part, index) => {
      if (index > 0) {
        const separator = document.createElement('span');
        separator.className = 'footer-part footer-separator';
        separator.textContent = '  |  ';
        footerEl.appendChild(separator);
      }

      const span = document.createElement('span');
      span.className = `footer-part ${classifyFooterPart(part)}`;
      span.textContent = part;
      footerEl.appendChild(span);
    });
  }

  function updateTimer(data) {
    const resolved = resolveStatusAndTimeCap(data);
    const statusText = compactCompletionStatus(resolved.statusText);
    const timerText = String(data.timerText || '');
    const footerText = String(data.footerText || '');

    maybePlayCue(
      statusText,
      timerText,
      data.audioMode || 'SOUNDS',
      data.voiceLanguage || 'it'
    );

    statusEl.textContent = statusText;
    renderLedTimer(timerText);
    applyVisualState(statusText);
    renderFooter(footerText);

    const capRaw = String(resolved.timeCapText || '').trim();
    const capDisplay =
      capRaw && !normalizeStatus(capRaw).startsWith('TIME CAP')
        ? `TIME CAP ${capRaw}`
        : capRaw;
    timeCapEl.textContent = capDisplay;
    timeCapEl.classList.toggle('hidden', !capDisplay);

    const normalizedStatus = normalizeStatus(statusText);
    const isConfiguration =
      normalizedStatus.includes('CONFIGURA') ||
      normalizedStatus.includes('SET UP');

    statusEl.style.color = isConfiguration
      ? '#ff6b00'
      : (data.accentColor ? String(data.accentColor) : '#ff6b00');
  }

  function clearTimer() {
    statusEl.textContent = 'IRON WOD';
    renderLedTimer('00:00');
    footerEl.textContent = 'TIMER';
    roundEl.textContent = '';
    roundEl.classList.add('hidden');
    timeCapEl.textContent = '';
    timeCapEl.classList.add('hidden');
    applyVisualState('IRON WOD');
    statusEl.style.color = '#ff6b00';
    stopVoiceAudio();
    stopSoundAudio();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    lastStatus = '';
    lastTimer = '';
    lastAudioMode = '';
    lastVoiceLanguage = '';
  }


  renderLedTimer('00:00');
  applyVisualState('IRON WOD');

  primeAudioPipeline();

  const context = cast.framework.CastReceiverContext.getInstance();
  let currentHostSenderId = null;

  context.addCustomMessageListener(NAMESPACE, event => {
    if (!currentHostSenderId) {
      currentHostSenderId = event.senderId;
    }

    if (event.senderId !== currentHostSenderId) {
      return;
    }
    let data = event.data;

    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (_) {
        return;
      }
    }

    if (!data || typeof data !== 'object') return;

    if (data.type === 'timer') {
      if (typeof data.timerText !== 'string') {
        console.warn('[IRON WOD protocol] invalid timer payload: timerText missing or not a string');
        return;
      }
      updateTimer(data);
    }

    if (data.type === 'clear') {
      clearTimer();
    }
  });

  context.addEventListener(
    cast.framework.system.EventType.SENDER_DISCONNECTED,
    event => {
      if (event.senderId === currentHostSenderId) {
        currentHostSenderId = null;
      }

      if (context.getSenders().length === 0) {
        clearTimer();
      }
    }
  );

  context.start({ disableIdleTimeout: true });
})();
