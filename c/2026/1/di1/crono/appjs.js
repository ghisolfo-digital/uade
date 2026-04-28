/* =========================
   CONFIG
   ========================= */

const SHEET_ID = "2PACX-1vTzorEweuNXvqkPaIG3BD2jICRf1pglBSIXC1WnxhqwvMXn1_U-JM_6XowKyGI82pMsc7YfqxjN5zLi";
const GID = "864183544";

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
  const res = await fetch(getCsvUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar el CSV (${res.status})`);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  text = String(text || "").replace(/^\uFEFF/, "");

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

function clean(value) {
  return String(value ?? "").trim();
}

function isTrue(value) {
  const v = clean(value).toLowerCase();
  return ["true", "verdadero", "sí", "si", "1", "x"].includes(v);
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sin-bloque";
}

function escapeHTML(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseDateRelaxed(str) {
  if (!str) return null;
  str = clean(str);

  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    let [d, m, y] = parts.map(p => Number(clean(p)));
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    if (y < 100) y += 2000;
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  const d = new Date(str);
  if (isNaN(d)) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDayName(date) {
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return days[date.getDay()];
}

function formatClassNumber(value) {
  const n = Number(clean(value));
  return Number.isFinite(n) ? String(n).padStart(2, "0") : clean(value);
}

function todayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/* =========================
   DATA
   ========================= */

function readData(rows) {
  const pageHeader = rows[0] || [];
  const firstField = clean(pageHeader[0]);
  const headerTitle = clean(pageHeader[1]) || "Cronograma";
  const headerMeta = clean(pageHeader[2]);
  const headerBrand = clean(pageHeader[3]);
  const timeStart = clean(pageHeader[4]);
  const timeEnd = clean(pageHeader[5]);

  const classRows = rows
    .slice(1)
    .filter(r => clean(r[0]).toLowerCase() === "clase")
    .map(r => ({
      clase: clean(r[1]),
      fecha: clean(r[2]),
      aula: clean(r[3]),
      tipoClase: clean(r[4]).toLowerCase() || "presencial",
      bloque: clean(r[5]),
      actividad: clean(r[6]),
      link: clean(r[7]),
      destacado: isTrue(r[8]),
      asistenciaObligatoria: isTrue(r[9]),
      comentario: clean(r[10]),
      tarea: clean(r[11])
    }));

  const groups = [];
  const byKey = new Map();

  classRows.forEach(item => {
    const key = `${item.clase}__${item.fecha}`;
    if (!byKey.has(key)) {
      const group = {
        clase: item.clase,
        fecha: item.fecha,
        date: parseDateRelaxed(item.fecha),
        aula: item.aula,
        tipoClase: item.tipoClase,
        comentario: item.comentario,
        rows: []
      };
      byKey.set(key, group);
      groups.push(group);
    }

    const group = byKey.get(key);
    if (!group.aula && item.aula) group.aula = item.aula;
    if ((!group.comentario || ["feriado", "suspendida"].includes(item.tipoClase)) && item.comentario) group.comentario = item.comentario;
    if (["feriado", "suspendida"].includes(item.tipoClase)) group.tipoClase = item.tipoClase;
    group.rows.push(item);
  });

  const blocks = [];
  const seen = new Set();
  classRows.forEach(item => {
    const block = item.bloque || (item.asistenciaObligatoria ? "Asistencia" : "");
    if (!block) return;
    const slug = slugify(block);
    if (!seen.has(slug)) {
      seen.add(slug);
      blocks.push({ label: block, slug });
    }
  });

  return {
    firstField,
    headerTitle,
    headerMeta,
    headerBrand,
    timeStart,
    timeEnd,
    groups,
    blocks
  };
}

function getNextClassIndex(groups) {
  const today = todayLocal();
  return groups.findIndex(g => g.date && g.date >= today && !["feriado", "suspendida"].includes(g.tipoClase));
}

/* =========================
   RENDER
   ========================= */

function render(data) {
  const schedule = document.getElementById("schedule");
  if (!schedule) return;

  document.getElementById("header-title").textContent = data.headerTitle;
  document.getElementById("header-meta").textContent = data.headerMeta;
  document.getElementById("header-brand").textContent = data.headerBrand;

  const timeText = data.timeStart && data.timeEnd ? ` · ${data.timeStart} a ${data.timeEnd} hs` : "";
  document.getElementById("header-subline").textContent = `${data.firstField || "Cronograma"}${timeText}`;
  document.title = `Cronograma - ${data.firstField || data.headerTitle} - @ghisolfo.digital`;

  if (data.groups.length === 0) {
    schedule.innerHTML = `<div class="status-card">No hay clases para mostrar.</div>`;
    return;
  }

  const nextIdx = getNextClassIndex(data.groups);
  schedule.style.setProperty("--block-count", Math.max(data.blocks.length, 1));

  schedule.innerHTML = `
    <div class="schedule-card">
      <div class="schedule-row schedule-head">
        <div class="head-main">Clase</div>
        ${data.blocks.map((b, i) => `
          <div class="head-block block-${(i % 8) + 1}" data-block="${escapeHTML(b.slug)}">${escapeHTML(b.label)}</div>
        `).join("")}
      </div>
      <div class="schedule-body">
        ${data.groups.map((group, index) => renderGroup(group, index, nextIdx, data.blocks)).join("")}
      </div>
    </div>
  `;
}

function renderGroup(group, index, nextIdx, blocks) {
  const isPast = group.date && group.date < todayLocal();
  const isNext = index === nextIdx;
  const isSpecial = ["feriado", "suspendida"].includes(group.tipoClase);
  const day = group.date ? getDayName(group.date) : "";
  const classNo = formatClassNumber(group.clase);
  const typeLabel = group.tipoClase ? group.tipoClase.charAt(0).toUpperCase() + group.tipoClase.slice(1) : "Clase";

  const rowClasses = [
    "schedule-row",
    isPast ? "is-past" : "",
    isNext ? "is-next" : "",
    isSpecial ? `is-${group.tipoClase} is-special` : ""
  ].filter(Boolean).join(" ");

  if (isSpecial) {
    return `
      <div class="${rowClasses}">
        <div class="class-cell">
          ${isNext ? `<span class="next-hand">👈</span>` : ""}
          <div class="class-number">${escapeHTML(classNo)}</div>
          <div class="class-date">${escapeHTML(day)} ${escapeHTML(group.fecha)}</div>
          <div class="class-room">${escapeHTML(typeLabel)}</div>
        </div>
        <div class="special-cell" style="grid-column: span ${Math.max(blocks.length, 1)};">
          <span class="special-label">${escapeHTML(group.comentario || typeLabel)}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="${rowClasses}">
      <div class="class-cell">
        ${isNext ? `<span class="next-hand">👈</span>` : ""}
        <div class="class-number">Clase ${escapeHTML(classNo)}</div>
        <div class="class-date">${escapeHTML(day)} ${escapeHTML(group.fecha)}</div>
        <div class="class-room">Aula ${escapeHTML(group.aula || "-")} · ${escapeHTML(typeLabel)}</div>
      </div>
      ${blocks.map((block, i) => renderBlockCell(group, block, i)).join("")}
    </div>
  `;
}

function renderBlockCell(group, block, blockIndex) {
  const items = group.rows.filter(item => slugify(item.bloque) === block.slug);
  const colorClass = `block-${(blockIndex % 8) + 1}`;

  if (items.length === 0) return `<div class="block-cell empty-cell ${colorClass}" aria-hidden="true"></div>`;

  return `
    <div class="block-cell ${colorClass}">
      ${items.map(item => renderActivity(item)).join("")}
    </div>
  `;
}

function renderActivity(item) {
  const classes = [
    "activity-pill",
    item.destacado ? "is-strong" : "is-soft",
    item.asistenciaObligatoria ? "is-required" : ""
  ].filter(Boolean).join(" ");

  const label = escapeHTML(item.actividad || item.comentario || "-");
  const titleParts = [];
  if (item.comentario) titleParts.push(item.comentario);
  if (item.tarea) titleParts.push(`Tarea: ${item.tarea}`);
  if (item.asistenciaObligatoria) titleParts.push("Asistencia obligatoria");
  const title = titleParts.length ? ` title="${escapeHTML(titleParts.join(" · "))}"` : "";

  if (item.link) {
    return `<a class="${classes}" href="${escapeHTML(item.link)}" target="_blank" rel="noopener noreferrer"${title}>${label}</a>`;
  }
  return `<span class="${classes}"${title}>${label}</span>`;
}

function showError(error) {
  const status = document.getElementById("status-message");
  if (status) {
    status.textContent = `Error al cargar el cronograma: ${error.message}`;
    status.classList.add("is-error");
  }
}

/* =========================
   INIT
   ========================= */

fetchCSV()
  .then(rows => {
    const data = readData(rows);
    render(data);
    const status = document.getElementById("status-message");
    if (status) status.remove();
  })
  .catch(showError);
