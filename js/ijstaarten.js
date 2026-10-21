// Cremerie Alijs — ijstaarten (/ijstaarten) en feestdagen (/feestdagen): keuzevenster, mandje en afhaalregels.
// Elke pagina heeft een eigen mandje en een eigen bestelling.
(function () {
  'use strict';

  const XMAS = document.body.dataset.pageSegment === 'eindejaar';
  const PAGE_SEGMENT = XMAS ? 'eindejaar' : 'ijstaarten';
  const STORE_KEY = XMAS ? 'alijs-feesttaarten' : 'alijs-taarten';

  const LEAD_DAYS = 14;

  // Smaakcombinaties voor het eindejaar
  const COMBOS = [
    'Vanille & chocolade',
    'Vanille & mokka',
    'Hazelnoot & chocolade (vegan)',
    'Framboos & stracciatella',
  ];

  // Prijzen in euro; null = nog niet gekend
  const YEAR_SIZES = [
    { value: '4-6', label: '4 à 6 personen', price: 31.75 },
    { value: '8-10', label: '8 à 10 personen', price: 57.15 },
  ];
  const PRODUCTS = {
    ijstaart: { name: 'IJstaart', kind: 'year' },
    buche34: { name: 'Stronk (bûche), 3 à 4 personen', kind: 'xmas', price: 22.25 },
    rond46: { name: 'Ronde taart, 4 à 6 personen', kind: 'xmas', price: 31.75 },
    buche68: { name: 'Stronk (bûche), 6 à 8 personen', kind: 'xmas', price: 44.45 },
    rond810: { name: 'Ronde taart, 8 à 10 personen', kind: 'xmas', price: 57.15 },
  };

  const euro = (n) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(n);

  // Uitzonderingen op de gewone openingsuren
  const SPECIAL_DAYS = {
    '2026-12-24': { open: '10:00', close: '14:00' },
    '2026-12-25': null,
    '2026-12-31': { open: '10:00', close: '14:00' },
  };
  const XMAS_DAYS = ['2026-12-24', '2026-12-31'];
  const XMAS_ORDER_DEADLINE = '2026-12-06';
  const segment = (key) => window.AlijsSegments?.stand(key) ?? 'aan';
  const CLOSED_FROM = '2027-01-01'; // tot wanneer? nog aan te vullen

  const FALLBACK_FLAVORS = ['Vanille', 'Chocolade', 'Mokka', 'Stracciatella', 'Pistache', 'Aardbei'];

  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromIso = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const longDate = (s) =>
    new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }).format(fromIso(s));

  // ---------------------------------------------------------------- mandje
  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  } catch (e) {
    cart = [];
  }
  // Taarten die niet (meer) op deze pagina horen, vallen uit het mandje
  cart = cart.filter(
    (item) => item && PRODUCTS[item.id] && PRODUCTS[item.id].kind === (XMAS ? 'xmas' : 'year') && (item.id !== 'ijstaart' || item.maat)
  );

  const saveCart = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(cart));
    } catch (e) {
      // zonder opslag werkt het mandje gewoon tot de pagina sluit
    }
  };

  const renderCart = () => {
    const list = $('#cart-list');
    list.innerHTML = '';
    cart.forEach((item, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div><strong>${item.qty}× ${item.name}</strong><span>${item.detail}</span></div>
        <button type="button" class="cart-remove" aria-label="Verwijder ${item.name}">Verwijder</button>`;
      li.querySelector('button').addEventListener('click', () => {
        cart.splice(i, 1);
        saveCart();
        renderCart();
        setupPickup();
      });
      list.append(li);
    });
    const count = cart.reduce((n, item) => n + item.qty, 0);
    document.querySelectorAll('[data-cart-count]').forEach((el) => (el.textContent = count));
    $('#cart-empty').hidden = cart.length > 0;
    $('#cart-total').hidden = cart.length === 0;
    // Totaal tonen zodra van alle taarten in het mandje de prijs gekend is
    const known = cart.every((item) => typeof item.price === 'number');
    $('#cart-total strong').innerHTML = known
      ? euro(cart.reduce((sum, item) => sum + item.price * item.qty, 0))
      : '<span class="ph">€ ··</span>';
  };

  // ---------------------------------------------------------------- smaken & uren uit de Sheet
  const flavors = () => {
    const items = [...document.querySelectorAll('#tastes-list li')].map((li) => li.textContent.trim());
    return items.length > 1 ? items : FALLBACK_FLAVORS;
  };

  const weeklyHours = () => {
    const hours = {};
    document.querySelectorAll('#opening-hours li').forEach((li) => {
      const day = li.querySelector('.hours-day')?.textContent.trim().toLowerCase();
      const times = [...(li.querySelector('.hours-time')?.textContent || '').matchAll(/(\d{1,2})u(\d{2})/g)];
      if (!day) return;
      hours[day] = times.length === 2 ? { open: `${pad(times[0][1])}:${times[0][2]}`, close: `${pad(times[1][1])}:${times[1][2]}` } : null;
    });
    return hours;
  };

  const hoursFor = (dateIso) => {
    if (dateIso in SPECIAL_DAYS) return SPECIAL_DAYS[dateIso];
    if (dateIso >= CLOSED_FROM) return null;
    const day = new Intl.DateTimeFormat('nl-BE', { weekday: 'long' }).format(fromIso(dateIso)).toLowerCase();
    return weeklyHours()[day] ?? null;
  };

  const minDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + LEAD_DAYS);
    return iso(d);
  };

  // ---------------------------------------------------------------- afhalen
  const dateInput = $('#pickup-date');
  const dateSelect = $('#pickup-date-select');
  const timeSelect = $('#pickup-time');
  const pickupError = $('#pickup-error');

  const fillTimes = (dateIso) => {
    timeSelect.innerHTML = '';
    pickupError.textContent = '';
    const hours = dateIso ? hoursFor(dateIso) : undefined;
    if (!dateIso) {
      timeSelect.innerHTML = '<option value="">Kies eerst een dag</option>';
      timeSelect.disabled = true;
      return;
    }
    if (dateIso < minDate()) {
      pickupError.textContent = `Bestel liefst twee weken op voorhand: de eerste mogelijke dag is ${longDate(minDate())}.`;
    } else if (!hours) {
      pickupError.textContent = `Op ${longDate(dateIso)} zijn we gesloten. Kies een andere dag.`;
    }
    if (dateIso < minDate() || !hours) {
      timeSelect.innerHTML = '<option value="">Kies een andere dag</option>';
      timeSelect.disabled = true;
      return;
    }
    const [oh, om] = hours.open.split(':').map(Number);
    const [ch, cm] = hours.close.split(':').map(Number);
    timeSelect.append(new Option('Kies een uur', ''));
    for (let t = oh * 60 + om; t <= ch * 60 + cm - 30; t += 30) {
      const label = `${pad(Math.floor(t / 60))}u${pad(t % 60)}`;
      timeSelect.append(new Option(label, label));
    }
    timeSelect.disabled = false;
  };

  const setupPickup = () => {
    dateInput.hidden = XMAS;
    dateInput.disabled = XMAS;
    dateSelect.hidden = !XMAS;
    dateSelect.disabled = !XMAS;
    if (XMAS) {
      $('#pickup-hint').textContent = 'Je haalt je taart af op 24 of 31 december, tussen 10 en 14 uur.';
      dateSelect.innerHTML = '';
      dateSelect.append(new Option('Kies een dag', ''));
      XMAS_DAYS.filter((d) => d >= minDate()).forEach((d) => dateSelect.append(new Option(longDate(d), d)));
      fillTimes(dateSelect.value);
    } else {
      $('#pickup-hint').textContent = 'Liefst twee weken op voorhand, tijdens onze openingsuren.';
      dateInput.min = minDate();
      fillTimes(dateInput.value);
    }
  };

  dateInput.addEventListener('change', () => fillTimes(dateInput.value));
  dateSelect.addEventListener('change', () => fillTimes(dateSelect.value));

  // ---------------------------------------------------------------- keuzevenster
  const picker = $('#picker');
  const pickerFields = $('#picker-fields');
  const pickerError = $('#picker-error');
  let current = null;

  const flavorSelect = (id, label) => `
    <div class="field">
      <label for="${id}">${label}</label>
      <select id="${id}" required>
        <option value="">Kies een smaak</option>
        ${flavors().map((f) => `<option>${f}</option>`).join('')}
      </select>
    </div>`;

  const openPicker = (id) => {
    current = id;
    const product = PRODUCTS[id];
    $('#picker-title').textContent = id === 'ijstaart' ? 'Stel je ijstaart samen' : product.name;
    pickerError.textContent = '';
    $('#picker-qty').value = 1;
    if (id === 'ijstaart') {
      pickerFields.innerHTML = `
        <fieldset class="field">
          <legend>Voor hoeveel personen?</legend>
          <div class="radio-pills">
            ${YEAR_SIZES.map((sz, i) => `<label><input type="radio" name="size" value="${sz.value}" ${i === 0 ? 'checked' : ''} /> ${sz.label}</label>`).join('')}
          </div>
        </fieldset>
        <div class="picker-flavors">
          ${flavorSelect('flavor-1', 'Smaak 1')}
          ${flavorSelect('flavor-2', 'Smaak 2')}
        </div>
        <p class="hint">Liever één smaak? Kies twee keer dezelfde, dan maken we de hele taart in die smaak.</p>`;
    } else {
      pickerFields.innerHTML = `
        <fieldset class="field">
          <legend>Kies je smaakcombinatie</legend>
          <div class="radio-stack">
            ${COMBOS.map((c, i) => `<label><input type="radio" name="combo" value="${c}" ${i === 0 ? 'checked' : ''} /> ${c}</label>`).join('')}
          </div>
        </fieldset>`;
    }
    picker.showModal();
  };

  document.querySelectorAll('[data-open-product]').forEach((btn) =>
    btn.addEventListener('click', () => openPicker(btn.dataset.openProduct))
  );
  $('#picker-close').addEventListener('click', () => picker.close());

  $('#picker-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const qty = Math.max(1, Math.min(10, Number($('#picker-qty').value) || 1));
    let name = PRODUCTS[current].name;
    let detail;
    let price = PRODUCTS[current].price ?? null;
    // Gestructureerde keuze, zodat het script zelf de prijs en regels controleert
    const keuze = {};
    if (current === 'ijstaart') {
      const size = picker.querySelector('input[name="size"]:checked').value;
      const f1 = $('#flavor-1').value;
      const f2 = $('#flavor-2').value;
      if (!f1 || !f2) {
        pickerError.textContent = 'Kies twee smaken.';
        return;
      }
      const chosen = YEAR_SIZES.find((sz) => sz.value === size);
      name = `Ronde ijstaart, ${chosen.label}`;
      price = chosen.price;
      // Twee keer dezelfde smaak = een volledige taart in die smaak
      detail = f1 === f2 ? `volledig ${f1}` : `${f1} & ${f2}`;
      Object.assign(keuze, { maat: size, smaak1: f1, smaak2: f2 });
    } else {
      detail = picker.querySelector('input[name="combo"]:checked').value;
      keuze.combinatie = detail;
    }
    cart.push({ id: current, name, detail, qty, price, ...keuze });
    saveCart();
    renderCart();
    picker.close();
    $('#bestellen').scrollIntoView({ behavior: 'smooth' });
  });

  // ---------------------------------------------------------------- versturen
  $('#order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (segment(PAGE_SEGMENT) !== 'aan') return;
    if (cart.length === 0) {
      pickupError.textContent = 'Je bestelling is nog leeg. Kies eerst een taart.';
      $('#bestellen').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const day = XMAS ? dateSelect.value : dateInput.value;
    if (!day || !timeSelect.value) {
      pickupError.textContent ||= 'Kies een dag en een uur om af te halen.';
      timeSelect.focus();
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    const status = $('#order-status');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.className = 'form-status';
    status.textContent = 'Even geduld…';
    try {
      await window.AlijsForms.send({
        soort: 'ijstaarten',
        items: cart.map(({ id, qty, maat, smaak1, smaak2, combinatie }) => ({ id, aantal: qty, maat, smaak1, smaak2, combinatie })),
        dag: day,
        uur: timeSelect.value,
        naam: data.get('naam'),
        telefoon: data.get('telefoon'),
        email: data.get('email'),
        opmerking: data.get('opmerking'),
        website: data.get('website'),
      });
      const summary = cart.map((item) => `${item.qty}× ${item.name} (${item.detail})`).join(', ');
      cart = [];
      saveCart();
      renderCart();
      form.innerHTML = `
        <div class="form-done field-full" role="status">
          <h2>Bedankt, je bestelling is goed aangekomen!</h2>
          <p>${summary}, af te halen op ${longDate(day)} om ${timeSelect.value}.</p>
          <p>Je bestelling is pas definitief als wij ze per mail bevestigd hebben. Betalen doe je bij het afhalen.</p>
        </div>`;
    } catch (err) {
      status.className = 'form-status is-error';
      status.textContent = err.message;
      button.disabled = false;
    }
  });

  document.querySelectorAll('[data-close]').forEach((btn) =>
    btn.addEventListener('click', () => btn.closest('dialog').close())
  );

  // ---------------------------------------------------------------- feestdagen (aan / gesloten / uit)
  // Pagina zichtbaar of niet regelt site.js; hier ook de besteldeadline van 6 december.
  const applyXmas = () => {
    if (!XMAS) return;
    const canOrder = segment('eindejaar') === 'aan' && iso(new Date()) <= XMAS_ORDER_DEADLINE;
    document.querySelectorAll('[data-open-product^="buche"], [data-open-product^="rond"]').forEach((btn) => {
      btn.dataset.label ||= btn.textContent;
      btn.disabled = !canOrder;
      btn.textContent = canOrder ? btn.dataset.label : 'Bestellen afgesloten';
    });
    const note = $('#xmas-closed');
    note.hidden = canOrder;
    note.textContent = canOrder ? '' : window.AlijsSegments?.message('eindejaar') || 'Bestellen voor de feestdagen is afgesloten.';
    if (!canOrder && cart.length) {
      cart = [];
      saveCart();
      renderCart();
    }
  };

  window.AlijsSegments?.onChange(applyXmas);

  // De uren komen pas binnen na het laden van de Sheet
  const hoursList = $('#opening-hours');
  if (hoursList) new MutationObserver(setupPickup).observe(hoursList, { childList: true });

  renderCart();
  applyXmas();
  setupPickup();
})();
