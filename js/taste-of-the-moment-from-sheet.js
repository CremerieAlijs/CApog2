const GVIZ_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFHVIq4m5c0quhYDrSoDoYVxV-0LsN5h1ZSzv-hOBFIN6YRFZjkKB59JNWyeLoR7et0p6kHFPgoyxG/gviz/tq?gid=1550368812&tqx=out:json";

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

const extractGvizJson = (text) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || start >= end) {
    throw new Error("Invalid GViz response");
  }
  return JSON.parse(text.slice(start, end + 1));
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
    const response = await fetch(GVIZ_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Fetch failed");
    }
    const text = await response.text();
    const data = extractGvizJson(text);
    const row = data.table.rows.find((item) => item.c?.[0]?.v);
    tasteName = row?.c?.[0]?.v ?? "";
    embedHtml = row?.c?.[1]?.v ?? "";
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
