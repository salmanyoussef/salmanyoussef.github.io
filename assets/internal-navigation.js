(() => {
  const nav = document.querySelector('.nav');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let pending = 0;

  function headerSpace() {
    const rect = nav && nav.getBoundingClientRect();
    const height = rect && ['sticky', 'fixed'].includes(getComputedStyle(nav).position)
      ? Math.max(0, rect.bottom) : 0;
    document.documentElement.style.setProperty('--anchor-header-space', Math.ceil(height + 16) + 'px');
    return height;
  }

  function targetFor(hash) {
    if (!hash || hash === '#') return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return null; }
  }

  function reveal(target) {
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
  }

  function align(behavior, focus) {
    const target = targetFor(location.hash);
    if (!target) return;
    reveal(target);
    // Large sections start with their actual content, rather than their top padding.
    const content = target.tagName === 'SECTION'
      ? target.querySelector(':scope > .container') || target : target;
    const rect = content.getBoundingClientRect();
    const top = headerSpace() + 16;
    const available = Math.max(0, window.innerHeight - top - 16);
    const inset = top + Math.max(0, (available - rect.height) / 2);
    const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const scrollTop = Math.max(0, Math.min(maximum, window.scrollY + rect.top - inset));
    if (focus) {
      const addedTabIndex = !target.hasAttribute('tabindex') && target.tabIndex < 0;
      if (addedTabIndex) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
      target.focus({ preventScroll: true });
    }
    window.scrollTo({ top: scrollTop, behavior: reduced.matches ? 'instant' : behavior });
  }

  function schedule(behavior = 'instant', focus = false) {
    cancelAnimationFrame(pending);
    // Allow packed project layouts and expanded details to finish before measuring.
    pending = requestAnimationFrame(() => {
      pending = requestAnimationFrame(() => align(behavior, focus));
    });
  }

  const pagePath = path => path.replace(/\/index\.html$/, '/').replace(/\/$/, '');
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || pagePath(url.pathname) !== pagePath(location.pathname) || url.search !== location.search) return;
    const target = targetFor(url.hash);
    if (!target) return;
    event.preventDefault();
    reveal(target);
    const oldURL = location.href;
    if (location.hash !== url.hash) history.pushState(null, '', url);
    // Preserve language-switcher hash synchronization without triggering a native jump.
    window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: location.href }));
    schedule('smooth', true);
  });

  window.addEventListener('hashchange', () => schedule());
  window.addEventListener('popstate', () => schedule());
  window.addEventListener('resize', headerSpace, { passive: true });
  if (nav && 'ResizeObserver' in window) new ResizeObserver(headerSpace).observe(nav);
  headerSpace();
  window.addEventListener('load', () => {
    const ready = document.fonts ? document.fonts.ready : Promise.resolve();
    ready.then(() => schedule());
  }, { once: true });
})();
