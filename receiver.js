(() => {
  'use strict';

  const NAMESPACE = 'urn:x-cast:com.example.crossboxpro.timer';
  const context = cast.framework.CastReceiverContext.getInstance();
  const card = document.getElementById('timer-card');
  const status = document.getElementById('status');
  const time = document.getElementById('time');
  const timeCap = document.getElementById('time-cap');
  const footer = document.getElementById('footer');

  const AUDIO_MODE = Object.freeze({
    VOICE: 'VOICE',
    SOUNDS: 'SOUNDS',
    SILENT: 'SILENT'
  });

  const SUPPORTED_VOICE_LANGUAGES = new Set(['it', 'en', 'es']);
  const AUDIO_ASSET_VERSION = '20260821-g112';

  let previousAudioSnapshot = null;
  let currentVoice = null;
  let audioContext = null;

  function normalizeAudioMode(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return Object.values(AUDIO_MODE).includes(normalized) ? normalized : AUDIO_MODE.SOUNDS;
  }

  function normalizeVoiceLanguage(value) {
    const raw = String(value || '').trim().toLowerCase();
    const primary = raw.split(/[-_]/)[0];
    return SUPPORTED_VOICE_LANGUAGES.has(primary) ? primary : 'en';
  }

  function normalizedStatus(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function isPreparationStatus(value) {
    const text = normalizedStatus(value);
    return text.includes('GET READY') ||
      text.includes('READY') ||
      text.includes('PREP') ||
      text.includes('PREPAR');
  }

  function isRestStatus(value) {
    const text = normalizedStatus(value);
    return text === 'REST' ||
      text.includes('REST ') ||
      text.includes(' RIPOS') ||
      text.startsWith('RIPOS') ||
      text.includes('DESCANS') ||
      text.startsWith('PAUSA');
  }

  function isWorkStatus(value) {
    const text = normalizedStatus(value);
    return text === 'WORK' ||
      text.startsWith('WORK ') ||
      text.includes(' LAVOR') ||
      text.startsWith('LAVOR') ||
      text.includes('TRABAJO') ||
      text.startsWith('TRABAJO');
  }

  function isFinishedStatus(value) {
    const text = normalizedStatus(value);
    return text.includes('FINISH') ||
      text.includes('COMPLET') ||
      text.includes('DONE') ||
      text.includes('TIME UP') ||
      text.includes('TERMIN') ||
      text.includes('FINE') ||
      text.includes('TEMPO SCADUTO') ||
      text.includes('TIEMPO AGOTADO');
  }

  function countdownNumber(data) {
    if (!isPreparationStatus(data.statusBaseText || data.statusText)) return null;
    const raw = String(data.timerText || '').trim();
    if (!/^\d{1,2}$/.test(raw)) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null;
  }

  function getAudioContext() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  }

  function playTone(frequency, durationMs, delayMs = 0, gainValue = 0.22) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startAt = ctx.currentTime + delayMs / 1000;
    const stopAt = startAt + durationMs / 1000;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.008);
    gain.gain.setValueAtTime(gainValue, Math.max(startAt + 0.009, stopAt - 0.035));
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(stopAt + 0.01);
  }

  function beepCountdown(number) {
    const finalThree = number <= 3;
    playTone(finalThree ? 1046.5 : 784, finalThree ? 150 : 95);
  }

  function beepGoOrWork() {
    playTone(1174.7, 180, 0);
    playTone(1568, 260, 215);
  }

  function beepRest() {
    playTone(659.3, 180, 0);
    playTone(523.3, 220, 210);
  }

  function beepComplete() {
    playTone(1046.5, 150, 0);
    playTone(1318.5, 150, 190);
    playTone(1568, 360, 380);
  }

  function voiceUrl(language, cue) {
    const safeLanguage = normalizeVoiceLanguage(language);
    const safeCue = String(cue).replace(/[^a-z0-9_-]/gi, '');
    return new URL(`voice/${safeLanguage}/${safeCue}.mp3?v=${AUDIO_ASSET_VERSION}`, window.location.href).href;
  }

  function stopCurrentVoice() {
    if (!currentVoice) return;
    try {
      currentVoice.pause();
      currentVoice.currentTime = 0;
    } catch (_) {
      // Best-effort cleanup only.
    }
    currentVoice = null;
  }

  function fallbackBeepForCue(cue) {
    if (/^\d+$/.test(cue)) {
      beepCountdown(Number(cue));
    } else if (cue === 'rest') {
      beepRest();
    } else if (cue === 'complete') {
      beepComplete();
    } else {
      beepGoOrWork();
    }
  }

  function playVoiceCue(language, cue) {
    stopCurrentVoice();

    const audio = new Audio();
    currentVoice = audio;
    audio.preload = 'auto';
    audio.src = voiceUrl(language, cue);
    audio.volume = 1.0;

    let fallbackPlayed = false;
    const fallback = () => {
      if (fallbackPlayed || currentVoice !== audio) return;
      fallbackPlayed = true;
      console.warn(`IRON WOD voice cue unavailable: ${audio.src}`);
      fallbackBeepForCue(String(cue));
    };

    audio.onerror = fallback;
    audio.onended = () => {
      if (currentVoice === audio) currentVoice = null;
    };

    const result = audio.play();
    if (result && typeof result.catch === 'function') {
      result.catch(error => {
        console.warn('IRON WOD Cast voice playback rejected', error);
        fallback();
      });
    }
  }

  function cueForTransition(previous, current) {
    const statusText = current.statusBaseText || current.statusText || '';
    const previousStatus = previous ? (previous.statusBaseText || previous.statusText || '') : '';

    const number = countdownNumber(current);
    const previousNumber = previous ? countdownNumber(previous) : null;
    if (number !== null && number !== previousNumber) {
      return String(number);
    }

    if (previous && isPreparationStatus(previousStatus) && !isPreparationStatus(statusText)) {
      return 'go';
    }

    if (isFinishedStatus(statusText) && (!previous || !isFinishedStatus(previousStatus))) {
      return 'complete';
    }

    if (isRestStatus(statusText) && (!previous || !isRestStatus(previousStatus))) {
      return 'rest';
    }

    if (isWorkStatus(statusText) && (!previous || !isWorkStatus(previousStatus))) {
      return 'work';
    }

    return null;
  }

  function handleTimerAudio(data) {
    const current = {
      statusText: data.statusText || '',
      statusBaseText: data.statusBaseText || '',
      timerText: data.timerText || '',
      audioMode: normalizeAudioMode(data.audioMode),
      voiceLanguage: normalizeVoiceLanguage(data.voiceLanguage)
    };

    const cue = cueForTransition(previousAudioSnapshot, current);
    previousAudioSnapshot = current;

    if (!cue || current.audioMode === AUDIO_MODE.SILENT) return;

    if (current.audioMode === AUDIO_MODE.VOICE) {
      playVoiceCue(current.voiceLanguage, cue);
      return;
    }

    if (/^\d+$/.test(cue)) {
      beepCountdown(Number(cue));
    } else if (cue === 'rest') {
      beepRest();
    } else if (cue === 'complete') {
      beepComplete();
    } else {
      beepGoOrWork();
    }
  }

  function showTimer(data) {
    if (!data || data.type !== 'timer') return;
    const rawStatus = data.statusText || '';
    const legacyParts = rawStatus.split('•').map(part => part.trim());
    const legacyTimeCap = legacyParts.length > 1 && legacyParts[1].toUpperCase().startsWith('TIME CAP')
      ? legacyParts.slice(1).join(' • ')
      : '';
    const baseStatus = data.statusBaseText || (legacyTimeCap ? legacyParts[0] : rawStatus) || 'IRON WOD';
    const resolvedTimeCap = data.timeCapText || legacyTimeCap;

    status.textContent = baseStatus;
    time.textContent = data.timerText || '00:00';
    timeCap.textContent = resolvedTimeCap;
    timeCap.classList.toggle('hidden', !resolvedTimeCap);
    footer.textContent = data.footerText || 'TIMER';
    document.documentElement.style.setProperty('--accent', data.accentColor || '#ff6d00');
    card.classList.remove('hidden');

    handleTimerAudio(data);
  }

  context.addCustomMessageListener(NAMESPACE, event => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data && data.type === 'clear') {
        stopCurrentVoice();
        previousAudioSnapshot = null;
        card.classList.add('hidden');
        return;
      }
      showTimer(data);
    } catch (error) {
      console.error('IRON WOD receiver message error', error);
    }
  });

  context.start();
})();
