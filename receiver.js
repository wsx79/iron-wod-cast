(() => {
  'use strict';

  const NAMESPACE = 'urn:x-cast:com.example.crossboxpro.timer';
  const statusEl = document.getElementById('statusText');
  const timerEl = document.getElementById('timerText');
  const footerEl = document.getElementById('footerText');
  const timeCapEl = document.getElementById('timeCapText');

  let lastStatus = '';
  let lastTimer = '';
  let audioContext = null;

  const voiceAudio = { it: {}, en: {}, es: {} };
  let activeVoiceAudio = null;

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

  function preloadVoiceAudio() {
    ['it', 'en', 'es'].forEach(language => {
      for (let number = 1; number <= 10; number += 1) {
        const audio = new Audio(`voice/${language}/${number}.mp3`);
        audio.preload = 'auto';
        voiceAudio[language][String(number)] = audio;
      }

      ['go', 'work', 'rest', 'complete'].forEach(name => {
        const audio = new Audio(`voice/${language}/${name}.mp3`);
        audio.preload = 'auto';
        voiceAudio[language][name] = audio;
      });
    });
  }

  function stopVoiceAudio() {
    if (activeVoiceAudio) {
      try {
        activeVoiceAudio.pause();
        activeVoiceAudio.currentTime = 0;
      } catch (_) {}
      activeVoiceAudio = null;
    }
  }

  function playVoiceAsset(name, language) {
    const lang = normalizeLanguage(language);
    const template = voiceAudio[lang][String(name)];
    if (!template) return false;

    try {
      stopVoiceAudio();
      const audio = template.cloneNode(true);
      audio.volume = 1.0;
      activeVoiceAudio = audio;
      audio.addEventListener('ended', () => {
        if (activeVoiceAudio === audio) activeVoiceAudio = null;
      }, { once: true });

      const result = audio.play();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function ensureAudio() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioContext = new AudioContextClass();
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  }

  function tone(frequency, durationMs, gainValue, delayMs = 0) {
    const ctx = ensureAudio();
    if (!ctx) return;

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

  const countdownCue = () => tone(920, 120, 0.34);
  const restCue = () => tone(650, 190, 0.34);

  function workCue() {
    tone(1180, 140, 0.36);
    tone(1480, 150, 0.34, 150);
  }

  function finishCue() {
    tone(880, 150, 0.34);
    tone(1120, 170, 0.36, 165);
    tone(1420, 240, 0.38, 350);
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
    const mode = String(audioMode || 'SOUNDS').trim().toUpperCase();

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

    if (!raw || !raw.includes('•')) {
      footerEl.textContent = raw || 'TIMER';
      return;
    }

    const parts = raw
      .split('•')
      .map(part => part.trim())
      .filter(Boolean);

    footerEl.textContent = '';

    parts.forEach((part, index) => {
      if (index > 0) {
        const separator = document.createElement('span');
        separator.className = 'footer-part footer-separator';
        separator.textContent = '  •  ';
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
    const statusText = resolved.statusText;
    const timerText = String(data.timerText || '');
    const footerText = String(data.footerText || '');

    maybePlayCue(
      statusText,
      timerText,
      data.audioMode || 'SOUNDS',
      data.voiceLanguage || 'it'
    );

    statusEl.textContent = statusText;
    timerEl.textContent = timerText;
    renderFooter(footerText);

    timeCapEl.textContent = resolved.timeCapText;
    timeCapEl.classList.toggle('hidden', !resolved.timeCapText);

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
    timerEl.textContent = '00:00';
    footerEl.textContent = 'TIMER';
    timeCapEl.textContent = '';
    timeCapEl.classList.add('hidden');
    statusEl.style.color = '#ff6b00';
    stopVoiceAudio();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    lastStatus = '';
    lastTimer = '';
  }

  preloadVoiceAudio();

  const context = cast.framework.CastReceiverContext.getInstance();
  context.addCustomMessageListener(NAMESPACE, event => {
    let data = event.data;

    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (_) {
        return;
      }
    }

    if (!data || typeof data !== 'object') return;
    if (data.type === 'timer') updateTimer(data);
    if (data.type === 'clear') clearTimer();
  });

  context.start({ disableIdleTimeout: true });
})();
