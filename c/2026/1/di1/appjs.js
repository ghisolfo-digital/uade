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

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  text = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

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

  str = String(str).trim();

  const parts = str.split(/[\/\-]/);

  if (parts.length === 3) {
    let [d, m, y] = parts.map(p => p.trim());

    d = Number(d);
    m = Number(m);
    y = Number(y);

    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;

    if (y < 100) y += 2000;

    return new Date(y, m - 1, d);
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
  const header = rows.shift() || [];

  let headerTitle, headerMeta, headerBrand, firstField;

  if (header.length >= 4) {
    firstField = header[0] || "";
    headerTitle = header[1] || "";
    headerMeta = header[2] || "";
    headerBrand = header[3] || "";
  } else {
    firstField = header[0] || "";
    headerTitle = header[0] || "";
    headerMeta = header[1] || "";
    headerBrand = header[2] || "";
  }

  document.querySelector("#header-title").textContent = headerTitle || "Experiencia de Usuario";
  document.querySelector("#header-meta").textContent = headerMeta || "";
  document.querySelector("#header-brand").textContent = headerBrand || "";

  document.title = `Teóricas, links y materiales - ${firstField || "Listado"} - @ghisolfo.digital`;

  const clean = rows
    .map(r => Array.from({ length: 5 }, (_, i) => r[i] || ""))
    .filter(r => r.slice(0, 5).some(c => String(c).trim() !== ""));

let tipos = {};
clean.forEach(r => {
  const label = (r[2] || "").trim();
  if (!label) return;
  tipos[tipoToSlug(label)] = label;
});

const preferredOrder = [
  "consigna",
  "teorica",
  "materia",
  "ejemplo",
  "devolucion",
  "tutorial",
  "grabacion",
  "opcional",
  "varios"
];

const orderedTipos = {};

preferredOrder.forEach(slug => {
  if (tipos[slug]) {
    orderedTipos[slug] = tipos[slug];
    delete tipos[slug];
  }
});

Object.entries(tipos)
  .sort((a, b) => a[1].localeCompare(b[1], "es"))
  .forEach(([slug, label]) => {
    orderedTipos[slug] = label;
  });

tipos = orderedTipos;

  const groups = [];
  let current = null;

  clean.forEach(r => {
    const key = (r[0] || "").trim() || "-";

    if (!current || current.key !== key) {
      current = { key, rows: [] };
      groups.push(current);
    }

    current.rows.push(r);
  });

  const lastClassIdx = findLastClassIndex(groups);
  const shouldHighlightMostRecent = shouldHighlightLastClass(groups, lastClassIdx);

  renderFilters(tipos);
  renderGroups(groups, lastClassIdx, shouldHighlightMostRecent);
  initFiltersPanelToggle();
  initInteractions();
  initFabDown();
  

  const status = document.querySelector("#status-message");
  if (status) status.remove();
}

/* =========================
   RENDER FILTROS
   ========================= */

