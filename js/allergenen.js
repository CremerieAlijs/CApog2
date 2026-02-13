(() => {
  const SHEET_ID = "1vDlIiBXnlJ5WnvD9FS3tJPHq3hsECP63BTwSWvhinj4";
  const GID = "1971864328";
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

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

  const renderTable = (rows) => {
    const head = document.getElementById("allergens-table-head");
    const body = document.getElementById("allergens-table-body");
    const status = document.getElementById("allergens-status");

    if (!head || !body || !status) return;

    if (rows.length === 0) {
      status.textContent = "Geen allergeneninformatie beschikbaar.";
      return;
    }

    const [headerRow, ...dataRows] = rows;

    head.innerHTML = `<tr>${headerRow
      .map((cell) => `<th scope="col">${cell || "-"}</th>`)
      .join("")}</tr>`;

    body.innerHTML = dataRows
      .map(
        (row) =>
          `<tr>${headerRow
            .map((_, index) => `<td>${row[index]?.trim() || "-"}</td>`)
            .join("")}</tr>`
      )
      .join("");

    status.textContent = "";
  };

  const loadAllergens = async () => {
    const status = document.getElementById("allergens-status");

    try {
      const response = await fetch(CSV_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Fetch failed");
      }

      const text = await response.text();
      const rows = parseCsv(text);
      renderTable(rows);
    } catch (error) {
      if (status) {
        status.textContent = "Kon de allergenenlijst niet laden. Probeer later opnieuw.";
      }
    }
  };

  loadAllergens();
})();
