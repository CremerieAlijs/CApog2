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

  const normalizeKey = (value) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const isTruthyMarker = (value) => {
    const cleaned = normalizeKey(String(value || ""));
    return ["x", "ja", "yes", "true", "1", "aanwezig"].includes(cleaned);
  };

  const ICON_LIBRARY = {
    gluten: { label: "Gluten", icon: "AllergensIMG/Gluten.png", aliases: ["gluten"] },
    melk: { label: "Melk", icon: "AllergensIMG/Melk.png", aliases: ["melk", "lactose", "milk"] },
    ei: { label: "Ei", icon: "AllergensIMG/Ei.png", aliases: ["ei", "eieren", "egg"] },
    noten: { label: "Noten", icon: "AllergensIMG/Noten.png", aliases: ["noten", "noot", "nuts"] },
    pinda: { label: "Pinda", icon: "AllergensIMG/Pinda.png", aliases: ["pinda", "pindas", "peanut", "aardnoot"] },
    soja: { label: "Soja", icon: "AllergensIMG/Soja.png", aliases: ["soja", "soy"] },
    vegan: { label: "Vegan", icon: "AllergensIMG/Vegan.png", aliases: ["vegan", "veganistisch"] },
    vis: { label: "Vis", icon: "AllergensIMG/Vis.png", aliases: ["vis", "fish"] },
    schaaldieren: { label: "Schaaldieren", icon: "AllergensIMG/Schaaldieren.png", aliases: ["schaaldieren"] },
    weekdieren: { label: "Weekdieren", icon: "AllergensIMG/Weekdieren.png", aliases: ["weekdieren"] },
    selderij: { label: "Selderij", icon: "AllergensIMG/Selderij.png", aliases: ["selderij", "celery"] },
    mosterd: { label: "Mosterd", icon: "AllergensIMG/Mosterd.png", aliases: ["mosterd", "mustard"] },
    sesam: { label: "Sesam", icon: "AllergensIMG/Sesam.png", aliases: ["sesam", "sesame"] },
    lupine: { label: "Lupine", icon: "AllergensIMG/Lupine.png", aliases: ["lupine"] },
    zwaveldioxide: { label: "Zwaveldioxide", icon: "AllergensIMG/Zwaveldioxide.png", aliases: ["zwaveldioxide", "sulfiet", "sulfieten"] },
  };

  const LEGEND_PRIORITY = ["gluten", "melk", "ei", "noten", "pinda", "soja", "vegan"];
  const PRODUCT_ALIASES = ["product", "productnaam", "naam", "smaak", "smaken"];

  const findMappedAllergen = (header) => {
    const normalizedHeader = normalizeKey(header);
    return Object.entries(ICON_LIBRARY).find(([, config]) =>
      config.aliases.some((alias) => normalizedHeader === normalizeKey(alias))
    );
  };

  const getSchema = (headerRow) => {
    const columns = headerRow.map((cell, index) => {
      const found = findMappedAllergen(cell);
      return {
        index,
        header: cell,
        allergenKey: found?.[0] || null,
      };
    });

    const productColumn =
      columns.find((column) => PRODUCT_ALIASES.includes(normalizeKey(column.header))) ||
      columns.find((column) => !column.allergenKey);

    return {
      productColumnIndex: productColumn ? productColumn.index : 0,
      allergenColumns: columns.filter((column) => column.allergenKey),
    };
  };

  const toProducts = (rows) => {
    if (rows.length === 0) return { products: [], usedAllergens: [] };

    const [headerRow, ...dataRows] = rows;
    const schema = getSchema(headerRow);
    const used = new Set();

    const products = dataRows
      .map((row) => {
        const name = (row[schema.productColumnIndex] || "").trim();
        if (!name) return null;

        const allergens = [];
        let isVegan = false;

        schema.allergenColumns.forEach(({ index, allergenKey }) => {
          const rawValue = row[index] || "";
          if (!isTruthyMarker(rawValue)) return;

          if (allergenKey === "vegan") {
            isVegan = true;
            used.add("vegan");
            return;
          }

          allergens.push(allergenKey);
          used.add(allergenKey);
        });

        if (isVegan) {
          used.add("vegan");
        }

        return {
          name,
          allergens,
          isVegan,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, "nl", { sensitivity: "base" }));

    return { products, usedAllergens: [...used] };
  };

  const renderIcon = (key) => {
    const data = ICON_LIBRARY[key];
    if (!data) return "";

    return `
      <span class="allergen-icon-chip" title="${data.label}" aria-label="${data.label}">
        <img src="${data.icon}" alt="${data.label}" loading="lazy" width="32" height="32" />
      </span>
    `;
  };

  const renderLegend = () => {
    const legendEl = document.getElementById("allergens-legend-list");
    if (!legendEl) return;

    const remainingKeys = Object.keys(ICON_LIBRARY)
      .filter((key) => !LEGEND_PRIORITY.includes(key))
      .sort((a, b) => ICON_LIBRARY[a].label.localeCompare(ICON_LIBRARY[b].label, "nl"));

    const keys = [...LEGEND_PRIORITY, ...remainingKeys];

    legendEl.innerHTML = keys
      .filter((key) => ICON_LIBRARY[key])
      .map(
        (key) => `
          <li class="allergens-legend-item">
            ${renderIcon(key)}
            <span>${ICON_LIBRARY[key].label}</span>
          </li>
        `
      )
      .join("");
  };

  const renderProducts = (products) => {
    const productsEl = document.getElementById("allergens-products-list");
    if (!productsEl) return;

    productsEl.innerHTML = products
      .map((product) => {
        const keys = [...product.allergens, ...(product.isVegan ? ["vegan"] : [])];
        const iconMarkup = keys.map((key) => renderIcon(key)).join("");

        return `
          <article class="allergen-product-card">
            <h3>${product.name}</h3>
            <div class="allergen-product-icons" aria-label="Allergenen voor ${product.name}">
              ${
                iconMarkup ||
                '<span class="allergen-none">Geen gemarkeerde allergenen in de brondata.</span>'
              }
            </div>
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

      if (!response.ok) {
        throw new Error("Fetch failed");
      }

      const text = await response.text();
      const rows = parseCsv(text);
      const { products } = toProducts(rows);

      if (products.length === 0) {
        if (status) {
          status.textContent = "Geen allergeneninformatie beschikbaar.";
        }
        return;
      }

      renderLegend();
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
