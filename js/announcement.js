/**
 * Cremerie Alijs — Announcement popup
 * Shows the announcement dialog when the site opens, once per browser session.
 *
 * Bump ANNOUNCEMENT_ID whenever the message in index.html changes, so visitors
 * who already dismissed the previous one see the new message again.
 *
 * Testing: add ?popup=1 to the URL to force it open, ?popup=0 to skip it.
 */

(function () {
  'use strict';

  const ANNOUNCEMENT_ID = 'openingsuren-19u';
  const STORAGE_KEY = 'alijs-announcement-' + ANNOUNCEMENT_ID;
  const OPEN_DELAY = 800;

  /**
   * Read the ?popup= override from the URL
   * @returns {boolean|null} - true to force open, false to skip, null when absent
   */
  function getOverride() {
    const value = new URLSearchParams(window.location.search).get('popup');
    if (value === null) return null;
    return value !== '0' && value !== 'false';
  }

  function wasDismissed() {
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) === 'dismissed';
    } catch (error) {
      // Private mode or storage disabled — just show it again next visit
      return false;
    }
  }

  function rememberDismissal() {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, 'dismissed');
    } catch (error) {
      /* nothing to do — the popup simply reappears next visit */
    }
  }

  /**
   * Initialize the announcement popup
   */
  function init() {
    const dialog = document.getElementById('announcement');
    if (!dialog || typeof dialog.showModal !== 'function') return;

    const override = getOverride();
    if (override === false) return;
    if (override !== true && wasDismissed()) return;

    const closeButton = document.getElementById('announcement-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => dialog.close());
    }

    // Any link or button marked as a dismiss target closes the popup too
    dialog.querySelectorAll('[data-announcement-dismiss]').forEach((element) => {
      element.addEventListener('click', () => dialog.close());
    });

    // Click outside the card (on the backdrop) closes it
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener('close', rememberDismissal);

    window.setTimeout(() => {
      if (!dialog.open) dialog.showModal();
    }, OPEN_DELAY);
  }

  // Expose a small API for debugging
  window.AlijsAnnouncement = {
    ANNOUNCEMENT_ID,
    open: () => {
      const dialog = document.getElementById('announcement');
      if (dialog && !dialog.open) dialog.showModal();
    },
    reset: () => {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        /* ignore */
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
