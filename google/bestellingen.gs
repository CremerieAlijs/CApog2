/**
 * Cremerie Alijs — bestellingen en Ape-aanvragen
 *
 * Google Apps Script, gekoppeld aan de PRIVÉ-spreadsheet "Alijs – Bestellingen"
 * (niet publiceren!). Installatie: zie google/LEESMIJ.md.
 *
 * - Website stuurt een bestelling (ijstaarten) of aanvraag (Ape) naar doPost().
 * - Het script controleert alles, zet een rij in het juiste tabblad
 *   en mailt hallo@alijs.be. De klant krijgt dan nog NIETS.
 * - Zet je in de kolom "Status" een rij op "Bevestigd", dan vertrekt
 *   automatisch één bevestigingsmail naar de klant.
 */

// ---------------------------------------------------------------- instellingen
const CONFIG = {
  mailTo: 'hallo@alijs.be',
  afzenderNaam: 'Cremerie Alijs',
  tijdzone: 'Europe/Brussels',
  // Gepubliceerde CSV van het tabblad "Instellingen" in de website-Sheet (leeg = niet controleren)
  instellingenCsv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTFHVIq4m5c0quhYDrSoDoYVxV-0LsN5h1ZSzv-hOBFIN6YRFZjkKB59JNWyeLoR7et0p6kHFPgoyxG/pub?gid=1900226224&single=true&output=csv',
  bewaarMaanden: 12,
};

const STATUSSEN = ['Nieuw', 'Bevestigd', 'Afgehaald', 'Geannuleerd'];

const TABS = {
  ijstaarten: {
    naam: 'IJstaarten',
    kolommen: ['Ontvangen', 'Status', 'Naam', 'Telefoon', 'E-mail', 'Afhaaldag', 'Uur',
      'Bestelling', 'Totaal', 'Opmerking', 'Bevestiging verstuurd'],
  },
  ape: {
    naam: 'Ape',
    kolommen: ['Ontvangen', 'Status', 'Naam', 'Telefoon', 'E-mail', 'Datum feest', 'Uur',
      'Gemeente', 'Gasten', 'Soort feest', 'Formule', 'Opmerking', 'Bevestiging verstuurd'],
  },
};

// Aanbod en prijzen: het script rekent zelf, de prijzen van de website tellen niet
const TAARTEN = {
  ijstaart: { naam: 'Ronde ijstaart', soort: 'jaar', maten: { '4-6': ['4 à 6 personen', 31.75], '8-10': ['8 à 10 personen', 57.15] } },
  buche34: { naam: 'Bûche, 3 à 4 personen', soort: 'eindejaar', prijs: 22.25 },
  rond46: { naam: 'Ronde taart, 4 à 6 personen', soort: 'eindejaar', prijs: 31.75 },
  buche68: { naam: 'Bûche, 6 à 8 personen', soort: 'eindejaar', prijs: 44.45 },
  rond810: { naam: 'Ronde taart, 8 à 10 personen', soort: 'eindejaar', prijs: 57.15 },
};
const COMBINATIES = ['Vanille & chocolade', 'Vanille & mokka', 'Hazelnoot & chocolade (vegan)', 'Framboos & stracciatella'];
const EINDEJAAR = { dagen: ['2026-12-24', '2026-12-31'], bestelTot: '2026-12-06' };
const MIN_DAGEN_OP_VOORHAND = 14;
// Afhalen kan niet op sluitingsdagen (0 = zondag … 1 = maandag, 2 = dinsdag)
const GESLOTEN_WEEKDAGEN = [1, 2];
const GESLOTEN_DAGEN = ['2026-12-25'];
const GESLOTEN_VANAF = '2027-01-01'; // winterstop; einddatum nog aan te vullen

const FORMULES = { 'a-volonte': 'À volonté', 'per-bolletje': 'Per bolletje', 'op-maat': 'Op maat (offerte)', 'weet-niet': 'Weet ik nog niet' };

// ---------------------------------------------------------------- website → script
function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Spam: onzichtbaar veld moet leeg zijn, en niemand vult een formulier in 3 seconden in
    if (data.website || Number(data.duur) < 3000) return antwoord(true);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (data.soort === 'ijstaarten') return antwoord(bewaarIjstaarten(data));
      if (data.soort === 'ape') return antwoord(bewaarApe(data));
      return antwoord(false, 'Onbekend formulier.');
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    if (err instanceof Fout) return antwoord(false, err.message);
    console.error(err);
    return antwoord(false, 'Er liep iets mis. Probeer het later opnieuw of mail naar ' + CONFIG.mailTo + '.');
  }
}

