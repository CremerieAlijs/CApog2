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
    potFlavors: "1854556350",
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
  // Structured Data (schema.org opening hours)
  // ============================================================

  // The JSON-LD block in index.html is the source Google reads first, so it is
  // kept correct by hand. This rewrites it from the sheet as well, so the two
  // cannot drift apart when the hours change.

  const SCHEMA_DAYS = {
    maandag: "Monday",
    dinsdag: "Tuesday",
    woensdag: "Wednesday",
    donderdag: "Thursday",
    vrijdag: "Friday",
    zaterdag: "Saturday",
    zondag: "Sunday",
  };

  // Accepts "11u30", "11u", "11:30" or "11.30" and returns "11:30"
  const toIsoTime = (value) => {
    const match = String(value)
      .trim()
      .match(/^(\d{1,2})\s*(?:u|:|\.|h)?\s*(\d{2})?$/i);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2] ?? 0);
    if (hours > 23 || minutes > 59) return null;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const buildHoursSpecification = (dataRows) => {
    // Group days that share the same opening and closing time
    const groups = new Map();

    dataRows.forEach((row) => {
      const day = SCHEMA_DAYS[(row.day || "").trim().toLowerCase()];
      if (!day) return;

      const openRaw = (row.open || "").trim().toLowerCase();
      const isClosed = openRaw === "" || openRaw === "gesloten";

      const open = toIsoTime(row.open);
      const close = toIsoTime(row.close);

      // A day whose times we cannot read is left out altogether: publishing it
      // as closed would turn a typo in the sheet into a lost customer.
      if (!isClosed && !(open && close)) return;

      // Closed days are published as 00:00–00:00, per Google's guidance
      const key = isClosed ? "00:00-00:00" : `${open}-${close}`;

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(day);
    });

    return Array.from(groups.entries()).map(([key, days]) => {
      const [opens, closes] = key.split("-");
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: days,
        opens,
        closes,
      };
    });
  };

  const updateStructuredData = (dataRows) => {
    const scriptEl = document.getElementById("business-schema");
    if (!scriptEl) return;

    const specification = buildHoursSpecification(dataRows);
    if (specification.length === 0) return;

    try {
      const schema = JSON.parse(scriptEl.textContent);
      schema.openingHoursSpecification = specification;
      scriptEl.textContent = JSON.stringify(schema, null, 2);
    } catch (error) {
      // Leave the hand-written block in place if it cannot be parsed
      console.warn("Could not update structured data:", error);
    }
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

    updateStructuredData(dataRows);

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
        const note = row.note;

        console.log("Opening hours note:", note, "for day:", row.day);
        if (note === undefined) {
          console.warn(
            "Opening hours note is undefined. Check Google Sheet headers and CSV parsing.",
            row
          );
        }

        let hours = "Gesloten";
        if (open && open.toLowerCase() !== "gesloten") {
          hours = close ? `${open} – ${close}` : open;
        }

        const dayEl = document.createElement("span");
        dayEl.className = "hours-day";
        dayEl.textContent = row.day;

        const detailsEl = document.createElement("span");
        detailsEl.className = "hours-details";

        const timeEl = document.createElement("span");
        timeEl.className = "hours-time";
        timeEl.textContent = hours;
        detailsEl.append(timeEl);

        const hasNote =
          note !== null && note !== undefined && String(note).trim() !== "";
        if (hasNote) {
          const separatorEl = document.createElement("span");
          separatorEl.className = "hours-note-separator";
          separatorEl.setAttribute("aria-hidden", "true");
          separatorEl.textContent = "—";

          const noteEl = document.createElement("span");
          noteEl.className = "hours-note";
          noteEl.textContent = String(note).trim();

          detailsEl.append(separatorEl, noteEl);
        }

        li.append(dayEl, detailsEl);
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

  const renderPotFlavors = (rows) => {
    const sectionEl = document.getElementById("pot-flavors-section");
    const listEl = document.getElementById("pot-flavors-list");
    if (!sectionEl || !listEl) return;

    if (rows.length < 2) {
      sectionEl.hidden = true;
      return;
    }

    const seen = new Set();
    const flavors = rows
      .slice(1)
      .map((row) => row[0]?.trim() ?? "")
      .filter((value) => value !== "")
      .filter((value) => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    if (flavors.length === 0) {
      sectionEl.hidden = true;
      return;
    }

    listEl.innerHTML = "";
    flavors.forEach((flavor) => {
      const li = document.createElement("li");
      li.textContent = flavor;
      listEl.append(li);
    });

    sectionEl.hidden = false;
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
    const tasteDescription = row?.[1]?.trim() ?? "";

    if (!tasteName) {
      targetEl.innerHTML = "";
      return;
    }

    targetEl.innerHTML = `
      <div class="moment" aria-labelledby="moment-label moment-name">
        <p class="moment-label" id="moment-label">Smaak van het moment</p>
        <p class="moment-name" id="moment-name">${tasteName}</p>
        ${tasteDescription ? `<p class="moment-description">${tasteDescription}</p>` : ""}
      </div>
    `;
  };

  // ============================================================
  // Load all data in parallel
  // ============================================================

  const loadAll = async () => {
    const coreResults = await Promise.allSettled([
      fetchSheet(SHEETS.hours),
      fetchSheet(SHEETS.flavors),
      fetchSheet(SHEETS.moment),
    ]);

    if (coreResults[0].status === "fulfilled") {
      renderOpeningHours(coreResults[0].value);
    }

    if (coreResults[1].status === "fulfilled") {
      renderFlavors(coreResults[1].value);
    }

    if (coreResults[2].status === "fulfilled") {
      renderMoment(coreResults[2].value);
    }

    // Optional sheet: load without blocking core content rendering.
    fetchSheet(SHEETS.potFlavors)
      .then(renderPotFlavors)
      .catch(() => {});
  };

  loadAll();
})();
