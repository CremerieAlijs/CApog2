# Bestellingen en Ape-aanvragen koppelen (Google Apps Script)

Het script `bestellingen.gs` ontvangt de ijstaartbestellingen en Ape-aanvragen van de website,
zet ze in een privé-spreadsheet en mailt **hallo@alijs.be**. De klant krijgt pas een mail
wanneer je de status op **Bevestigd** zet.

Werk overal ingelogd als **hallo@alijs.be**.

## 1. Spreadsheet maken

1. Ga naar <https://sheets.new> en noem de spreadsheet **Alijs – Bestellingen**.
2. **Niet publiceren en niet delen.** Hier komen namen, telefoonnummers en e-mailadressen in.

## 2. Script plakken

1. In de spreadsheet: **Extensies → Apps Script**.
2. Wis alles in `Code.gs` en plak de volledige inhoud van `google/bestellingen.gs`.
3. Klik op het diskette-icoon (**Opslaan**).

## 3. Eén keer `setup` uitvoeren

1. Kies bovenaan in de keuzelijst de functie **setup** en klik op **▶ Uitvoeren**.
2. Google vraagt toestemming: **Toestemmingen bekijken** → kies hallo@alijs.be.
3. Je ziet *"Google heeft deze app niet geverifieerd"*. Dat is normaal voor een eigen script:
   **Geavanceerd → Ga naar … (onveilig)** → **Toestaan**.
4. In de spreadsheet staan nu de tabbladen **IJstaarten** en **Ape**, met een keuzelijst in de kolom *Status*.

## 4. Als web-app implementeren

1. Rechtsboven: **Implementeren → Nieuwe implementatie**.
2. Tandwiel bij *Type selecteren* → **Web-app**.
3. Beschrijving: `Website`. **Uitvoeren als: Ik (hallo@alijs.be)**. **Wie heeft toegang: Iedereen**.
4. **Implementeren** en kopieer de **URL van de web-app** (eindigt op `/exec`).
5. Bezorg die URL; ze wordt ingevuld in `js/site.js` bij `FORM_ENDPOINT`.

> Pas je later het script aan? Gebruik dan **Implementeren → Implementaties beheren → bewerken (potlood) → Versie: Nieuwe versie**.
> Zo blijft de URL dezelfde.

## 5. Dagelijks gebruik

- Nieuwe bestelling of aanvraag → mail naar hallo@alijs.be. **Beantwoorden** gaat rechtstreeks naar de klant.
- Zet de **Status** op **Bevestigd** → de klant krijgt automatisch één bevestigingsmail.
  De kolom *Bevestiging verstuurd* toont wanneer.
- Daarna: **Afgehaald** of **Geannuleerd** (er vertrekt dan geen mail).
- Bestellingen ouder dan 12 maanden worden elke maand automatisch gewist (privacy).

## 6. Onderdelen aan/uit

In de Sheet **WebsiteData** (die met smaken en uren) staat het tabblad **Instellingen**:

| onderdeel  | stand | boodschap |
|------------|-------|-----------|
| ijstaarten | aan   |           |
| eindejaar  | uit   |           |
| ape        | aan   |           |

- `stand` kies je in het keuzelijstje: **aan** (bestellen kan), **gesloten** (zichtbaar, bestellen kan niet)
  of **uit** (verdwijnt van de site). Het overzicht ernaast (kolom E–F) legt het nog eens uit.
- `boodschap` leeg = standaardtekst; anders toont de site jouw tekst.
- `ijstaarten` = pagina /ijstaarten (hele jaar), `eindejaar` = pagina /feestdagen (stronken en feesttaarten).
  Ze staan los van elkaar: je kan bv. enkel de feestdagen openzetten. Een bestelling met beide soorten weigert het script.
- Website (`js/site.js`) en script (`CONFIG.instellingenCsv`) lezen dit tabblad. Een wijziging staat
  na ongeveer 5 minuten online. Verander de namen in kolom A niet.

## Aan te passen in het script

Bovenaan `bestellingen.gs`: prijzen (`TAARTEN`), eindejaarscombinaties en -data (`EINDEJAAR`),
sluitingsdagen (`GESLOTEN_WEEKDAGEN`, `GESLOTEN_DAGEN`, `GESLOTEN_VANAF`).
