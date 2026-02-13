(() => {
  const ALLERGENS_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFHVIq4m5c0quhYDrSoDoYVxV-0LsN5h1ZSzv-hOBFIN6YRFZjkKB59JNWyeLoR7et0p6kHFPgoyxG/pubhtml?gid=1971864328&single=true";

  const parsePublishedSheetHtml = (text) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");
    const table = doc.querySelector("table");
    if (!table) {
      return [];
    }

    const rows = Array.from(table.querySelectorAll("tr"))
      .map((row) =>
        Array.from(row.querySelectorAll("th, td")).map((cell) => {
          const value = cell.textContent?.replace(/\u00a0/g, " ").trim();
          return value && value.length > 0 ? value : "-";
        })
      )
      .filter((row) => row.some((value) => value !== "-"));

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
      const response = await fetch(ALLERGENS_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Fetch failed");
      }

      const text = await response.text();
      const rows = parsePublishedSheetHtml(text);
      renderTable(rows);
    } catch (error) {
      if (status) {
        status.textContent = "Kon de allergenenlijst niet laden. Probeer later opnieuw.";
      }
    }
  };

  loadAllergens();
})();
