(() => {
  const SPREADSHEET_BASE =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFHVIq4m5c0quhYDrSoDoYVxV-0LsN5h1ZSzv-hOBFIN6YRFZjkKB59JNWyeLoR7et0p6kHFPgoyxG/pub";

  const ALLERGENS_SHEET_ID = "1971864328";

  const getSheetUrl = (sheetId) =>
    `${SPREADSHEET_BASE}?gid=${sheetId}&single=true&output=csv`;

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

  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "")
      .toLowerCase();

  const PRODUCT_ALIASES = ["product", "productnaam", "naam", "name", "smaak", "flavor", "flavour"];

  const VEGAN_ALIASES = ["vegan", "veganistisch", "plantbased", "plantaardig"];

  const ICONS = {
    gluten:
      '<path d="M12 3v18M8.5 7.5C10 6 14 6 15.5 7.5M7.5 11.5C9.2 10 14.8 10 16.5 11.5M8.5 15.5C10 14 14 14 15.5 15.5" />',
    schaaldieren:
      '<path d="M7 12c0-2.8 2.2-5 5-5s5 2.2 5 5v4H7zM9 16l-2 2M15 16l2 2M8.5 10.5 6 8M15.5 10.5 18 8" /><circle cx="10" cy="12" r=".8" /><circle cx="14" cy="12" r=".8" />',
    eieren:
      '<path d="M12 4c2.7 0 4.8 3.2 4.8 6.8 0 3.9-2.2 7.2-4.8 7.2S7.2 14.7 7.2 10.8C7.2 7.2 9.3 4 12 4z" />',
    vis:
      '<path d="M5 12c2-3.2 5-5 8-5 2.8 0 4.6 1.3 6 3-1.4 1.7-3.2 3-6 3-3 0-6-1.8-8-5zm0 0c2 3.2 5 5 8 5" /><circle cx="14.5" cy="10.5" r=".8" />',
    pinda:
      '<path d="M10.5 6.3c2 0 3.5 1.5 3.5 3.5 0 .8-.2 1.6-.7 2.2l-1.6 2a3.3 3.3 0 1 1-5.2-4l1.6-2a3.4 3.4 0 0 1 2.4-1.7zm3 3.7 1.8 2.2a3.3 3.3 0 1 1-5.2 4l-1.1-1.3" />',
    soja:
      '<path d="M8 14c0-3.3 2.4-6 5.3-6h2.2v2.2c0 2.8-2.2 5-5 5H8zM8 14c0 1.7 1.3 3 3 3h2" />',
    melk:
      '<path d="M9 4h6M9 4v5l-1 2v6h8v-6l-1-2V4" /><path d="M10 10h4" />',
    noten:
      '<path d="M12 5.2c2.9 0 5.3 2.4 5.3 5.3 0 3.7-2.6 6.3-5.3 8.3-2.7-2-5.3-4.6-5.3-8.3 0-2.9 2.4-5.3 5.3-5.3z" /><path d="M12 7.7v8.4" />',
    selderij:
      '<path d="M8 18c0-4.7 1.8-8.5 4-12 2.2 3.5 4 7.3 4 12" /><path d="M12 10c-1.4 0-2.8-.6-3.8-1.6M12 10c1.4 0 2.8-.6 3.8-1.6" />',
    mosterd:
      '<path d="M10 4h4v4h-4zM9 8h6v3.5A4.5 4.5 0 0 1 10.5 16h-2a1.5 1.5 0 0 1-1.5-1.5V12A4 4 0 0 1 9 8z" />',
    sesam:
      '<path d="M12 5.5c2 0 3.6 1.6 3.6 3.6S14 15.6 12 18.5c-2-2.9-3.6-7.4-3.6-9.4S10 5.5 12 5.5z" /><path d="M12 8.5v3" />',
    sulfieten:
      '<path d="M9 5h6l3 5-3 9H9l-3-9z" /><path d="M10.5 13.5h3" />',
    lupine:
      '<path d="M8 17c0-5 2.7-8 4-11 1.3 3 4 6 4 11" /><path d="M9.5 13.5c.8-.6 1.6-.9 2.5-.9s1.7.3 2.5.9" />',
    weekdieren:
      '<path d="M6.5 14.5c0-4.5 2.8-7.5 5.5-9 2.7 1.5 5.5 4.5 5.5 9 0 2.2-1.8 4-4 4h-3c-2.2 0-4-1.8-4-4z" /><path d="M8.8 11.8c1 .6 2 .9 3.2.9s2.2-.3 3.2-.9" />',
    vegan:
      '<path d="M7 14c5.3-.2 8.6-3.4 10-8 .1-.3.4-.6.8-.7.4-.1.8 0 1.1.3.3.3.4.7.3 1.1-1.3 5.8-5.9 10.3-11.7 11.6-.4.1-.8 0-1.1-.3-.3-.3-.4-.7-.3-1.1.1-.4.4-.7.9-.8z" /><path d="M6 18c2.7-1.2 4.8-3.3 6-6" />',
  };

  const ALLERGEN_DEFINITIONS = [
    { key: "gluten", label: "Gluten", aliases: ["gluten", "tarwe", "graan"] },
    { key: "schaaldieren", label: "Schaaldieren", aliases: ["schaaldier", "schaaldieren", "crustace"] },
    { key: "eieren", label: "Ei", aliases: ["ei", "eieren", "egg"] },
    { key: "vis", label: "Vis", aliases: ["vis", "fish"] },
    { key: "pinda", label: "Pinda", aliases: ["pinda", "pindas", "aardnoot", "aardnoten", "peanut"] },
    { key: "soja", label: "Soja", aliases: ["soja", "soy"] },
    { key: "melk", label: "Melk", aliases: ["melk", "lactose", "zuivel", "milk"] },
    { key: "noten", label: "Noten", aliases: ["noten", "noot", "nuts"] },
    { key: "selderij", label: "Selderij", aliases: ["selderij", "celery"] },
    { key: "mosterd", label: "Mosterd", aliases: ["mosterd", "mustard"] },
    { key: "sesam", label: "Sesam", aliases: ["sesam", "sesame"] },
    { key: "sulfieten", label: "Sulfieten", aliases: ["sulfiet", "sulfieten", "zwaveldioxide", "sulphite"] },
    { key: "lupine", label: "Lupine", aliases: ["lupine"] },
    { key: "weekdieren", label: "Weekdieren", aliases: ["weekdier", "weekdieren", "mollusc"] },
  ];

  const truthy = (value) => {
    const normalized = normalize(value ?? "");
    if (!normalized) return false;
    return ["1", "x", "ja", "yes", "y", "true", "aanwezig", "bevat"].includes(normalized);
  };

  const findColumnIndex = (headers, aliases) => {
    const normalizedAliases = aliases.map((alias) => normalize(alias));
    return headers.findIndex((header) => normalizedAliases.some((alias) => header.includes(alias)));
  };

  const resolveColumns = (headerRow) => {
    const normalizedHeaders = headerRow.map((header) => normalize(header));
    const productIndex = findColumnIndex(normalizedHeaders, PRODUCT_ALIASES);
    const veganIndex = findColumnIndex(normalizedHeaders, VEGAN_ALIASES);

    const allergenColumns = ALLERGEN_DEFINITIONS.map((definition) => {
      const columnIndex = findColumnIndex(normalizedHeaders, definition.aliases);
      return columnIndex === -1 ? null : { ...definition, columnIndex };
    }).filter(Boolean);

    return {
      productIndex: productIndex === -1 ? 0 : productIndex,
      veganIndex,
      allergenColumns,
    };
  };

  const toProducts = (rows) => {
    if (rows.length < 2) return { products: [], usedAllergens: [], hasVegan: false };

    const [headerRow, ...dataRows] = rows;
    const { productIndex, veganIndex, allergenColumns } = resolveColumns(headerRow);

    const usedAllergens = new Set();
    let hasVegan = false;

    const products = dataRows
      .map((row) => {
        const name = row[productIndex]?.trim();
        if (!name) return null;

        const allergens = allergenColumns
          .filter((column) => truthy(row[column.columnIndex]))
          .map((column) => {
            usedAllergens.add(column.key);
            return { key: column.key, label: column.label };
          });

        const vegan = veganIndex >= 0 ? truthy(row[veganIndex]) : false;
        if (vegan) hasVegan = true;

        return { name, allergens, vegan };
      })
      .filter(Boolean);

    const usedOrdered = ALLERGEN_DEFINITIONS.filter((item) => usedAllergens.has(item.key)).map((item) => ({
      key: item.key,
      label: item.label,
    }));

    return { products, usedAllergens: usedOrdered, hasVegan };
  };

  const iconMarkup = (key, label) => `
    <span class="allergen-icon" role="img" aria-label="${label}" title="${label}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        ${ICONS[key]}
      </svg>
    </span>
  `;

  const renderLegend = (items, hasVegan) => {
    const legend = document.getElementById("allergens-legend");
    if (!legend) return;

    const entries = [...items];
    if (hasVegan) {
      entries.push({ key: "vegan", label: "Vegan" });
    }

    legend.innerHTML = entries
      .map(
        (entry) => `
          <li class="allergens-legend-item">
            ${iconMarkup(entry.key, entry.label)}
            <span>${entry.label}</span>
          </li>
        `
      )
      .join("");
  };

  const renderProducts = (products) => {
    const productsEl = document.getElementById("allergens-products");
    if (!productsEl) return;

    productsEl.innerHTML = products
      .map((product) => {
        const itemIcons = [...product.allergens];
        if (product.vegan) {
          itemIcons.push({ key: "vegan", label: "Vegan" });
        }

        const iconList = itemIcons.length
          ? itemIcons
              .map(
                (item) => `
                  <li class="allergen-chip">
                    ${iconMarkup(item.key, item.label)}
                    <span class="allergen-chip-label">${item.label}</span>
                  </li>
                `
              )
              .join("")
          : '<li class="allergen-chip allergen-chip-empty">Geen gemelde allergenen</li>';

        return `
          <article class="allergen-product-card">
            <h3>${product.name}</h3>
            <ul class="allergen-chip-list" aria-label="Allergenen voor ${product.name}">
              ${iconList}
            </ul>
          </article>
        `;
      })
      .join("");
  };

  const loadAllergens = async () => {
    const status = document.getElementById("allergens-status");

    try {
      const response = await fetch(getSheetUrl(ALLERGENS_SHEET_ID), {
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Fetch failed");

      const text = await response.text();
      const rows = parseCsv(text);
      const { products, usedAllergens, hasVegan } = toProducts(rows);

      if (products.length === 0) {
        if (status) {
          status.textContent = "Geen allergeneninformatie beschikbaar.";
        }
        return;
      }

      renderLegend(usedAllergens, hasVegan);
      renderProducts(products);

      if (status) {
        status.textContent = "";
      }
    } catch (error) {
      if (status) {
        status.textContent = "Kon de allergenenlijst niet laden. Probeer later opnieuw.";
      }
    }
  };

  loadAllergens();
})();