function renderFilters(tipos) {
  const container = document.querySelector(".filters-body");
  if (!container) return;

  container.innerHTML = "";

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


function findLastClassIndex(groups) {
  for (let i = groups.length - 1; i >= 0; i--) {
    const first = groups[i].rows[0];
    const clase = (first[0] || "").trim();

    if (clase !== "" && clase !== "-") {
      return i;
    }
  }

  return -1;
}

function shouldHighlightLastClass(groups, lastClassIdx) {
  if (lastClassIdx < 0) return false;

  const first = groups[lastClassIdx].rows[0];
  const fecha = (first[1] || "").trim();
  const date = parseDateRelaxed(fecha);

  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  return date >= oneMonthAgo;
}
/* =========================
   RENDER GRUPOS
   ========================= */


function renderGroups(groups, lastClassIdx, shouldHighlightMostRecent) {
  const grid = document.querySelector(".grid");
  if (!grid) return;

  grid.innerHTML = "";

  groups.forEach((g, index) => {
    const first = g.rows[0];
    const clase = first[0] || "-";
    const fecha = first[1] || "";

    const isMostRecent =
      index === lastClassIdx &&
      clase !== "-" &&
      shouldHighlightMostRecent;

    let title = "Links generales";

    if (clase !== "-") {
      const d = parseDateRelaxed(fecha);
      const dow = d ? getDayName(d) : "";
      const sep = dow && fecha ? " " : "";
      title = `Clase ${clase} - ${dow}${sep}${fecha}`;
    }

    const details = document.createElement("details");
    details.className = isMostRecent ? "group ultima-clase" : "group";
    details.open = true;

    details.innerHTML = `
      <summary class="group-label${isMostRecent ? " ultima-clase" : ""}">
        ${title}
        ${isMostRecent ? `<span class="ultima-tag" aria-label="clase más reciente">más reciente</span>` : ""}
      </summary>
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
        row.rel = "noopener noreferrer";
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

function initInteractions() {
  const grid = document.querySelector(".grid");
  const body = document.body;

  const checkboxes = Array.from(document.querySelectorAll(".f-tipo"));
  const items = Array.from(document.querySelectorAll(".group-item"));
  const groups = Array.from(document.querySelectorAll("details.group"));

  const btnAll = document.querySelector(".btn-all");
  const btnClear = document.querySelector(".btn-clear");

  const expandBtns = Array.from(document.querySelectorAll("#btn-expand-groups, #btn-expand-groups-bottom"));
  const collapseBtns = Array.from(document.querySelectorAll("#btn-collapse-groups, #btn-collapse-groups-bottom"));

  const flatBtns = Array.from(document.querySelectorAll(".btn-toggle-flat"));

  function updateFlatBtnText() {
    const isFlat = body.classList.contains("flat-mode");
    const text = isFlat ? "Ver por clases" : "Ver todo junto";

    flatBtns.forEach(btn => {
      const span = btn.querySelector(".btn-text");
      if (span) {
        span.textContent = text;
      } else {
        btn.textContent = text;
      }
    });
  }

  function updateControls() {
    const total = checkboxes.length;
    const checked = checkboxes.filter(cb => cb.checked).length;

    if (btnAll) btnAll.disabled = total === 0 || checked === total;
    if (btnClear) btnClear.disabled = total === 0 || checked === 0;

    const isFlat = body.classList.contains("flat-mode");
    const visibleGroups = groups.filter(g => !g.classList.contains("is-hidden"));
    const openCount = visibleGroups.filter(g => g.hasAttribute("open")).length;

    const expandDisabled = isFlat || visibleGroups.length === 0 || openCount === visibleGroups.length;
    const collapseDisabled = isFlat || visibleGroups.length === 0 || openCount === 0;

    expandBtns.forEach(btn => btn.disabled = expandDisabled);
    collapseBtns.forEach(btn => btn.disabled = collapseDisabled);
  }

  function applyFilter() {
    const active = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
    const noneSelected = active.length === 0;

    items.forEach(li => {
      const tipo = li.dataset.tipo || "";
      const visible = !noneSelected && active.includes(tipo);
      li.classList.toggle("is-hidden", !visible);
    });

    groups.forEach(group => {
      const hasVisible = group.querySelector(".group-item:not(.is-hidden)") !== null;
      group.classList.toggle("is-hidden", !hasVisible);
    });

    updateControls();
  }

  function setFlatMode(on) {
    if (!grid) return;

    grid.classList.toggle("GridFlat", on);
    body.classList.toggle("flat-mode", on);

    if (on) {
      groups.forEach(g => g.setAttribute("open", ""));
    }

    flatBtns.forEach(btn => {
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = on ? "Ver por clases" : "Ver todo junto";
    });

    updateFlatBtnText();
    updateControls();
  }

  checkboxes.forEach(cb => cb.addEventListener("change", applyFilter));

  if (btnAll) {
    btnAll.addEventListener("click", () => {
      checkboxes.forEach(cb => cb.checked = true);
      applyFilter();
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      checkboxes.forEach(cb => cb.checked = false);
      applyFilter();
    });
  }

  expandBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      groups
        .filter(g => !g.classList.contains("is-hidden"))
        .forEach(g => g.setAttribute("open", ""));
      updateControls();
    });
  });

  collapseBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      groups.forEach(g => g.removeAttribute("open"));
      updateControls();
    });
  });

  flatBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      setFlatMode(!body.classList.contains("flat-mode"));
    });
  });

  groups.forEach(g => g.addEventListener("toggle", updateControls));

  applyFilter();

  const startFlat = body.classList.contains("flat-mode") || (grid && grid.classList.contains("GridFlat"));
  setFlatMode(startFlat);
}
function initFiltersPanelToggle() {
  const details = document.querySelector("details.filters-panel");
  const panel = document.querySelector(".filters--in-header");

  if (!details || !panel) return;

  function sync() {
    panel.classList.toggle("is-collapsed", !details.open);
  }

  details.addEventListener("toggle", sync);
  sync();
}
function initFabDown() {
  const fab = document.getElementById("fab-down");
  if (!fab) return;

  fab.addEventListener("click", () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth"
    });
  });

  function onScroll() {
    const doc = document.documentElement;
    const dist = doc.scrollHeight - window.innerHeight - window.scrollY;
    fab.classList.toggle("fab-hidden", dist < 24);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* =========================
   INIT
   ========================= */

fetchCSV().then(buildApp);