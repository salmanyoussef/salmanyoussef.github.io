// Optional matchday footage: load and play only when the visitor chooses.
(() => {
  for (const button of document.querySelectorAll('[data-matchday-open]')) {
    const dialog = document.getElementById(button.dataset.matchdayOpen);
    if (!dialog) continue;
    button.addEventListener('click', () => dialog.showModal());
  }
  for (const dialog of document.querySelectorAll('.matchday-dialog')) {
    dialog.querySelector('[data-matchday-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.querySelector('video').pause());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  }
})();
