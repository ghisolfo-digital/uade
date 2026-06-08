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

function rowValue(row, index) {
  return clean((row || [])[index]);
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

function normalizeHeaderName(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapRowByHeaders(row, headers) {
  const out = {};
  headers.forEach((name, index) => {
    const key = normalizeHeaderName(name);
    if (key) out[key] = rowValue(row, index);
  });
  return out;
}

function escapeHTML(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2brEscaped(value) {
  return escapeHTML(value).replace(/\n/g, "<br>");
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
  return date ? days[date.getDay()] : "";
}

function formatDateShort(value) {
  const v = clean(value);
  return v.replace(/\/\d{4}$/, "");
}

function formatClassNumber(value) {
  const v = clean(value);
  if (!v) return "";
  const n = Number(v);
  return Number.isFinite(n) && /^\d+$/.test(v) ? String(n).padStart(2, "0") : v;
}

function todayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function orderValue(value, fallback) {
  const v = clean(value).replace(",", ".");
  return v !== "" && !Number.isNaN(Number(v)) ? Number(v) : Number(fallback);
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
  if (/^(rgb|hsl)a?\(/i.test(v)) return v;
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

function capitalize(value) {
  const v = clean(value);
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "";
}

/* =========================
   DATA
   ========================= */

function makeBlockDef(row) {
  const label = rowValue(row, 1);
  if (!label) return null;
  const slug = slugify(label);
  const strong = normalizeColor(rowValue(row, 2));
  const soft = normalizeColor(rowValue(row, 3)) || (strong ? mixWithWhite(strong) : "");
  return { label, slug, strong, soft };
}

function readData(rows) {
  const pageHeader = rows[0] || [];

  let firstField = rowValue(pageHeader, 0);
  let headerTitle = rowValue(pageHeader, 1) || "Cronograma";
  let headerMeta = rowValue(pageHeader, 2);
  let headerBrand = rowValue(pageHeader, 3);
  let timeStart = rowValue(pageHeader, 4);
  let timeEnd = rowValue(pageHeader, 5);

  const blockDefs = new Map();
  const classes = new Map();
  const activities = [];
  const notes = [];
  const warnings = [];

  let headers = [];
  let inputIndex = 0;

  rows.forEach(row => {
    const kind = rowValue(row, 0).toLowerCase();
    if (!kind) return;

    if (kind === "tipo") {
      headers = row;
      return;
    }

    if (kind === "config") {
      firstField = rowValue(row, 1) || firstField;
      headerTitle = rowValue(row, 2) || headerTitle;
      headerMeta = rowValue(row, 3) || headerMeta;
      headerBrand = rowValue(row, 4) || headerBrand;
      timeStart = rowValue(row, 5) || timeStart;
      timeEnd = rowValue(row, 6) || timeEnd;
      return;
    }

    if (kind === "bloque") {
      const def = makeBlockDef(row);
      if (def) blockDefs.set(def.slug, def);
      return;
    }

    if (!["clase", "actividad", "nota"].includes(kind)) return;

    inputIndex++;
    const m = headers.length ? mapRowByHeaders(row, headers) : {};

    if (kind === "clase") {
      const headerHasOrden = Object.prototype.hasOwnProperty.call(m, "orden");
      const headerHasActivityFields = Object.prototype.hasOwnProperty.call(m, "bloque") || Object.prototype.hasOwnProperty.call(m, "actividad");
      const legacyCombinedRow = headerHasActivityFields && !headerHasOrden;

      if (legacyCombinedRow) {
        const clase = m.clase ?? rowValue(row, 1);
        const fecha = m.fecha ?? rowValue(row, 2);
        const aula = m.aula ?? rowValue(row, 3);
        const tipoClase = clean(m.tipo_clase ?? rowValue(row, 4)).toLowerCase() || "presencial";
        const bloque = m.bloque ?? rowValue(row, 5);
        const actividad = m.actividad ?? rowValue(row, 6);
        const link = m.link ?? rowValue(row, 7);
        const destacado = isTrue(m.destacado ?? rowValue(row, 8));
        const asistenciaObligatoria = isTrue(m.asistencia_obligatoria ?? rowValue(row, 9));
        const comentario = m.comentario ?? rowValue(row, 10);
        const tarea = m.tarea ?? rowValue(row, 11);

        if (!clase && !fecha) {
          const noteText = [bloque, actividad, comentario].filter(Boolean).join(" · ");
          if (noteText) {
            notes.push({
              type: "note",
              orden: "",
              sortOrder: orderValue("", inputIndex),
              inputIndex,
              titulo: "",
              comentario: noteText
            });
          }
          return;
        }

        const key = clase || `sin-clase-${inputIndex}`;
        if (!classes.has(key)) {
          classes.set(key, {
            type: "class",
            orden: "",
            sortOrder: orderValue(clase, inputIndex),
            inputIndex,
            clase,
            fecha,
            date: parseDateRelaxed(fecha),
            aula,
            tipoClase,
            asistenciaObligatoria,
            comentario,
            rows: []
          });
        }

        const group = classes.get(key);
        if (!group.fecha && fecha) {
          group.fecha = fecha;
          group.date = parseDateRelaxed(fecha);
        }
        if (!group.aula && aula) group.aula = aula;
        if (["feriado", "suspendida"].includes(tipoClase)) group.tipoClase = tipoClase;
        if (asistenciaObligatoria) group.asistenciaObligatoria = true;
        if ((!group.comentario || ["feriado", "suspendida"].includes(tipoClase)) && comentario) group.comentario = comentario;

        if (bloque && (actividad || link || tarea)) {
          group.rows.push({
            type: "activity",
            clase,
            bloque,
            actividad,
            link,
            destacado,
            comentario: "",
            tarea
          });
          activities.push(group.rows[group.rows.length - 1]);
        }
        return;
      }

      const clase = (m.clase ?? rowValue(row, 2)) || rowValue(row, 1);
      if (!clase) {
        warnings.push("Hay una clase sin identificador.");
        return;
      }
      if (classes.has(clase)) {
        warnings.push(`Hay más de una fila clase con el identificador ${clase}. Se usa la primera.`);
        return;
      }

      const orden = m.orden ?? rowValue(row, 1);
      const fecha = m.fecha ?? rowValue(row, 3);
      classes.set(clase, {
        type: "class",
        orden,
        sortOrder: orderValue(orden, inputIndex),
        inputIndex,
        clase,
        fecha,
        date: parseDateRelaxed(fecha),
        aula: m.aula ?? rowValue(row, 4),
        tipoClase: clean(m.tipo_clase ?? rowValue(row, 5)).toLowerCase() || "presencial",
        asistenciaObligatoria: isTrue(m.asistencia_obligatoria ?? rowValue(row, 6)),
        comentario: m.comentario ?? rowValue(row, 7),
        rows: []
      });
      return;
    }

    if (kind === "actividad") {
      activities.push({
        type: "activity",
        clase: m.clase ?? rowValue(row, 1),
        bloque: m.bloque ?? rowValue(row, 2),
        actividad: m.actividad ?? rowValue(row, 3),
        link: m.link ?? rowValue(row, 4),
        destacado: isTrue(m.destacado ?? rowValue(row, 5)),
        comentario: m.comentario ?? rowValue(row, 6),
        tarea: m.tarea ?? rowValue(row, 7)
      });
      return;
    }

    if (kind === "nota") {
      const orden = m.orden ?? rowValue(row, 1);
      notes.push({
        type: "note",
        orden,
        sortOrder: orderValue(orden, inputIndex),
        inputIndex,
        titulo: m.titulo ?? "",
        comentario: m.comentario ?? rowValue(row, 2)
      });
    }
  });

  activities.forEach(item => {
    const clase = clean(item.clase);
    if (!clase || !classes.has(clase)) {
      warnings.push(`Hay una actividad asociada a una clase inexistente: ${clase || "sin clase"}.`);
      return;
    }
    const group = classes.get(clase);
    if (!group.rows.includes(item)) group.rows.push(item);
  });

  const usedBlocks = new Set();
  activities.forEach(item => {
    const clase = clean(item.clase);
    if (!clase || !classes.has(clase)) return;
    if (!item.bloque) return;
    if (!item.actividad && !item.comentario && !item.link && !item.tarea) return;
    usedBlocks.add(slugify(item.bloque));
  });

  const blocks = [];
  const seen = new Set();

  blockDefs.forEach(def => {
    if (!usedBlocks.has(def.slug)) return;
    seen.add(def.slug);
    blocks.push(def);
  });

  activities.forEach(item => {
    const clase = clean(item.clase);
    if (!clase || !classes.has(clase)) return;
    if (!item.bloque) return;
    if (!item.actividad && !item.comentario && !item.link && !item.tarea) return;

    const slug = slugify(item.bloque);
    if (!seen.has(slug)) {
      seen.add(slug);
      blocks.push({ label: item.bloque, slug, strong: "", soft: "" });
    }
  });

  const groups = Array.from(classes.values());
  notes.forEach(note => {
    if (!note.titulo && !note.comentario) return;
    groups.push(note);
  });

  groups.sort((a, b) => {
    const ao = a.sortOrder ?? 0;
    const bo = b.sortOrder ?? 0;
    if (ao === bo) return (a.inputIndex ?? 0) - (b.inputIndex ?? 0);
    return ao - bo;
  });

  return { firstField, headerTitle, headerMeta, headerBrand, timeStart, timeEnd, groups, blocks, warnings };
}

function getNextClassIndex(groups) {
  const today = todayLocal();
  return groups.findIndex(g => {
    if ((g.type || "class") !== "class") return false;
    if (!g.date || g.date < today) return false;
    if (["feriado", "suspendida"].includes(g.tipoClase)) return false;
    return true;
  });
}

function scheduleIsFinished(groups) {
  const today = todayLocal();
  let lastDate = null;

  groups.forEach(g => {
    if ((g.type || "class") !== "class") return;
    if (!g.date) return;
    if (!lastDate || g.date > lastDate) lastDate = g.date;
  });

  return Boolean(lastDate && today > lastDate);
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

  if (data.groups.length === 0) {
    schedule.innerHTML = `<div class="status-card">No hay clases para mostrar.</div>`;
    return;
  }

  const nextIdx = getNextClassIndex(data.groups);
  const finished = scheduleIsFinished(data.groups);
  schedule.style.setProperty("--block-count", Math.max(data.blocks.length, 1));

  const warnings = Array.isArray(data.warnings) && data.warnings.length
    ? `<div class="status-card is-warning"><strong>Revisar CSV:</strong> ${escapeHTML([...new Set(data.warnings)].join(" "))}</div>`
    : "";

  schedule.innerHTML = `
    ${warnings}
    <div class="schedule-card">
      <div class="schedule-row schedule-head">
        <div class="hand-gutter cell-sticky cell-sticky-hand"></div>
        <div class="head-class cell-sticky cell-sticky-1">Clase</div>
        <div class="head-day cell-sticky cell-sticky-2">Día</div>
        <div class="head-date cell-sticky cell-sticky-3">Fecha</div>
        <div class="head-room cell-sticky cell-sticky-4">Aula</div>
        ${data.blocks.map((b, i) => `
          <div class="head-block block-${(i % 8) + 1}" data-block="${escapeHTML(b.slug)}" style="${escapeHTML(blockStyle(b))}">${escapeHTML(b.label)}</div>
        `).join("")}
        <div class="head-comment">Comentarios</div>
      </div>
      <div class="schedule-body">
        ${data.groups.map((group, index) => renderGroup(group, index, nextIdx, data.blocks, finished)).join("")}
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

function renderNote(note, blocks) {
  const span = Math.max(blocks.length + 1, 1);
  const title = clean(note.titulo);
  const comment = clean(note.comentario);
  let content = "";

  if (title) content += `<strong>${escapeHTML(title)}</strong>`;
  if (comment) content += `${content ? " " : ""}${nl2brEscaped(comment)}`;

  return `
    <div class="schedule-row schedule-note">
      <div class="hand-gutter cell-sticky cell-sticky-hand"></div>
      <div class="class-no cell-sticky cell-sticky-1"></div>
      <div class="class-day cell-sticky cell-sticky-2"></div>
      <div class="class-date cell-sticky cell-sticky-3"></div>
      <div class="class-room cell-sticky cell-sticky-4"></div>
      <div class="note-cell" style="grid-column: span ${span};">${content}</div>
    </div>
  `;
}

function renderGroup(group, index, nextIdx, blocks, scheduleFinished) {
  if ((group.type || "class") === "note") {
    return renderNote(group, blocks);
  }

  const isPast = !scheduleFinished && group.date && group.date < todayLocal();
  const isNext = index === nextIdx;
  const isSpecial = ["feriado", "suspendida"].includes(group.tipoClase);
  const typeLabel = group.tipoClase ? capitalize(group.tipoClase) : "Clase";

  const rowClasses = [
    "schedule-row",
    isPast ? "is-past" : "",
    isNext ? "is-next" : "",
    isSpecial ? `is-${group.tipoClase} is-special` : "",
    group.asistenciaObligatoria ? "has-required-attendance" : ""
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

  let comment = escapeHTML(group.comentario || "");
  if (group.asistenciaObligatoria) {
    comment = `<span class="required-chip">Asistencia obligatoria</span>${comment}`;
  }

  return `
    <div class="${rowClasses}">
      ${renderBaseCells(group, isNext)}
      ${blocks.map((block, i) => renderBlockCell(group, block, i)).join("")}
      <div class="comment-cell">${comment}</div>
    </div>
  `;
}

function renderBlockCell(group, block, blockIndex) {
  const items = (group.rows || []).filter(item => slugify(item.bloque) === block.slug);
  const colorClass = `block-${(blockIndex % 8) + 1}`;
  const style = blockStyle(block);

  if (items.length === 0) return `<div class="block-cell empty-cell ${colorClass}" style="${escapeHTML(style)}" aria-hidden="true"></div>`;

  return `
    <div class="block-cell ${colorClass}" style="${escapeHTML(style)}">
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

  const label = escapeHTML(item.actividad || item.comentario || "-");
  const task = escapeHTML(item.tarea || "");
  let inner = `<span class="activity-label">${label}</span>`;
  if (task) inner += `<span class="activity-task">${task}</span>`;

  if (item.link) {
    return `<a class="${classes}" href="${escapeHTML(item.link)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
  }

  return `<span class="${classes}">${inner}</span>`;
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
