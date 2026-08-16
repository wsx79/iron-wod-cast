(() => {
  'use strict';

  const NAMESPACE = 'urn:x-cast:com.example.crossboxpro.timer';
  const context = cast.framework.CastReceiverContext.getInstance();
  const card = document.getElementById('timer-card');
  const status = document.getElementById('status');
  const time = document.getElementById('time');
  const timeCap = document.getElementById('time-cap');
  const footer = document.getElementById('footer');

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
  }

  context.addCustomMessageListener(NAMESPACE, event => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data && data.type === 'clear') {
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
