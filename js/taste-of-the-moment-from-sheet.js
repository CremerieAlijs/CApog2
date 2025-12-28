(() => {
  if (window.__tasteOfTheMomentLoaded) return;
  window.__tasteOfTheMomentLoaded = true;

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFHVIq4m5c0quhYDrSoDoYVxV-0LsN5h1ZSzv-hOBFIN6YRFZjkKB59JNWyeLoR7et0p6kHFPgoyxG/pub?gid=1550368812&single=true&output=csv";

const target = document.getElementById("taste-of-the-moment");

const FALLBACK_TASTE_NAME = "Tijdelijk niet beschikbaar";
const INSTAGRAM_EMBED_SCRIPT = "https://www.instagram.com/embed.js";

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
  name.textContent = tasteName || FALLBACK_TASTE_NAME;

  const embed = document.createElement("div");
  embed.className = "moment-embed";
  embed.innerHTML = instaEmbedHtml;

  section.append(title, name, embed);
  targetEl.append(section);
};

const ensureInstagramEmbed = () => {
  let script = document.querySelector(`script[src="${INSTAGRAM_EMBED_SCRIPT}"]`);

  if (!script) {
    script = document.createElement("script");
    script.async = true;
    script.src = INSTAGRAM_EMBED_SCRIPT;
    document.body.append(script);
  }

  if (window.instgrm?.Embeds?.process) {
    window.instgrm.Embeds.process();
  } else if (script) {
    script.addEventListener(
      "load",
      () => {
        if (window.instgrm?.Embeds?.process) {
          window.instgrm.Embeds.process();
        }
      },
      { once: true }
    );
  }
};

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
      field = "";
      rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  rows.push(row);
  return rows;
};

const extractTasteFromRows = (rows) => {
  const dataRows = rows.slice(1);
  const row = dataRows.find((item) => (item?.[0] ?? "").trim());
  return {
    tasteName: row?.[0]?.trim() ?? "",
    embedHtml: row?.[1] ?? "",
  };
};

const sanitizeEmbedHtml = (embedHtml) =>
  embedHtml.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").trim();

const loadTasteOfMoment = async () => {
  if (!target) {
    return;
  }

  let tasteName = "";
  let embedHtml = "";

  try {
    const response = await fetch(CSV_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Fetch failed");
    }
    const text = await response.text();
    const rows = parseCsv(text);
    const extracted = extractTasteFromRows(rows);
    tasteName = extracted.tasteName;
    embedHtml = extracted.embedHtml;
  } catch (error) {
    tasteName = "";
    embedHtml = "";
  }

  const sanitizedEmbed = sanitizeEmbedHtml(embedHtml);
  renderTasteOfMoment(target, tasteName, sanitizedEmbed);

  if (sanitizedEmbed) {
    ensureInstagramEmbed();
  }
};

  loadTasteOfMoment();
})();
