(() => {
  document.querySelectorAll('#projects .project-grid, #teaching .project-grid').forEach(grid => {
  const cards = [...grid.children].filter(card => card.matches('.project-card'));
  const mobile = window.matchMedia('(max-width: 680px)');
  let queued = false;

  function layout() {
    queued = false;
    if (mobile.matches) {
      grid.classList.remove('is-packed');
      cards.forEach(card => card.style.removeProperty('grid-row-end'));
      return;
    }
    grid.classList.add('is-packed');
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 18;
    const spans = cards.map(card => Math.ceil((card.getBoundingClientRect().height + gap) / 4));
    cards.forEach((card, index) => {
      const span = 'span ' + spans[index];
      if (card.style.gridRowEnd !== span) card.style.gridRowEnd = span;
    });
  }

  function schedule() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(layout);
    }
  }

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    cards.forEach(card => observer.observe(card));
  }
  grid.addEventListener('load', schedule, true);
  window.addEventListener('resize', schedule, { passive: true });
  if (document.fonts) document.fonts.ready.then(schedule);
  schedule();
  });
})();