function antwoord(ok, fout) {
  return ContentService
    .createTextOutput(JSON.stringify(ok === true ? { ok: true } : { ok: false, fout: fout || ok }))
    .setMimeType(ContentService.MimeType.JSON);
}

class Fout extends Error {}

// ---------------------------------------------------------------- ijstaarten
function bewaarIjstaarten(d) {
  const items = Array.isArray(d.items) ? d.items.slice(0, 20) : [];
  if (!items.length) throw new Fout('Je bestelling is leeg.');
  // Ijstaarten (/ijstaarten) en feestdagen (/feestdagen) zijn aparte bestellingen met elk hun eigen stand
  const soorten = items.map((it) => (TAARTEN[it.id] || {}).soort);
  if (soorten.indexOf('jaar') !== -1 && soorten.indexOf('eindejaar') !== -1) {
    throw new Fout('Bestel ijstaarten en taarten voor de feestdagen apart.');
  }
  controleerStand(soorten.indexOf('eindejaar') !== -1 ? 'eindejaar' : 'ijstaarten');
  const klant = controleerKlant(d);

  let totaal = 0;
  let eindejaar = false;
  const regels = items.map((it) => {
    const taart = TAARTEN[it.id];
    if (!taart) throw new Fout('Deze taart zit niet (meer) in ons aanbod.');
    const aantal = Math.max(1, Math.min(10, parseInt(it.aantal, 10) || 1));
    let naam;
    let prijs;
    let smaak;
    if (taart.soort === 'jaar') {
      const maat = taart.maten[it.maat];
      if (!maat) throw new Fout('Kies een geldige grootte.');
      const [s1, s2] = [tekst(it.smaak1, 60), tekst(it.smaak2, 60)];
      if (!s1 || !s2) throw new Fout('Kies twee smaken.');
      naam = `${taart.naam}, ${maat[0]}`;
      prijs = maat[1];
      smaak = s1 === s2 ? `volledig ${s1}` : `${s1} & ${s2}`;
    } else {
      eindejaar = true;
      if (vandaag() > EINDEJAAR.bestelTot) throw new Fout('Bestellen voor het eindejaar is afgesloten.');
      if (COMBINATIES.indexOf(it.combinatie) === -1) throw new Fout('Kies een geldige smaakcombinatie.');
      naam = taart.naam;
      prijs = taart.prijs;
      smaak = it.combinatie;
    }
    totaal += prijs * aantal;
    return `${aantal}× ${naam} — ${smaak} (${euro(prijs * aantal)})`;
  });

  const dag = datum(d.dag);
  if (eindejaar) {
    if (EINDEJAAR.dagen.indexOf(dag) === -1) throw new Fout('Eindejaarstaarten haal je af op 24 of 31 december.');
  } else if (dag < plusDagen(MIN_DAGEN_OP_VOORHAND)) {
    throw new Fout('Bestel minstens twee weken op voorhand.');
  } else if (gesloten(dag)) {
    throw new Fout(`Op ${leesbareDatum(dag)} zijn we gesloten. Kies een andere dag.`);
  }
  const uur = tekst(d.uur, 10);
  if (!/^\d{1,2}u\d{2}$/.test(uur)) throw new Fout('Kies een afhaaluur.');

  const rij = [new Date(), 'Nieuw', klant.naam, klant.telefoon, klant.email, dag, uur,
    regels.join('\n'), euro(totaal), tekst(d.opmerking, 1000), ''];
  const tab = schrijf('ijstaarten', rij);

  MailApp.sendEmail({
    to: CONFIG.mailTo,
    replyTo: klant.email,
    name: 'Website Cremerie Alijs',
    subject: `Nieuwe ijstaartbestelling — ${klant.naam} — afhalen ${leesbareDatum(dag)}`,
    body: [
      'Nieuwe bestelling via de website. Nog te bevestigen.', '',
      ...regels, `Totaal: ${euro(totaal)}`, '',
      `Afhalen: ${leesbareDatum(dag)} om ${uur}`, '',
      `Naam: ${klant.naam}`, `Telefoon: ${klant.telefoon}`, `E-mail: ${klant.email}`,
      `Opmerking: ${tekst(d.opmerking, 1000) || '—'}`, '',
      `Bevestigen: zet de status op "Bevestigd" in ${tab.getParent().getUrl()}#gid=${tab.getSheetId()}`,
    ].join('\n'),
  });
  return true;
}

