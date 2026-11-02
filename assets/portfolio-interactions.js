(() => {
  const region = document.querySelector('.binary-transition');
  if (!region) return;
  const canvas = region.querySelector('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, columns = [], frame = 0, lastTime = 0;
  let visible = false;
  const pixels = { '0': ['111','101','101','101','111'], '1': ['010','110','010','010','111'] };

  function resize() {
    width = region.clientWidth;
    height = region.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const spacing = width < 600 ? 27 : 34;
    columns = Array.from({ length: Math.ceil(width / spacing) }, (_, index) => ({
      x: index * spacing + spacing / 2,
      y: Math.random() * (height + 250),
      speed: 12 + Math.random() * 18,
      length: 6 + Math.floor(Math.random() * 9),
      opacity: .45 + Math.random() * .45,
      digits: Array.from({ length: 24 }, () => Math.random() > .5 ? '1' : '0')
    }));
    draw(0);
  }

  function draw(delta) {
    context.clearRect(0, 0, width, height);
    for (const column of columns) {
      column.y += column.speed * delta;
      if (column.y - column.length * 21 > height) column.y = -21;
      for (let j = 0; j < column.length; j++) {
        const y = column.y - j * 21;
        if (y < 0 || y > height) continue;
        context.globalAlpha = (1 - j / column.length) * column.opacity;
        context.fillStyle = j === 0 ? '#176237' : '#34874e';
        const digit = pixels[column.digits[j]];
        const x = Math.round(column.x) - 3;
        const top = Math.round(y) - 10;
        for (let row = 0; row < 5; row++) for (let cell = 0; cell < 3; cell++) {
          if (digit[row][cell] === '1') context.fillRect(x + cell * 2, top + row * 2, 2, 2);
        }
      }
    }
    context.globalAlpha = 1;
  }

  function tick(time) {
    if (!lastTime) lastTime = time;
    const elapsed = time - lastTime;
    if (elapsed >= 33) {
      draw(Math.min(elapsed / 1000, .1));
      lastTime = time;
    }
    frame = requestAnimationFrame(tick);
  }

  function update() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    else draw(0);
  }

  document.addEventListener('visibilitychange', update);
  reduced.addEventListener('change', update);
  new ResizeObserver(resize).observe(region);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    update();
  }, { rootMargin: '100px' }).observe(region);
  resize();
  update();
})();


// Each new pointer entry advances the portrait zoom; leaving preserves the level.
(() => {
  const portrait = document.querySelector('.profile-photo-frame');
  if (!portrait) return;
  const enabled = window.matchMedia('(min-width:681px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
  const scales = [1.6, 1.76, 1.94];
  let level = 0;
  portrait.addEventListener('pointerenter', event => {
    if (!enabled.matches || event.pointerType === 'touch') return;
    level = (level + 1) % scales.length;
    portrait.style.setProperty('--portrait-zoom-scale', String(scales[level]));
    // Keep the face at its starting position as the crop moves closer.
    const extraZoom = scales[level] / scales[0] - 1;
    portrait.style.setProperty('--portrait-pan-x', String(6 * extraZoom) + '%');
    portrait.style.setProperty('--portrait-pan-y', String(48 * extraZoom) + '%');
    portrait.dataset.portraitZoom = String(level);
  });
  enabled.addEventListener('change', () => {
    if (enabled.matches) return;
    level = 0;
    portrait.style.removeProperty('--portrait-zoom-scale');
    portrait.style.removeProperty('--portrait-pan-x');
    portrait.style.removeProperty('--portrait-pan-y');
    portrait.dataset.portraitZoom = '0';
  });
})();
