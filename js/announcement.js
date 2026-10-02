/**
 * Cremerie Alijs — Announcement popup
 * Shows the announcement dialog when the site opens, once per browser session.
 *
 * The dialog in index.html holds several variants; VARIANTS below decides which
 * one is shown on which dates. Outside every date range no popup appears.
 * Each variant has its own id, so visitors who dismissed one variant still
 * see the next one.
 *
 * Testing: add ?popup=<variant id> to show a specific variant (e.g. ?popup=verlof),
 * ?popup=1 to force the current variant open, ?popup=0 to skip it.
 */

(function () {
  'use strict';

  /** Date ranges are inclusive, in YYYY-MM-DD (visitor's local date) */
  const VARIANTS = [
    { id: 'voor-verlof', from: '2026-10-01', until: '2026-10-04' },
    { id: 'verlof', from: '2026-10-05', until: '2026-10-11' }
  ];
  const STORAGE_PREFIX = 'alijs-announcement-';
  const OPEN_DELAY = 800;

  /**
   * Format a date as YYYY-MM-DD in local time
   * @param {Date} date
   * @returns {string}
   */
  function toDateKey(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  /**
   * Find the variant whose date range contains the given date
   * @param {Date} date
   * @returns {string|null} - variant id, or null when no announcement applies
   */
  function detectVariant(date) {
    const key = toDateKey(date);
    const match = VARIANTS.find((variant) => key >= variant.from && key <= variant.until);
    return match ? match.id : null;
  }

  /**
   * Read the ?popup= override from the URL
   * @returns {string|boolean|null} - variant id or true to force open, false to skip, null when absent
   */
  function getOverride() {
    const value = new URLSearchParams(window.location.search).get('popup');
    if (value === null) return null;
    if (value === '0' || value === 'false') return false;
    if (VARIANTS.some((variant) => variant.id === value)) return value;
    return true;
  }

  function wasDismissed(variantId) {
    try {
      return window.sessionStorage.getItem(STORAGE_PREFIX + variantId) === 'dismissed';
    } catch (error) {
      // Private mode or storage disabled — just show it again next visit
      return false;
    }
  }

  function rememberDismissal(variantId) {
    try {
      window.sessionStorage.setItem(STORAGE_PREFIX + variantId, 'dismissed');
    } catch (error) {
      /* nothing to do — the popup simply reappears next visit */
    }
  }

  /**
   * Show only the chosen variant inside the dialog
   * @param {HTMLDialogElement} dialog
   * @param {string} variantId
   * @returns {boolean} - false when the variant is missing from the markup
   */
  function selectVariant(dialog, variantId) {
    let found = false;
    dialog.querySelectorAll('[data-announcement-variant]').forEach((element) => {
      const isActive = element.dataset.announcementVariant === variantId;
      element.hidden = !isActive;
      if (isActive) {
        found = true;
        const title = element.querySelector('h2');
        if (title) dialog.setAttribute('aria-labelledby', title.id);
      }
    });
    return found;
  }

  /**
   * Initialize the announcement popup
   */
  function init() {
    const dialog = document.getElementById('announcement');
    if (!dialog || typeof dialog.showModal !== 'function') return;

    const override = getOverride();
    if (override === false) return;

    const variantId = typeof override === 'string' ? override : detectVariant(new Date());
    if (!variantId) return;
    if (override === null && wasDismissed(variantId)) return;
    if (!selectVariant(dialog, variantId)) return;

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

    dialog.addEventListener('close', () => rememberDismissal(variantId));

    window.setTimeout(() => {
      if (!dialog.open) dialog.showModal();
    }, OPEN_DELAY);
  }

  // Expose a small API for debugging
  window.AlijsAnnouncement = {
    VARIANTS,
    detectVariant,
    open: (variantId) => {
      const dialog = document.getElementById('announcement');
      const id = variantId || detectVariant(new Date());
      if (dialog && id && selectVariant(dialog, id) && !dialog.open) dialog.showModal();
    },
    reset: () => {
      try {
        VARIANTS.forEach((variant) => window.sessionStorage.removeItem(STORAGE_PREFIX + variant.id));
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
