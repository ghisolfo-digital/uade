/* =========================
   CONFIG
   ========================= */

const SHEET_ID = "2PACX-1vQua7bRuLUCEn5RNhFUrPchYU2VakNelZINjffYABqegNVOVx8UvRMy95GuTLj73v_pWSNosbW8TDfZ";
const GID = "1536491413";

function getCsvUrl() {
  const ltdata1 = String.fromCharCode(100);
  const ltdata2 = String.fromCharCode(101);

  const base = `https://docs.google.com/spreadsheets/${ltdata1}/${ltdata2}/`;

  const params = new URLSearchParams({
    gid: GID,
    single: "true",
    output: "csv"
  });

  return `${base}${SHEET_ID}/pub?${params.toString()}`;
}


/* =========================
   FETCH + PARSEO
   ========================= */

async function fetchCSV() {
  const res = await fetch(getCsvUrl());
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(csv) {
  const rows = csv
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .map(line => {
      const result = [];
      let current = "";
      let insideQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (insideQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          result.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current);
      return result;
    });

  return rows;
}


/* =========================
   UTILIDADES
   ========================= */

function tipoToSlug(tipo) {
  return tipo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sin-tipo";
}

function tipoToClass(tipo) {
  return "tipo-" + tipoToSlug(tipo);
}

function parseDateRelaxed(str) {
  if (!str) return null;

  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return new Date(`${y}-${m}-${d}`);
  }

  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function getDayName(date) {
  const days = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  return days[date.getDay()];
}


/* =========================
   ARMADO HTML
   ========================= */

function buildApp(rows) {
  const header = rows.shift();

  const clean = rows.filter(r =>
    r.slice(0, 5).some(c => (c || "").trim() !== "")
  );

  // tipos únicos
  const tipos = {};
  clean.forEach(r => {
    const label = (r[2] || "").trim();
    if (!label) return;
    tipos[tipoToSlug(label)] = label;
  });

  // agrupar por clase
  const groups = [];
  let current = null;

  clean.forEach(r => {
    const key = r[0] || "-";

    if (!current || current.key !== key) {
      current = { key, rows: [] };
      groups.push(current);
    }

    current.rows.push(r);
  });

  renderFilters(tipos);
  renderGroups(groups);
}


/* =========================
   RENDER FILTROS
   ========================= */

function renderFilters(tipos) {
  const container = document.querySelector(".filters-body");
  if (!container) return;

  Object.entries(tipos).forEach(([slug, label]) => {
    const el = document.createElement("label");
    el.className = "filter-chip";

    el.innerHTML = `
      <input type="checkbox" class="f-tipo" value="${slug}" checked>
      <span>${label}</span>
    `;

    container.appendChild(el);
  });
}


/* =========================
   RENDER GRUPOS
   ========================= */

function renderGroups(groups) {
  const grid = document.querySelector(".grid");
  if (!grid) return;

  groups.forEach(g => {
    const first = g.rows[0];
    const clase = first[0] || "-";
    const fecha = first[1] || "";

    let title = "Links generales";

    if (clase !== "-") {
      const d = parseDateRelaxed(fecha);
      const dow = d ? getDayName(d) : "";
      title = `Clase ${clase} - ${dow} ${fecha}`;
    }

    const details = document.createElement("details");
    details.className = "group";
    details.open = true;

    details.innerHTML = `
      <summary class="group-label">${title}</summary>
      <ul class="group-list"></ul>
    `;

    const list = details.querySelector(".group-list");

    g.rows.forEach(r => {
      const tipo = r[2] || "";
      const slug = tipoToSlug(tipo);
      const link = r[4] || "";

      const li = document.createElement("li");
      li.className = "group-item";
      li.dataset.tipo = slug;

      const tag = link ? "a" : "div";
      const row = document.createElement(tag);

      row.className = `grid-row ${tipoToClass(tipo)}`;

      if (link) {
        row.href = link;
        row.target = "_blank";
      }

      row.innerHTML = `
        <div class="grid-cell">${r[2] || "-"}</div>
        <div class="grid-cell">${r[3] || "-"}</div>
      `;

      li.appendChild(row);
      list.appendChild(li);
    });

    grid.appendChild(details);
  });
}


/* =========================
   INIT
   ========================= */

fetchCSV().then(buildApp);