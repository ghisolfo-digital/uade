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
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return days[date.getDay()];
}

function formatDateShort(value) {
  const v = clean(value);
  return v.replace(/\/\d{4}$/, "");
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

function mixWithWhite(hex, amount = 0.62) {
  const c = clean(hex).replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return "";
  const n = parseInt(c, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mr = Math.round(r + (255 - r) * amount);
  const mg = Math.round(g + (255 - g) * amount);
  const mb = Math.round(b + (255 - b) * amount);
  return `rgb(${mr}, ${mg}, ${mb})`;
}

function normalizeColor(value) {
  const v = clean(value);
  if (!v) return "";
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
  if (/^rgb\(/i.test(v) || /^hsl\(/i.test(v)) return v;
  return "";
}

function blockStyle(block) {
  const styles = [];
  if (block.soft) styles.push(`--soft:${block.soft}`);
  if (block.strong) styles.push(`--strong:${block.strong}`);
  return styles.length ? styles.join(";") : "";
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

  const blockDefs = new Map();
  rows.slice(1).forEach(r => {
    if (clean(r[0]).toLowerCase() !== "bloques") return;
    const label = clean(r[1]);
    if (!label) return;
    const slug = slugify(label);
    const strong = normalizeColor(r[2]);
    const soft = normalizeColor(r[3]) || (strong ? mixWithWhite(strong) : "");
    blockDefs.set(slug, { label, slug, strong, soft });
  });

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

  blockDefs.forEach(def => {
    seen.add(def.slug);
    blocks.push(def);
  });

  classRows.forEach(item => {
    const block = item.bloque || (item.asistenciaObligatoria ? "Asistencia" : "");
    if (!block) return;
    const slug = slugify(block);
    if (!seen.has(slug)) {
      seen.add(slug);
      blocks.push({ label: block, slug, strong: "", soft: "" });
    }
  });

  return { firstField, headerTitle, headerMeta, headerBrand, timeStart, timeEnd, groups, blocks };
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
        <div class="head-class">Clase</div>
        <div class="head-day">Día</div>
        <div class="head-date">Fecha</div>
        <div class="head-room">Aula</div>
        ${data.blocks.map((b, i) => `
          <div class="head-block block-${(i % 8) + 1}" data-block="${escapeHTML(b.slug)}" style="${blockStyle(b)}">${escapeHTML(b.label)}</div>
        `).join("")}
        <div class="head-comment">Comentarios</div>
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
        <div class="class-no">${isNext ? `<span class="next-hand">👉</span>` : ""}${escapeHTML(classNo)}</div>
        <div class="class-day">${escapeHTML(day)}</div>
        <div class="class-date">${escapeHTML(formatDateShort(group.fecha))}</div>
        <div class="class-room">${escapeHTML(group.aula || "")}</div>
        <div class="special-cell" style="grid-column: span ${Math.max(blocks.length + 1, 1)};">
          ${escapeHTML(group.comentario || typeLabel)}
        </div>
      </div>
    `;
  }

  return `
    <div class="${rowClasses}">
      <div class="class-no">${isNext ? `<span class="next-hand">👉</span>` : ""}${escapeHTML(classNo)}</div>
      <div class="class-day">${escapeHTML(day)}</div>
      <div class="class-date">${escapeHTML(formatDateShort(group.fecha))}</div>
      <div class="class-room">${escapeHTML(group.aula || "-")}</div>
      ${blocks.map((block, i) => renderBlockCell(group, block, i)).join("")}
      <div class="comment-cell">${escapeHTML(group.comentario || "")}</div>
    </div>
  `;
}

function renderBlockCell(group, block, blockIndex) {
  const items = group.rows.filter(item => slugify(item.bloque) === block.slug);
  const colorClass = `block-${(blockIndex % 8) + 1}`;
  const style = blockStyle(block);

  if (items.length === 0) return `<div class="block-cell empty-cell ${colorClass}" style="${style}" aria-hidden="true"></div>`;

  return `
    <div class="block-cell ${colorClass}" style="${style}">
      ${items.map(item => renderActivity(item)).join("")}
    </div>
  `;
}

function renderActivity(item) {
  const classes = [
    "activity-cell",
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
