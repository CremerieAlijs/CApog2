/**
 * Cremerie Alijs — gedeelde scripts voor alle pagina's
 * Gsm-menu, Ape-tekeningen, onderdelen aan/uit, menukaart-snelbalk.
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------
  // Gsm-menu
  // ------------------------------------------------------------------
  const nav = document.querySelector('.site-nav');
  const toggle = document.querySelector('.nav-toggle');
  if (nav && toggle) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // ------------------------------------------------------------------
  // Lijntekeningen inline laden zodat ze de themakleur (currentColor) volgen
  // ------------------------------------------------------------------
  document.querySelectorAll('[data-inline-svg]').forEach(async (el) => {
    try {
      const res = await fetch(el.dataset.inlineSvg);
      const svg = new DOMParser()
        .parseFromString(await res.text(), 'image/svg+xml')
        .documentElement;
      el.append(document.importNode(svg, true));
    } catch (e) {
      // Zonder tekening blijft de pagina gewoon bruikbaar
    }
  });

  // ------------------------------------------------------------------
  // Onderdelen aan/uit: aan, gesloten (zichtbaar, niet bestelbaar) of uit.
  // TODO: inlezen uit het tabblad "Instellingen" in de Google Sheet.
  // ------------------------------------------------------------------
  const SEGMENTS = {
    ijstaarten: {
      title: 'IJstaarten',
      closed: 'We nemen tijdelijk geen bestellingen voor ijstaarten aan.',
      off: 'Onze ijstaarten zijn er even niet. Kom gerust langs voor een bolletje.',
    },
    eindejaar: {
      title: 'Eindejaarstaarten',
      closed: 'Bestellen voor het eindejaar is afgesloten.',
      off: '',
    },
    ape: {
      title: 'De Ape',
      closed: 'De Ape houdt even pauze. Aanvragen kunnen tijdelijk niet.',
      off: 'De Ape rijdt momenteel niet uit.',
    },
  };

  const settings = {
    ijstaarten: { stand: 'aan', boodschap: '' },
    eindejaar: { stand: 'uit', boodschap: '' },
    ape: { stand: 'aan', boodschap: '' },
  };

  const listeners = [];
  const stand = (key) => settings[key]?.stand ?? 'aan';
  const message = (key, kind) => settings[key]?.boodschap || SEGMENTS[key]?.[kind] || '';

  window.AlijsSegments = {
    stand,
    message: (key) => message(key, stand(key) === 'uit' ? 'off' : 'closed'),
    onChange: (fn) => listeners.push(fn),
  };

  const applySegments = () => {
    document.querySelectorAll('[data-segment]').forEach((el) => {
      el.hidden = stand(el.dataset.segment) === 'uit';
    });

    const page = document.body.dataset.pageSegment;
    document.querySelectorAll('.segment-notice').forEach((el) => el.remove());
    const hero = document.querySelector('header.hero');
    const main = document.querySelector('main');
    if (hero) hero.hidden = false;
    if (main) main.hidden = false;
    document.querySelectorAll('[data-segment-form]').forEach((form) => {
      form.inert = false;
      form.classList.remove('is-closed');
    });
    document.querySelectorAll('[data-segment-action]').forEach((btn) => (btn.disabled = false));

    if (page && main && stand(page) === 'uit') {
      // Pagina staat uit: vriendelijke melding in plaats van de inhoud
      if (hero) hero.hidden = true;
      main.hidden = true;
      const notice = document.createElement('section');
      notice.className = 'segment-notice segment-off';
      notice.innerHTML = `
        <div class="section-inner">
          <h1>${SEGMENTS[page].title}</h1>
          <p>${message(page, 'off')}</p>
          <a href="/" class="btn btn-light">Naar de homepage</a>
        </div>`;
      main.before(notice);
    } else if (page && main && stand(page) === 'gesloten') {
      // Pagina zichtbaar, maar bestellen of aanvragen kan niet
      const notice = document.createElement('div');
      notice.className = 'segment-notice segment-closed';
      notice.setAttribute('role', 'status');
      notice.innerHTML = `<div class="section-inner"><p>${message(page, 'closed')}</p></div>`;
      main.prepend(notice);
      document.querySelectorAll('[data-segment-form]').forEach((form) => {
        form.inert = true;
        form.classList.add('is-closed');
      });
      document.querySelectorAll('[data-segment-action]').forEach((btn) => (btn.disabled = true));
    }

    listeners.forEach((fn) => fn());
  };

  applySegments();

  // ------------------------------------------------------------------
  // Menukaart: de rubriek waar je bent licht op in de snelbalk
  // ------------------------------------------------------------------
  const jump = document.querySelector('.menu-jump');
  if (jump && 'IntersectionObserver' in window) {
    const links = [...jump.querySelectorAll('a')];
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry) => {
            links.forEach((a) => a.classList.toggle('is-active', a.hash === `#${entry.target.id}`));
            links.find((a) => a.classList.contains('is-active'))?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    links.forEach((a) => {
      const target = document.querySelector(a.hash);
      if (target) observer.observe(target);
    });
  }

  // ------------------------------------------------------------------
  // De Ape: knoppen bij een formule kiezen die formule in het formulier
  // ------------------------------------------------------------------
  document.querySelectorAll('[data-pick-formule]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const radio = document.querySelector(`input[name="formule"][value="${btn.dataset.pickFormule}"]`);
      if (radio) radio.checked = true;
    });
  });

  // TODO (to-do forms): versturen via Google Apps Script
  document.querySelectorAll('form[data-pending-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (form.inert) return;
      alert('Het formulier wordt nog gekoppeld. Mail ons intussen via hallo@alijs.be.');
    });
  });
})();
