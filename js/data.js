/**
 * Cremerie Alijs — Data loader
 * Fetches opening hours, flavors, and taste of the moment from Google Sheets
 */

(() => {
  const SPREADSHEET_BASE =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFHVIq4m5c0quhYDrSoDoYVxV-0LsN5h1ZSzv-hOBFIN6YRFZjkKB59JNWyeLoR7et0p6kHFPgoyxG/pub";

  const SHEETS = {
    hours: "0",
    flavors: "109840204",
    moment: "1550368812",
  };

  const getSheetUrl = (sheetId) =>
    `${SPREADSHEET_BASE}?gid=${sheetId}&single=true&output=csv`;

  // Shared CSV parser
  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === "," && !inQuotes) {
        row.push(field);
        field = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") {
          i += 1;
        }
        row.push(field);
        if (row.some((value) => value.trim() !== "")) {
          rows.push(row);
        }
        row = [];
        field = "";
        continue;
      }

      field += char;
    }

    row.push(field);
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }

    return rows;
  };

  const fetchSheet = async (sheetId) => {
    const response = await fetch(getSheetUrl(sheetId), { cache: "no-store" });
    if (!response.ok) throw new Error("Fetch failed");
    const text = await response.text();
    return parseCsv(text);
  };

  // ============================================================
  // Opening Hours
  // ============================================================

  const renderOpeningHours = (rows) => {
    const todayStatusEl = document.getElementById("today-status");
    const hoursListEl = document.getElementById("opening-hours");

    if (!todayStatusEl && !hoursListEl) return;

    if (rows.length < 2) {
      if (todayStatusEl) {
        todayStatusEl.textContent = "Openingsuren niet beschikbaar";
      }
      return;
    }

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const dataRows = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i]?.trim() ?? "";
      });
      return obj;
    });

    // Today's status
    if (todayStatusEl) {
      const formatter = new Intl.DateTimeFormat("nl-BE", {
        weekday: "long",
        timeZone: "Europe/Brussels",
      });
      const todayName = formatter.format(new Date()).toLowerCase();
      const todayRow = dataRows.find(
        (row) => (row.day || "").toLowerCase() === todayName
      );

      if (todayRow) {
        const open = todayRow.open || "";
        const close = todayRow.close || "";
        if (!open || open.toLowerCase() === "gesloten") {
          todayStatusEl.textContent = "Vandaag gesloten";
        } else if (close) {
          todayStatusEl.textContent = `Vandaag open tot ${close}`;
        } else {
          todayStatusEl.textContent = `Vandaag open om ${open}`;
        }
      }
    }

    // Full hours list
    if (hoursListEl) {
      hoursListEl.innerHTML = "";
      dataRows.forEach((row) => {
        const li = document.createElement("li");
        const open = row.open || "";
        const close = row.close || "";
        let hours = "Gesloten";
        if (open && open.toLowerCase() !== "gesloten") {
          hours = close ? `${open} – ${close}` : open;
        }
        li.textContent = `${row.day}: ${hours}`;
        hoursListEl.append(li);
      });
    }
  };

  // ============================================================
  // Flavor List
  // ============================================================

  const renderFlavors = (rows) => {
    const listEl = document.getElementById("tastes-list");
    if (!listEl) return;

    if (rows.length === 0) {
      listEl.innerHTML = "<li>Smaken niet beschikbaar</li>";
      return;
    }

    const headerRow = rows[0].map((v) => v.trim().toLowerCase());
    const nameIndex = headerRow.indexOf("name");
    const dataRows = nameIndex === -1 ? rows : rows.slice(1);
    const columnIndex = nameIndex === -1 ? 0 : nameIndex;

    const seen = new Set();
    const flavors = dataRows
      .map((row) => row[columnIndex]?.trim() ?? "")
      .filter((v) => v !== "")
      .filter((v) => {
        const key = v.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    listEl.innerHTML = "";
    flavors.forEach((flavor) => {
      const li = document.createElement("li");
      li.textContent = flavor;
      listEl.append(li);
    });
  };

  // ============================================================
  // Taste of the Moment
  // ============================================================

  const renderMoment = (rows) => {
    const targetEl = document.getElementById("taste-of-the-moment");
    if (!targetEl) return;

    const dataRows = rows.slice(1);
    const row = dataRows.find((item) => (item?.[0] ?? "").trim());
    const tasteName = row?.[0]?.trim() ?? "";

    if (!tasteName) {
      targetEl.innerHTML = "";
      return;
    }

    targetEl.innerHTML = `
      <div class="moment" aria-labelledby="moment-title">
        <p class="moment-title" id="moment-title">Smaak van het moment</p>
        <p class="moment-name">${tasteName}</p>
      </div>
    `;
  };

  // ============================================================
  // Load all data in parallel
  // ============================================================

  const loadAll = async () => {
    const results = await Promise.allSettled([
      fetchSheet(SHEETS.hours),
      fetchSheet(SHEETS.flavors),
      fetchSheet(SHEETS.moment),
    ]);

    if (results[0].status === "fulfilled") {
      renderOpeningHours(results[0].value);
    }

    if (results[1].status === "fulfilled") {
      renderFlavors(results[1].value);
    }

    if (results[2].status === "fulfilled") {
      renderMoment(results[2].value);
    }
  };

  loadAll();
})();