// ---------------------------------------------------------------- de Ape
function bewaarApe(d) {
  controleerStand('ape');
  const klant = controleerKlant(d);
  const dag = datum(d.datum);
  if (dag < vandaag()) throw new Fout('Kies een datum in de toekomst.');
  const gasten = parseInt(d.gasten, 10);
  if (!(gasten > 0 && gasten < 5000)) throw new Fout('Vul het aantal gasten in.');
  const formule = FORMULES[d.formule] || FORMULES['weet-niet'];
  const uur = tekst(d.uur, 10);
  const gemeente = tekst(d.gemeente, 80);
  if (!gemeente) throw new Fout('Vul de gemeente in.');

  const rij = [new Date(), 'Nieuw', klant.naam, klant.telefoon, klant.email, dag, uur, gemeente,
    gasten, tekst(d.feest, 60), formule, tekst(d.opmerking, 1000), ''];
  const tab = schrijf('ape', rij);

  MailApp.sendEmail({
    to: CONFIG.mailTo,
    replyTo: klant.email,
    name: 'Website Cremerie Alijs',
    subject: `Ape-aanvraag — ${klant.naam} — ${leesbareDatum(dag)}`,
    body: [
      'Nieuwe aanvraag voor de Ape via de website. Nog te bevestigen.', '',
      `Datum: ${leesbareDatum(dag)}${uur ? ' om ' + uur : ''}`,
      `Gemeente: ${gemeente}`, `Gasten: ${gasten}`, `Soort feest: ${tekst(d.feest, 60) || '—'}`,
      `Formule: ${formule}`, '',
      `Naam: ${klant.naam}`, `Telefoon: ${klant.telefoon}`, `E-mail: ${klant.email}`,
      `Opmerking: ${tekst(d.opmerking, 1000) || '—'}`, '',
      `Bevestigen: zet de status op "Bevestigd" in ${tab.getParent().getUrl()}#gid=${tab.getSheetId()}`,
    ].join('\n'),
  });
  return true;
}

// ---------------------------------------------------------------- bevestigen (status → "Bevestigd")
// Installeerbare trigger (aangemaakt door setup): mag mails versturen.
function bijStatusWijziging(e) {
  const blad = e.range.getSheet();
  const soort = Object.keys(TABS).find((k) => TABS[k].naam === blad.getName());
  if (!soort || e.range.getRow() < 2) return;
  const kol = TABS[soort].kolommen;
  if (e.range.getColumn() !== kol.indexOf('Status') + 1 || e.range.getNumRows() !== 1) return;
  if (String(e.range.getValue()) !== 'Bevestigd') return;

  const rijNr = e.range.getRow();
  const waarden = blad.getRange(rijNr, 1, 1, kol.length).getValues()[0];
  const veld = (naam) => waarden[kol.indexOf(naam)];
  if (veld('Bevestiging verstuurd')) return; // nooit twee keer
  const email = String(veld('E-mail'));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;

  const voornaam = String(veld('Naam')).split(' ')[0];
  let onderwerp;
  let tekstMail;
  if (soort === 'ijstaarten') {
    const dag = datum(veld('Afhaaldag'));
    onderwerp = 'Je ijstaart is bevestigd — Cremerie Alijs';
    tekstMail = [
      `Dag ${voornaam},`, '',
      'Goed nieuws: je bestelling is bevestigd.', '',
      String(veld('Bestelling')), `Totaal: ${veld('Totaal')}`, '',
      `Afhalen: ${leesbareDatum(dag)} om ${veld('Uur')}`,
      'Cremerie Alijs, Lange Dreef 9, 2820 Rijmenam',
      'Betalen doe je bij het afhalen.', '',
      'Neem een koeltas mee en zet je taart thuis meteen in de diepvries.',
      'Zet ze een kwartiertje à twintig minuten in de frigo voor je ze aansnijdt.', '',
      'Tot binnenkort!', 'Cremerie Alijs',
    ].join('\n');
  } else {
    const dag = datum(veld('Datum feest'));
    onderwerp = 'De Ape komt naar je feest — Cremerie Alijs';
    tekstMail = [
      `Dag ${voornaam},`, '',
      `Goed nieuws: de Ape is voor je vastgelegd op ${leesbareDatum(dag)}.`,
      `Formule: ${veld('Formule')}, voor ${veld('Gasten')} gasten in ${veld('Gemeente')}.`, '',
      'Annuleren kan kosteloos tot 2 weken op voorhand. Daarna brengen we het feest of de minimumhoeveelheid bolletjes in rekening.',
      'Zorg voor stroom ter plaatse en een plek die vlot bereikbaar is met de Ape.', '',
      'Heb je nog vragen? Antwoord gewoon op deze mail.', '',
      'Tot op je feest!', 'Cremerie Alijs',
    ].join('\n');
  }

  MailApp.sendEmail({ to: email, replyTo: CONFIG.mailTo, name: CONFIG.afzenderNaam, subject: onderwerp, body: tekstMail });
  blad.getRange(rijNr, kol.indexOf('Bevestiging verstuurd') + 1).setValue(new Date());
}

