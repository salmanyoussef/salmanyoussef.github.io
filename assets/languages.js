// Keep the current section when switching languages. Links also work without JS.
(() => {
  const updateLinks = () => {
    document.querySelectorAll('.language-switcher a').forEach(link => {
      const url = new URL(link.href);
      url.hash = window.location.hash;
      link.href = url.href;
    });
  };
  updateLinks();
  window.addEventListener('hashchange', updateLinks);
})();
