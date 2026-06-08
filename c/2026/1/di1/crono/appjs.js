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
   FETCH + PARSEO CSV
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
  const raw = clean(value);
  const n = Number(raw);
  return Number.isFinite(n) && raw !== "" ? String(n).padStart(2, "0") : raw;
}

function todayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mixWithWhite(hex, amount = 0.48) {
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

function isDevolucion(value) {
  return /devoluc|devolución/i.test(clean(value));
}

function sortValue(value, fallback) {
  const raw = clean(value).replace(",", ".");
  if (raw !== "" && !Number.isNaN(Number(raw))) return Number(raw);
  return fallback;
}

function rowToObject(header, row) {
  const obj = {};
  header.forEach((key, index) => {
    const k = clean(key).toLowerCase();
    if (!k) return;
    obj[k] = row[index] ?? "";
  });
  return obj;
}

/* =========================
   DATA
   ========================= */

function readData(rows) {
  rows = rows.filter(r => r.some(cell => clean(cell) !== ""));

  const firstRealRow = rows[0] || [];
  const isNewConfig = clean(firstRealRow[0]).toLowerCase() === "config";
  const configRow = isNewConfig ? firstRealRow.slice(1) : firstRealRow;

  const firstField = clean(configRow[0]);
  const headerTitle = clean(configRow[1]) || "Cronograma";
  const headerMeta = clean(configRow[2]);
  const headerBrand = clean(configRow[3]);
  const timeStart = clean(configRow[4]);
  const timeEnd = clean(configRow[5]);

  const blockDefs = new Map();
  const classRecords = [];
  const activityRecords = [];
  const noteRecords = [];
  let currentHeader = null;
  let rowCounter = 0;

  rows.forEach((r, index) => {
    const kind = clean(r[0]).toLowerCase();
    if (!kind) return;

    if (kind === "config") return;

    if (kind === "bloque") {
      const label = clean(r[1]);
      if (!label) return;
      const slug = slugify(label);
      const strong = normalizeColor(r[2]);
      const soft = normalizeColor(r[3]) || (strong ? mixWithWhite(strong) : "");
      blockDefs.set(slug, { label, slug, strong, soft });
      return;
    }

    if (kind === "tipo") {
      currentHeader = r.map(cell => clean(cell).toLowerCase());
      return;
    }

    if (!["clase", "actividad", "nota"].includes(kind)) return;
    rowCounter++;

    const item = currentHeader ? rowToObject(currentHeader, r) : {};
    item.tipo = kind;
    item.__row = index;
    item.__orderFallback = rowCounter;

    if (kind === "clase") {
      classRecords.push(item);

      // Compatibilidad con la estructura vieja: una fila clase también podía traer una actividad.
      if (clean(item.bloque) || clean(item.actividad) || clean(item.link) || clean(item.tarea)) {
        activityRecords.push({ ...item, tipo: "actividad", __fromOldClassRow: true });
      }
    } else if (kind === "actividad") {
      activityRecords.push(item);
    } else if (kind === "nota") {
      noteRecords.push(item);
    }
  });

  const classes = new Map();
  let classFallbackOrder = 0;

  classRecords.forEach(item => {
    const clase = clean(item.clase);
    if (!clase) return;
    classFallbackOrder++;

    if (!classes.has(clase)) {
      classes.set(clase, {
        type: "class",
        clase,
        ordenRaw: clean(item.orden),
        orden: sortValue(item.orden, classFallbackOrder),
        fecha: clean(item.fecha),
        date: parseDateRelaxed(item.fecha),
        aula: clean(item.aula),
        tipoClase: clean(item.tipo_clase).toLowerCase() || "presencial",
        asistenciaObligatoria: isTrue(item.asistencia_obligatoria),
        comentario: clean(item.comentario),
        rows: []
      });
    } else {
      const group = classes.get(clase);
      if (!group.ordenRaw && clean(item.orden)) {
        group.ordenRaw = clean(item.orden);
        group.orden = sortValue(item.orden, group.orden);
      }
      if (!group.fecha && clean(item.fecha)) {
        group.fecha = clean(item.fecha);
        group.date = parseDateRelaxed(item.fecha);
      }
      if (!group.aula && clean(item.aula)) group.aula = clean(item.aula);
      if (clean(item.tipo_clase) && group.tipoClase === "presencial") group.tipoClase = clean(item.tipo_clase).toLowerCase();
      if (isTrue(item.asistencia_obligatoria)) group.asistenciaObligatoria = true;
      if (!group.comentario && clean(item.comentario)) group.comentario = clean(item.comentario);
      if (["feriado", "suspendida"].includes(clean(item.tipo_clase).toLowerCase())) {
        group.tipoClase = clean(item.tipo_clase).toLowerCase();
        if (clean(item.comentario)) group.comentario = clean(item.comentario);
      }
    }
  });

  activityRecords.forEach(item => {
    const clase = clean(item.clase);
    if (!clase) return;
    if (!classes.has(clase)) {
      classFallbackOrder++;
      classes.set(clase, {
        type: "class",
        clase,
        ordenRaw: "",
        orden: classFallbackOrder,
        fecha: "",
        date: null,
        aula: "",
        tipoClase: "presencial",
        asistenciaObligatoria: false,
        comentario: "",
        rows: []
      });
    }

    if (!clean(item.bloque) && !clean(item.actividad) && !clean(item.link) && !clean(item.tarea) && !clean(item.comentario)) return;

    classes.get(clase).rows.push({
      clase,
      bloque: clean(item.bloque),
      actividad: clean(item.actividad),
      link: clean(item.link),
      destacado: isTrue(item.destacado),
      asistenciaObligatoria: isTrue(item.asistencia_obligatoria),
      comentario: clean(item.comentario),
      tarea: clean(item.tarea),
      __row: item.__row
    });
  });

  const notes = noteRecords.map((item, index) => {
    const hasTitleColumn = Object.prototype.hasOwnProperty.call(item, "titulo");
    const titulo = hasTitleColumn ? clean(item.titulo) : "";
    const comentario = clean(item.comentario || item.texto || "");
    return {
      type: "note",
      orden: sortValue(item.orden, 10000 + index),
      titulo,
      comentario,
      __row: item.__row
    };
  }).filter(note => note.titulo || note.comentario);

  const classList = Array.from(classes.values());
  classList.forEach(group => {
    group.rows.sort((a, b) => a.__row - b.__row);
  });

  const usedBlocks = new Set();
  classList.forEach(group => {
    group.rows.forEach(item => {
      if (!item.bloque) return;
      if (!item.actividad && !item.comentario && !item.link && !item.tarea) return;
      usedBlocks.add(slugify(item.bloque));
    });
  });

  const blocks = [];
  const seen = new Set();

  blockDefs.forEach(def => {
    if (!usedBlocks.has(def.slug)) return;
    seen.add(def.slug);
    blocks.push(def);
  });

  classList.forEach(group => {
    group.rows.forEach(item => {
      if (!item.bloque) return;
      if (!item.actividad && !item.comentario && !item.link && !item.tarea) return;
      const slug = slugify(item.bloque);
      if (!seen.has(slug)) {
        seen.add(slug);
        blocks.push({ label: item.bloque, slug, strong: "", soft: "" });
      }
    });
  });

  const items = [
    ...classList,
    ...notes
  ].sort((a, b) => {
    const diff = a.orden - b.orden;
    if (diff !== 0) return diff;
    return (a.__row || 0) - (b.__row || 0);
  });

  const datedClasses = classList.filter(g => g.date).sort((a, b) => a.date - b.date);
  const lastDate = datedClasses.length ? datedClasses[datedClasses.length - 1].date : null;
  const finished = lastDate ? todayLocal() >= addDays(lastDate, 1) : false;

  return { firstField, headerTitle, headerMeta, headerBrand, timeStart, timeEnd, items, groups: classList, blocks, finished };
}

function getNextClassItemIndex(items, finished) {
  if (finished) return -1;
  const today = todayLocal();
  return items.findIndex(item => (
    item.type === "class" &&
    item.date &&
    item.date >= today &&
    !["feriado", "suspendida"].includes(item.tipoClase)
  ));
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

  const subline = document.getElementById("header-subline");
  if (subline) subline.textContent = "";
  document.title = `Cronograma - ${data.firstField || data.headerTitle} - @ghisolfo.digital`;

  if (data.items.length === 0) {
    schedule.innerHTML = `<div class="status-card">No hay clases para mostrar.</div>`;
    return;
  }

  const nextIdx = getNextClassItemIndex(data.items, data.finished);
  schedule.style.setProperty("--block-count", Math.max(data.blocks.length, 1));

  schedule.innerHTML = `
    <div class="schedule-card">
      <div class="schedule-row schedule-head">
        <div class="hand-gutter cell-sticky cell-sticky-hand"></div>
        <div class="head-class cell-sticky cell-sticky-1">Clase</div>
        <div class="head-day cell-sticky cell-sticky-2">Día</div>
        <div class="head-date cell-sticky cell-sticky-3">Fecha</div>
        <div class="head-room cell-sticky cell-sticky-4">Aula</div>
        ${data.blocks.map((b, i) => `
          <div class="head-block block-${(i % 8) + 1}" data-block="${escapeHTML(b.slug)}" style="${blockStyle(b)}">${escapeHTML(b.label)}</div>
        `).join("")}
        <div class="head-comment">Comentarios</div>
      </div>
      <div class="schedule-body">
        ${data.items.map((item, index) => item.type === "note" ? renderNote(item, data.blocks) : renderGroup(item, index, nextIdx, data.blocks, data.finished)).join("")}
      </div>
    </div>
  `;
}

function renderBaseCells(group, isNext) {
  const day = group.date ? getDayName(group.date) : "";
  const classNo = formatClassNumber(group.clase);

  return `
    <div class="hand-gutter cell-sticky cell-sticky-hand">${isNext ? "👉" : ""}</div>
    <div class="class-no cell-sticky cell-sticky-1">${escapeHTML(classNo)}</div>
    <div class="class-day cell-sticky cell-sticky-2">${escapeHTML(day)}</div>
    <div class="class-date cell-sticky cell-sticky-3">${escapeHTML(formatDateShort(group.fecha))}</div>
    <div class="class-room cell-sticky cell-sticky-4">${escapeHTML(group.aula || "")}</div>
  `;
}

function renderComment(group) {
  const comment = escapeHTML(group.comentario || "");
  const chip = group.asistenciaObligatoria ? `<span class="required-chip">Asistencia obligatoria</span>` : "";
  return `${chip}${comment}`;
}

function renderGroup(group, index, nextIdx, blocks, finished) {
  const isPast = !finished && group.date && group.date < todayLocal();
  const isNext = index === nextIdx;
  const isSpecial = ["feriado", "suspendida"].includes(group.tipoClase);
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
        ${renderBaseCells(group, isNext)}
        <div class="special-cell special-sticky" style="grid-column: span ${Math.max(blocks.length + 1, 1)};">
          ${escapeHTML(group.comentario || typeLabel)}
        </div>
      </div>
    `;
  }

  return `
    <div class="${rowClasses}">
      ${renderBaseCells(group, isNext)}
      ${blocks.map((block, i) => renderBlockCell(group, block, i)).join("")}
      <div class="comment-cell">${renderComment(group)}</div>
    </div>
  `;
}

function renderNote(note, blocks) {
  const title = note.titulo ? `<strong>${escapeHTML(note.titulo)}</strong>` : "";
  const comment = note.comentario ? `<span>${escapeHTML(note.comentario)}</span>` : "";
  return `
    <div class="schedule-row note-row">
      <div class="hand-gutter cell-sticky cell-sticky-hand"></div>
      <div class="note-cell" style="grid-column: span ${Math.max(blocks.length + 5, 6)};">
        ${title}${comment}
      </div>
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
  const devolucion = isDevolucion(item.actividad || item.comentario);
  const classes = [
    "activity-cell",
    item.destacado ? "is-strong" : "is-soft",
    devolucion ? "is-devolucion" : ""
  ].filter(Boolean).join(" ");

  const label = escapeHTML(item.actividad || item.comentario || item.tarea || "-");
  const task = item.tarea ? `<span class="activity-task">${escapeHTML(item.tarea)}</span>` : "";
  const content = `<span class="activity-label">${label}</span>${task}`;

  if (item.link) {
    return `<a class="${classes}" href="${escapeHTML(item.link)}" target="_blank" rel="noopener noreferrer">${content}</a>`;
  }

  return `<span class="${classes}">${content}</span>`;
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