// ---------------------------------------------------------------- eenmalige installatie
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach((k) => {
    const t = TABS[k];
    const blad = ss.getSheetByName(t.naam) || ss.insertSheet(t.naam);
    blad.getRange(1, 1, 1, t.kolommen.length).setValues([t.kolommen]).setFontWeight('bold');
    blad.setFrozenRows(1);
    const statusKol = t.kolommen.indexOf('Status') + 1;
    blad.getRange(2, statusKol, 1000, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(STATUSSEN, true).setAllowInvalid(false).build()
    );
  });
  const leeg = ss.getSheetByName('Blad1') || ss.getSheetByName('Sheet1');
  if (leeg && leeg.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(leeg);

  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('bijStatusWijziging').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('opruimen').timeBased().onMonthDay(1).atHour(4).create();
}

// Verwijdert bestellingen ouder dan CONFIG.bewaarMaanden (privacy)
function opruimen() {
  const grens = new Date();
  grens.setMonth(grens.getMonth() - CONFIG.bewaarMaanden);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach((k) => {
    const blad = ss.getSheetByName(TABS[k].naam);
    if (!blad) return;
    for (let r = blad.getLastRow(); r >= 2; r -= 1) {
      const ontvangen = blad.getRange(r, 1).getValue();
      if (ontvangen instanceof Date && ontvangen < grens) blad.deleteRow(r);
    }
  });
}

// ---------------------------------------------------------------- hulpjes
function schrijf(soort, rij) {
  const blad = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABS[soort].naam);
  if (!blad) throw new Error('Tabblad ontbreekt: voer setup() uit.');
  // Voorkom formules in velden die de klant invult, en bewaar de 0 vooraan in telefoonnummers
  blad.appendRow(rij.map((v) => (typeof v === 'string' && /^([=+\-@]|0\d)/.test(v) ? "'" + v : v)));
  return blad;
}

function controleerKlant(d) {
  const naam = tekst(d.naam, 80);
  const email = tekst(d.email, 120);
  const telefoon = tekst(d.telefoon, 30);
  if (!naam) throw new Fout('Vul je naam in.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Fout('Vul een geldig e-mailadres in.');
  if (!telefoon) throw new Fout('Vul je telefoonnummer in.');
  return { naam, email, telefoon };
}

function controleerStand(onderdeel) {
  if (!CONFIG.instellingenCsv) return;
  let csv;
  try {
    csv = Utilities.parseCsv(UrlFetchApp.fetch(CONFIG.instellingenCsv).getContentText());
  } catch (e) {
    return; // Instellingen niet bereikbaar: bestelling gewoon aannemen, je bevestigt toch zelf
  }
  const rij = csv.find((r) => String(r[0]).trim().toLowerCase() === onderdeel);
  const stand = rij ? String(rij[1]).trim().toLowerCase() : 'aan';
  if (stand !== 'aan') throw new Fout((rij && rij[2]) || 'Bestellen of aanvragen kan momenteel niet.');
}

function tekst(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

function datum(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.tijdzone, 'yyyy-MM-dd');
  const s = tekst(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Fout('Kies een geldige datum.');
  return s;
}

function vandaag() {
  return Utilities.formatDate(new Date(), CONFIG.tijdzone, 'yyyy-MM-dd');
}

function plusDagen(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, CONFIG.tijdzone, 'yyyy-MM-dd');
}

function gesloten(iso) {
  if (GESLOTEN_DAGEN.indexOf(iso) !== -1 || iso >= GESLOTEN_VANAF) return true;
  const [j, m, d] = iso.split('-').map(Number);
  return GESLOTEN_WEEKDAGEN.indexOf(new Date(j, m - 1, d).getDay()) !== -1;
}

function leesbareDatum(iso) {
  const [j, m, d] = iso.split('-').map(Number);
  const dagen = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  return `${dagen[new Date(j, m - 1, d).getDay()]} ${d} ${maanden[m - 1]}`;
}

function euro(n) {
  return '€' + n.toFixed(2).replace('.', ',');
}
