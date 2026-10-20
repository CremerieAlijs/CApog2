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
  // Komt uit het tabblad "Instellingen" in de Google Sheet (WebsiteData).
  // De waarden hieronder gelden zolang de Sheet niet geladen is.
  // ------------------------------------------------------------------
  const SETTINGS_CSV =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTFHVIq4m5c0quhYDrSoDoYVxV-0LsN5h1ZSzv-hOBFIN6YRFZjkKB59JNWyeLoR7et0p6kHFPgoyxG/pub?gid=1900226224&single=true&output=csv';
  const STANDEN = ['aan', 'gesloten', 'uit'];

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

  // Kolommen A–C: onderdeel, stand, boodschap. Andere rijen en kolommen (het overzicht) tellen niet mee.
  const parseCsv = (text) => {
    const rows = [[]];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { rows.at(-1).push(field); field = ''; }
      else if (c === '\n') { rows.at(-1).push(field); field = ''; rows.push([]); }
      else if (c !== '\r') field += c;
    }
    rows.at(-1).push(field);
    return rows;
  };

  const useSettings = (rows) => {
    let changed = false;
    rows.forEach(([key = '', value = '', boodschap = '']) => {
      key = key.trim().toLowerCase();
      value = value.trim().toLowerCase();
      if (!settings[key] || !STANDEN.includes(value)) return;
      const next = { stand: value, boodschap: boodschap.trim() };
      if (next.stand !== settings[key].stand || next.boodschap !== settings[key].boodschap) changed = true;
      settings[key] = next;
    });
    return changed;
  };

  // Laatst gekende stand eerst, zodat een onderdeel dat uit staat niet even zichtbaar is.
  // Jonger dan 5 minuten: niet opnieuw ophalen (Google ververst het tabblad toch maar om de paar minuten).
  let fresh = false;
  try {
    const cached = JSON.parse(localStorage.getItem('alijs-instellingen'));
    if (cached && Array.isArray(cached.rows)) {
      useSettings(cached.rows);
      fresh = Date.now() - cached.t < 5 * 60 * 1000;
    }
  } catch (e) {
    // Geen opslag beschikbaar: dan gelden de standaardwaarden
  }

  applySegments();

  if (!fresh) {
    fetch(SETTINGS_CSV)
      .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
      .then((text) => {
        const rows = parseCsv(text).map((row) => row.slice(0, 3));
        try {
          localStorage.setItem('alijs-instellingen', JSON.stringify({ t: Date.now(), rows }));
        } catch (e) {
          // Niet erg: volgende keer gewoon opnieuw laden
        }
        if (useSettings(rows)) applySegments();
      })
      .catch(() => {
        // Sheet niet bereikbaar: de standaardwaarden blijven gelden
      });
  }

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

  // ------------------------------------------------------------------
  // Formulieren versturen naar het Google Apps Script (zie google/LEESMIJ.md)
  // ------------------------------------------------------------------
  // Webadres van de Apps Script-implementatie (…/exec). Leeg = nog niet gekoppeld.
  const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwqxYqlbAgkVdvFpWOg6re4MUoYE3CqoyJh8RpqjwcphRGzv0jbNdVpT-dgeET3trgA/exec';
  const geladen = Date.now();

  window.AlijsForms = {
    async send(payload) {
      if (!FORM_ENDPOINT) {
        throw new Error('Online bestellen wordt binnenkort gekoppeld. Mail ons intussen via hallo@alijs.be.');
      }
      // text/plain: geen extra CORS-controle nodig bij Apps Script
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, duur: Date.now() - geladen }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.fout || 'Er liep iets mis. Probeer het later opnieuw of mail naar hallo@alijs.be.');
      return data;
    },
  };

  // De Ape: aanvraagformulier
  document.querySelectorAll('form[data-ape-form]').forEach((form) => {
    const status = form.querySelector('.form-status');
    const knop = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form.inert) return;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const velden = Object.fromEntries(new FormData(form));
      knop.disabled = true;
      status.className = 'form-status';
      status.textContent = 'Even geduld…';
      try {
        await window.AlijsForms.send({ soort: 'ape', ...velden });
        form.innerHTML = `
          <div class="form-done field-full" role="status">
            <h3>Bedankt, we hebben je aanvraag goed ontvangen!</h3>
            <p>We kijken of de Ape vrij is en laten zo snel mogelijk iets weten.</p>
          </div>`;
      } catch (err) {
        status.className = 'form-status is-error';
        status.textContent = err.message;
        knop.disabled = false;
      }
    });
  });
})();
