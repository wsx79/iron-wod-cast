(() => {
  'use strict';

  const NAMESPACE = 'urn:x-cast:com.example.crossboxpro.timer';
  const context = cast.framework.CastReceiverContext.getInstance();
  const card = document.getElementById('timer-card');
  const status = document.getElementById('status');
  const time = document.getElementById('time');
  const footer = document.getElementById('footer');

  function showTimer(data) {
    if (!data || data.type !== 'timer') return;
    status.textContent = data.statusText || 'IRON WOD';
    time.textContent = data.timerText || '00:00';
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
