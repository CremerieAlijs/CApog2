const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFHVIq4m5c0quhYDrSoDoYVxV-0LsN5h1ZSzv-hOBFIN6YRFZjkKB59JNWyeLoR7et0p6kHFPgoyxG/pub?gid=1550368812&single=true&output=csv";

const target = document.getElementById("taste-of-the-moment");

const setUnavailable = () => {
  if (!target) {
    return;
  }
  target.textContent = "Smaak van het moment tijdelijk niet beschikbaar.";
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

const getFirstDataRow = (rows) => {
  if (rows.length === 0) {
    return null;
  }

  const headerKeywords = ["naam", "name", "smaak", "taste", "instagram", "embed"];
  const firstRow = rows[0].map((value) => value.trim().toLowerCase());
  const hasHeader = firstRow.some((value) =>
    headerKeywords.some((keyword) => value.includes(keyword))
  );

  return hasHeader ? rows[1] ?? null : rows[0];
};

const renderTasteOfMoment = (targetEl, tasteName, instaEmbedHtml) => {
  targetEl.innerHTML = "";

  const section = document.createElement("section");
  section.className = "moment";
  section.setAttribute("aria-labelledby", "moment-title");

  const title = document.createElement("p");
  title.className = "meta-title";
  title.id = "moment-title";
  title.textContent = "Smaak van het moment";

  const name = document.createElement("p");
  name.className = "moment-name";
  name.textContent = tasteName;

  const embed = document.createElement("div");
  embed.className = "moment-embed";
  embed.innerHTML = instaEmbedHtml;

  section.append(title, name, embed);
  targetEl.append(section);
};

const ensureInstagramEmbed = () => {
  const embedScriptSrc = "https://www.instagram.com/embed.js";
  let script = document.querySelector(`script[src="${embedScriptSrc}"]`);

  if (!script) {
    script = document.createElement("script");
    script.async = true;
    script.src = embedScriptSrc;
    document.body.append(script);
  }

  if (window.instgrm?.Embeds?.process) {
    window.instgrm.Embeds.process();
  } else if (script) {
    script.addEventListener("load", () => {
      if (window.instgrm?.Embeds?.process) {
        window.instgrm.Embeds.process();
      }
    });
  }
};

const loadTasteOfMoment = async () => {
  if (!target) {
    return;
  }

  try {
    const response = await fetch(CSV_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Fetch failed");
    }
    const text = await response.text();
    const rows = parseCsv(text);
    const dataRow = getFirstDataRow(rows);
    const tasteName = dataRow?.[0]?.trim() ?? "";
    const instaEmbedHtml = dataRow?.[1]?.trim() ?? "";

    if (!tasteName) {
      throw new Error("No data");
    }

    renderTasteOfMoment(target, tasteName, instaEmbedHtml);
    ensureInstagramEmbed();
  } catch (error) {
    setUnavailable();
  }
};

loadTasteOfMoment();
