(() => {
  'use strict';

  const NAMESPACE = 'urn:x-cast:com.example.crossboxpro.timer';
  const statusEl = document.getElementById('statusText');
  const timerEl = document.getElementById('timerText');
  const footerEl = document.getElementById('footerText');

  let lastStatus = '';
  let lastTimer = '';
  let audioContext = null;

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

  function maybePlayCue(statusText, timerText) {
    const status = String(statusText || '').trim().toUpperCase();
    const prev = String(lastStatus || '').trim().toUpperCase();
    const timer = String(timerText || '').trim();

    const preparing = status.includes('PREPAR') || status.includes('GET READY');
    if (preparing && timer !== lastTimer && /^(1|2|3|4|5)$/.test(timer)) {
      countdownCue();
    }

    if (status !== prev) {
      if (
        status.includes('FINE') ||
        status.includes('DONE') ||
        status.includes('COMPLET') ||
        status.includes('TIME CAP')
      ) {
        finishCue();
      } else if (status.includes('REST')) {
        restCue();
      } else if (
        prev.includes('REST') ||
        prev.includes('PREPAR') ||
        prev.includes('GET READY')
      ) {
        workCue();
      }
    }

    lastStatus = statusText || '';
    lastTimer = timer;
  }

  function updateTimer(data) {
    const statusText = String(data.statusText || '');
    const timerText = String(data.timerText || '');
    const footerText = String(data.footerText || '');

    maybePlayCue(statusText, timerText);

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
