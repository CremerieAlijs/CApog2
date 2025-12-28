const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFHVIq4m5c0quhYDrSoDoYVxV-0LsN5h1ZSzv-hOBFIN6YRFZjkKB59JNWyeLoR7et0p6kHFPgoyxG/pub?gid=0&single=true&output=csv";

const todayStatus = document.getElementById("today-status");
const openingHoursList = document.getElementById("opening-hours");

const setUnavailable = () => {
  if (todayStatus) {
    todayStatus.textContent = "Vandaag: Openingsuren tijdelijk niet beschikbaar";
  }
  if (openingHoursList) {
    openingHoursList.innerHTML = "";
    const item = document.createElement("li");
    item.textContent = "Openingsuren tijdelijk niet beschikbaar";
    openingHoursList.append(item);
  }
};

const parseCsv = (text) => {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      const next = text[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  return rows;
};

const formatHours = (openValue, closeValue) => {
  const open = openValue?.trim() ?? "";
  const close = closeValue?.trim() ?? "";
  if (!open || open.toLowerCase() === "gesloten") {
    return "Gesloten";
  }
  if (close) {
    return `${open} – ${close}`;
  }
  return open;
};

const setTodayStatus = (rows) => {
  if (!todayStatus) {
    return;
  }
  const formatter = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    timeZone: "Europe/Brussels",
  });
  const todayName = formatter.format(new Date()).toLowerCase();
  const todayRow = rows.find((row) => (row.day || "").toLowerCase() === todayName);

  if (!todayRow) {
    todayStatus.textContent = "Vandaag: Openingsuren tijdelijk niet beschikbaar";
    return;
  }

  const open = todayRow.open?.trim() ?? "";
  const close = todayRow.close?.trim() ?? "";

  if (!open || open.toLowerCase() === "gesloten") {
    todayStatus.textContent = "Vandaag: Gesloten";
    return;
  }

  if (close) {
    todayStatus.textContent = `Vandaag: Open tot ${close}`;
  } else {
    todayStatus.textContent = `Vandaag: Open om ${open}`;
  }
};

const renderHours = (rows) => {
  if (!openingHoursList) {
    return;
  }
  openingHoursList.innerHTML = "";

  rows.forEach((row) => {
    const item = document.createElement("li");
    item.textContent = `${row.day}: ${formatHours(row.open, row.close)}`;
    openingHoursList.append(item);
  });
};

const loadOpeningHours = async () => {
  if (!todayStatus || !openingHoursList) {
    return;
  }

  try {
    const response = await fetch(CSV_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Fetch failed");
    }
    const text = await response.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      throw new Error("No data");
    }
    const headers = rows[0].map((header) => header.trim().toLowerCase());
    const dataRows = rows.slice(1).map((row) => {
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = row[index] ? row[index].trim() : "";
      });
      return rowData;
    });

    setTodayStatus(dataRows);
    renderHours(dataRows);
  } catch (error) {
    setUnavailable();
  }
};

loadOpeningHours();
