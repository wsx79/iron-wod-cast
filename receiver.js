(() => {
  'use strict';

  const NAMESPACE = 'urn:x-cast:com.example.crossboxpro.timer';
  const statusEl = document.getElementById('statusText');
  const timerEl = document.getElementById('timerText');
  const footerEl = document.getElementById('footerText');

  let lastStatus = '';
  let lastTimer = '';
  let audioContext = null;

  const voiceAudio = { it: {}, en: {} };
  let activeVoiceAudio = null;

  function preloadVoiceAudio() {
    ['it', 'en'].forEach(language => {
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
    const lang = language === 'en' ? 'en' : 'it';
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
      if (cancelPrevious) {
        window.speechSynthesis.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'en' ? 'en-US' : 'it-IT';
      utterance.rate = 1.35;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (_) {
      return false;
    }
  }

  function isActiveWorkStatus(status) {
    return (
      status === 'WORK' ||
      status.startsWith('WORK ') ||
      status === 'AMRAP' ||
      status === 'COUNTDOWN' ||
      status === 'COUNT UP' ||
      status === 'FOR TIME' ||
      status.startsWith('ROUND ')
    );
  }

  function maybePlayCue(statusText, timerText, audioMode, voiceLanguage) {
    const status = String(statusText || '').trim().toUpperCase();
    const prev = String(lastStatus || '').trim().toUpperCase();
    const timer = String(timerText || '').trim();
    const mode = String(audioMode || 'SOUNDS').toUpperCase();

    const preparing = status.includes('PREPAR') || status.includes('GET READY');
    const previousPreparing =
      prev.includes('PREPAR') ||
      prev.includes('GET READY');
    const activeWork = isActiveWorkStatus(status);
    const restStatus =
      status.includes('REST') ||
      status.includes('RECUPERO');
    const configuringOrReady =
      status.includes('CONFIGURA') ||
      status.includes('SET UP') ||
      status.includes('PRONTO') ||
      status.includes('READY');

    // RESET / READY / CONFIGURATION must be silent.
    // More importantly: if we leave PREPARATI for anything that is NOT an
    // actual running state (for example an intermediate PAUSA during reset),
    // cancel the countdown voice and never infer Go/Vai from that transition.
    if (
      configuringOrReady ||
      (previousPreparing && !preparing && !activeWork && !restStatus)
    ) {
      stopVoiceAudio();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
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
      const wasPreparing =
        prev.includes('PREPAR') ||
        prev.includes('GET READY');

      if (!wasPreparing && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      // Cast browsers can defer/skip very short speechSynthesis utterances
      // arriving once per second. The countdown therefore uses local,
      // preloaded MP3 numbers. speechSynthesis remains only as fallback.
      if (!playVoiceAsset(timer, voiceLanguage)) {
        speakCue(timer, voiceLanguage, true);
      }
    }

    if (status !== prev && mode !== 'SILENT') {
      const isFinish =
        status.includes('FINE') ||
        status.includes('DONE') ||
        status.includes('COMPLET') ||
        status.includes('TIME UP') ||
        status.includes('TEMPO TERMINATO');

      if (isFinish) {
        if (mode === 'VOICE') {
          if (!playVoiceAsset('complete', voiceLanguage)) finishCue();
        } else {
          finishCue();
        }
      } else if (status.includes('REST')) {
        if (mode === 'VOICE') {
          if (!playVoiceAsset('rest', voiceLanguage)) restCue();
        } else {
          restCue();
        }
      } else if (activeWork && (previousPreparing || prev.includes('REST'))) {
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

  function updateTimer(data) {
    const statusText = String(data.statusText || '');
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
    footerEl.textContent = footerText;

    const normalizedStatus = statusText.trim().toUpperCase();
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
    statusEl.style.color = '#ff6b00';
    lastStatus = '';
    lastTimer = '';
  }

  preloadVoiceAudio();

  const context = cast.framework.CastReceiverContext.getInstance();
  context.addCustomMessageListener(NAMESPACE, event => {
    let data = event.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (_) { return; }
    }
    if (!data || typeof data !== 'object') return;
    if (data.type === 'timer') updateTimer(data);
    if (data.type === 'clear') clearTimer();
  });

  context.start({ disableIdleTimeout: true });
})();
