const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQb2Ggbd5Y1VOwTbAI7CjvaHNDwyYs5Y5IuJQCtR2G1eF7pN_bECM4_EQKMPvmwUredXZ2vMmZ43uiu/pub?gid=331164853&single=true&output=csv';
const CSV_REFRESH_MS = 120000;
const CSV_REFRESH_JITTER_MS = 30000;
const CSV_REFRESH_OFFDAY_MS = 1800000;
const CSV_REFRESH_OFFDAY_JITTER_MS = 300000;
const CSV_FIRST_LIVE_JITTER_MS = 25000;
const LOCAL_CACHE_KEY = 'testeosUX_csv_cache_v2_fechas';

const app = {
  config: {},
  settings: {},
  teams: new Map(),
  agenda: [],
  texts: [],
  links: {},
  aulas: new Map(),
  selectedTeam: null,
  allBlocks: [],
  aulaOrder: [],
  dateOpenState: {},
  myDateOpenState: {}
};

    init();

async function init() {
  const params = new URLSearchParams(window.location.search);
  app.selectedTeam = params.get('e') || '';

  try {
    const initialCsv = await loadInitialCsv();
applyCsvText(initialCsv);
renderAll();

setupHeaderMenu();
setupQrLightbox();
setupSectionSpy();
setupBackToTopButton();

setInterval(renderAll, 30000);

    setTimeout(() => {
      refreshDataFromCsv();
      scheduleCsvRefresh();
    }, randomBetween(3000, CSV_FIRST_LIVE_JITTER_MS));

  } catch (err) {
    document.querySelector('main').innerHTML = `
      <section class="notice">
        No se pudo cargar el CSV de Google Sheets. Revisá que el CSV esté publicado correctamente.
      </section>
    `;
    console.error(err);
  }
}


async function loadInitialCsv() {
  const cached = getCachedCsv();

  if (cached) {
    return cached;
  }

  return await fetchCsv();
}

function applyCsvText(csvText) {
  resetData();
  const rows = parseCSV(csvText);
  parseData(rows);
}

function resetData() {
  app.config = {};
  app.settings = {};
  app.teams = new Map();
  app.agenda = [];
  app.texts = [];
  app.links = {};
  app.aulas = new Map();
  app.allBlocks = [];
  app.aulaOrder = [];
  app.dateOpenState = {};
  app.myDateOpenState = {};
}

async function refreshDataFromCsv() {
  try {
    const csvText = await fetchCsv();
    saveCachedCsv(csvText);
    applyCsvText(csvText);
    renderAll();
  } catch (err) {
    console.warn('No se pudo actualizar desde Google Sheets. Se mantiene la data actual.', err);
  }
}

function scheduleCsvRefresh() {
  const delay = getCsvRefreshDelay();

  setTimeout(async () => {
    await refreshDataFromCsv();
    scheduleCsvRefresh();
  }, delay);
}

function getCsvRefreshDelay() {
  if (isAnyAgendaDateToday()) {
    return CSV_REFRESH_MS + randomBetween(0, CSV_REFRESH_JITTER_MS);
  }

  return CSV_REFRESH_OFFDAY_MS + randomBetween(0, CSV_REFRESH_OFFDAY_JITTER_MS);
}

function saveCachedCsv(csvText) {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      csvText
    }));
  } catch (err) {
    console.warn('No se pudo guardar caché local', err);
  }
}

function getCachedCsv() {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data.csvText) return null;

    return data.csvText;
  } catch (err) {
    return null;
  }
}

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}
    async function fetchCsv() {
      const url = CSV_URL + (CSV_URL.includes('?') ? '&' : '?') + 'cache=' + Date.now();
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error cargando CSV');
      return await res.text();
    }

    function parseData(rows) {
  rows.shift();

  rows.forEach(row => {
    const tipo = cell(row, 0).trim().toLowerCase();
    const fila = cell(row, 1).trim().toLowerCase();

    if (fila !== 'data') return;

    const a = cell(row, 2);
    const b = cell(row, 3);
    const c = cell(row, 4);
    const d = cell(row, 5);
    const e = cell(row, 6);

    if (tipo === 'config') {
      app.config[a] = b;
    }

    if (tipo === 'seteos') {
      app.settings[a] = b;
    }

    if (tipo === 'equipos') {
      app.teams.set(a, {
        id: a,
        nombre: b,
        tematica: c
      });
    }

    if (tipo === 'aulas') {
  app.aulas.set(a, {
    id_aula: a,
    nro_aula: b,
    nombre_aula: c,
    ubicacion: d,
    comentario: e
  });
}
    if (tipo === 'agenda') {
      const fecha = a;
      const fechaObj = parseDateValue(fecha);
      const fechaKey = fechaObj ? dateKey(fechaObj) : '';
      const horaInicio = b;
      const horaCierre = c;
      const aula = d;
      const testea = e;

      const feedbacks = row
        .slice(7)
        .map(value => String(value || '').trim())
        .filter(value => value !== '');

      if (aula && !app.aulaOrder.includes(aula)) {
        app.aulaOrder.push(aula);
      }

      app.agenda.push({
        fecha,
        fechaKey,
        horaInicio,
        horaCierre,
        aula,
        testea,
        feedbacks
      });
    }

    if (tipo === 'texto') {
      app.texts.push({
        orden: Number(a) || 999,
        texto: b,
        visible: isTrue(c)
      });
    }

    if (tipo === 'links') {
      app.links[a] = {
        label: b,
        url: c,
        url_qr: d,
        forzar_url_qr: e
      };
    }
  });

  inferMissingEndTimes();

  app.agenda.sort((x, y) => {
    const byDate = String(x.fechaKey).localeCompare(String(y.fechaKey));
    if (byDate !== 0) return byDate;

    const byTime = timeToMin(x.horaInicio) - timeToMin(y.horaInicio);
    if (byTime !== 0) return byTime;

    return app.aulaOrder.indexOf(x.aula) - app.aulaOrder.indexOf(y.aula);
  });

  app.texts.sort((x, y) => x.orden - y.orden);
  app.allBlocks = uniqueBlocks(app.agenda);
}

function renderAll() {
  renderHeader();
  renderFavicons();
  renderSelector();
  renderLinks();
  renderGrillaMenuLinks();
  renderSelectedTeamBar();
  renderMyTeamTitle();
  renderClockTitle();
  renderCurrentStatus();
  renderTables();
  renderMySection();
  renderTexts();
  renderFooter();
}

function renderMyTeamTitle() {
  const title = document.getElementById('my-team-title');
  if (!title) return;

  if (!app.selectedTeam) {
    title.textContent = 'Mi equipo';
    return;
  }

  title.textContent = `Mi equipo 🧩 ${teamNumber(app.selectedTeam)} · ${teamName(app.selectedTeam)}`;
}

function renderClockTitle() {
  const el = document.getElementById('current-clock-title');
  if (el) el.textContent = currentClockLabel();
}
function getAppTitle() {
  return app.config.titulo || 'Testeos UX';
}

function renderHeader() {
  document.title = buildDocumentTitle();

  document.getElementById('site-title').textContent = getAppTitle();

  const meta = document.querySelector('.site-header .meta');
  if (meta) {
    meta.innerHTML = buildHeaderMetaHTML();
  }

  const intro = document.getElementById('site-subtitle');
  if (intro) {
    intro.textContent = buildIntroText();
  }
}

function renderFavicons() {
  const rawPath = String(app.config.ruta_favicon || '').trim();

  removeDynamicFavicons();

  if (!rawPath) return;

  const basePath = rawPath.endsWith('/') ? rawPath : rawPath + '/';

  document.head.insertAdjacentHTML('beforeend', `
    <link data-dynamic-favicon rel="icon" href="${escapeHTML(basePath)}favicon.svg" type="image/svg+xml">
    <link data-dynamic-favicon rel="icon" href="${escapeHTML(basePath)}favicon.png" type="image/png">
    <link data-dynamic-favicon rel="shortcut icon" href="${escapeHTML(basePath)}favicon.ico">
  `);
}

function removeDynamicFavicons() {
  document.querySelectorAll('link[data-dynamic-favicon]').forEach(el => el.remove());
}


function buildIntroText() {
  const text = String(app.config.txt_intro || '').trim();
  if (!text) return '';

  if (feedbackExists() && !feedbackActivityVisible()) {
    const updated = text
      .replace(/,?\s*y\s+cu[aá]ndo\s+le\s+ten[eé]s\s+que\s+dar\s+feedback\s+a\s+otros\s+equipos\.?/i, '. En breve vas a saber cuándo le tenés que dar feedback a otros equipos.');

    if (updated !== text) return updated;
  }

  return text;
}

function buildDocumentTitle() {
  const titulo = getAppTitle();
  const materia = app.config.materia || '';
  const fecha = buildAgendaDateSummary({ capitalizeFirstWord: false });

  return [titulo, materia, fecha, '@ghisolfo.digital']
    .filter(Boolean)
    .join(' - ');
}

function buildHeaderMetaText() {
  const parts = buildHeaderMetaParts();
  return parts.join(' · ');
}

function buildHeaderMetaHTML() {
  const parts = buildHeaderMetaParts();
  if (!parts.length) return '';

  return parts.map((part, index) => `
    ${index > 0 ? '<span class="meta-separator">·</span>' : ''}
    <span class="meta-part">${escapeHTML(part)}</span>
  `).join('');
}

function buildHeaderMetaParts() {
  const universidad = app.config.universidad || '';
  const materia = app.config.materia || '';
  const turno = app.config.turno || '';
  const fecha = buildAgendaDateSummary({ capitalizeFirstWord: true });

  if (materia || fecha) {
    return [materia, fecha].filter(Boolean);
  }

  return [universidad, turno].filter(Boolean);
}

function buildAgendaDateSummary(options = {}) {
  const dates = agendaDates();
  if (!dates.length) return '';

  const upcoming = nextActiveOrFutureAgendaDate();
  if (upcoming) {
    return formatDateWithWeekday(upcoming.date, {
      capitalizeFirstWord: options.capitalizeFirstWord !== false
    });
  }

  if (dates.length === 1) {
    return formatDateWithWeekday(dates[0].date, {
      capitalizeFirstWord: options.capitalizeFirstWord !== false
    });
  }

  if (dates.length === 2) {
    return formatTwoDates(dates[0].date, dates[1].date, {
      capitalizeFirstWord: options.capitalizeFirstWord !== false
    });
  }

  return formatMonthRange(dates.map(item => item.date), {
    capitalizeFirstWord: options.capitalizeFirstWord !== false
  });
}

function parseDateValue(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(key) {
  const match = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return date;
}

function agendaDates() {
  const map = new Map();

  app.agenda.forEach(row => {
    if (!row.fechaKey) return;
    if (!map.has(row.fechaKey)) {
      map.set(row.fechaKey, {
        key: row.fechaKey,
        date: dateFromKey(row.fechaKey),
        label: row.fecha
      });
    }
  });

  return Array.from(map.values())
    .filter(item => item.date)
    .sort((a, b) => a.date - b.date);
}

function nextActiveOrFutureAgendaDate() {
  const now = currentDateTime();

  return agendaDates().find(item => {
    const last = getLastBlockDateTime(item.key);
    return last && last >= now;
  }) || null;
}

function isAnyAgendaDateToday() {
  return agendaDates().some(item => isDateToday(item.date));
}

function isDateToday(date) {
  if (!date) return false;
  const today = currentDateTime();

  return (
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate()
  );
}

function currentDateKey() {
  return dateKey(currentDateTime());
}

function currentDateTime() {
  const realNow = new Date();
  const dateOverride = simulatedDateValue(realNow);
  const timeOverride = simulatedTimeValue();

  const d = dateOverride || new Date(realNow.getFullYear(), realNow.getMonth(), realNow.getDate());

  if (timeOverride) {
    d.setHours(timeOverride.hours, timeOverride.minutes, 0, 0);
  } else {
    d.setHours(realNow.getHours(), realNow.getMinutes(), realNow.getSeconds(), realNow.getMilliseconds());
  }

  return d;
}

function isSimulatingDate() {
  return Boolean(new URLSearchParams(window.location.search).get('f'));
}

function isSimulatingTime() {
  return Boolean(new URLSearchParams(window.location.search).get('h'));
}

function simulatedDateValue(referenceDate = new Date()) {
  const raw = new URLSearchParams(window.location.search).get('f');
  if (!raw) return null;

  const compact = String(raw).replace(/\D/g, '');
  const match = compact.match(/^(\d{2})(\d{2})(\d{4})?$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3] ? Number(match[3]) : referenceDate.getFullYear();
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function simulatedTimeValue() {
  const raw = new URLSearchParams(window.location.search).get('h');
  if (!raw) return null;

  const compact = String(raw).replace(/\D/g, '');
  const match = compact.match(/^(\d{2})(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return { hours, minutes };
}

function formatDateForChip(date) {
  return isDateTodayReal(date) ? `hoy ${formatDateWithWeekday(date, { capitalizeFirstWord: false })}` : formatDateWithWeekday(date, { capitalizeFirstWord: false });
}

function isDateTodayReal(date) {
  if (!date) return false;
  const today = new Date();
  return today.getFullYear() === date.getFullYear() && today.getMonth() === date.getMonth() && today.getDate() === date.getDate();
}

function formatDateWithWeekday(dateOrValue, options = {}) {
  const date = dateOrValue instanceof Date ? dateOrValue : parseDateValue(dateOrValue);
  if (!date) return String(dateOrValue || '').trim();

  const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const text = `${weekdays[date.getDay()]} ${formatDateNumeric(date)}`;

  return options.capitalizeFirstWord ? capitalizeFirst(text) : text;
}

function formatTwoDates(firstDate, secondDate, options = {}) {
  const sameWeekday = firstDate.getDay() === secondDate.getDay();
  const first = formatDateWithWeekday(firstDate, {
    capitalizeFirstWord: options.capitalizeFirstWord
  });

  const second = sameWeekday
    ? formatDateNumeric(secondDate)
    : formatDateWithWeekday(secondDate, { capitalizeFirstWord: false });

  return `${first} y ${second}`;
}

function formatDateNumeric(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatShortDate(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthRange(dates, options = {}) {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const sorted = dates.slice().sort((a, b) => a - b);
  const uniqueMonthKeys = [];

  sorted.forEach(date => {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!uniqueMonthKeys.includes(key)) uniqueMonthKeys.push(key);
  });

  const monthItems = uniqueMonthKeys.map(key => {
    const [year, month] = key.split('-').map(Number);
    return { year, month, name: months[month] };
  });

  let text = '';

  if (monthItems.length === 1) {
    const item = monthItems[0];
    text = `${item.name} ${item.year}`;
  } else if (monthItems.length === 2 && monthItems[0].year === monthItems[1].year) {
    text = `${monthItems[0].name} y ${monthItems[1].name} ${monthItems[0].year}`;
  } else {
    const first = monthItems[0];
    const last = monthItems[monthItems.length - 1];
    const sameYear = first.year === last.year;
    text = sameYear
      ? `${first.name} a ${last.name} ${first.year}`
      : `${first.name} ${first.year} a ${last.name} ${last.year}`;
  }

  return options.capitalizeFirstWord ? capitalizeFirst(text) : text;
}

function capitalizeFirst(text) {
  const raw = String(text || '');
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
}

function getFirstBlockDateTime(fechaKey = null) {
  const blocks = fechaKey
    ? app.allBlocks.filter(block => block.fechaKey === fechaKey)
    : app.allBlocks;

  if (!blocks.length) return null;
  return blockDateTime(blocks[0], 'inicio');
}

function getLastBlockDateTime(fechaKey = null) {
  const blocks = fechaKey
    ? app.allBlocks.filter(block => block.fechaKey === fechaKey)
    : app.allBlocks;

  if (!blocks.length) return null;
  return blockDateTime(blocks[blocks.length - 1], 'cierre');
}

function getNextGlobalBlockDateTime() {
  const now = currentDateTime();
  const upcoming = app.allBlocks
    .map(block => blockDateTime(block, 'inicio'))
    .filter(date => date && date > now)
    .sort((a, b) => a - b)[0];

  return upcoming || null;
}

function blockDateTime(block, point = 'inicio') {
  const date = dateFromKey(block.fechaKey);
  if (!date) return null;

  const minutes = timeToMin(point === 'cierre' ? block.horaCierre : block.horaInicio);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function rowDateTime(row, point = 'inicio') {
  return blockDateTime(row, point);
}

function formatTimeUntil(targetDate) {
  const now = currentDateTime();
  const diffMs = targetDate - now;

  if (diffMs <= 0) return '';

  const totalMinutes = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const calendarDays = Math.round((targetStart - todayStart) / (1000 * 60 * 60 * 24));

  if (calendarDays > 1) return `Faltan ${calendarDays} días para el primer bloque.`;
  if (calendarDays === 1) return `Falta 1 día para el primer bloque.`;
  if (hours > 1) return `Faltan ${hours} horas para el primer bloque.`;
  if (hours === 1) return `Falta 1 hora para el primer bloque.`;

  return `Falta menos de 1 hora para el primer bloque.`;
}

function testDateStatus() {
  const firstBlockDateTime = getFirstBlockDateTime();
  const lastBlockDateTime = getLastBlockDateTime();

  if (!firstBlockDateTime || !lastBlockDateTime) return 'unknown';

  const now = currentDateTime();
  if (now < firstBlockDateTime) return 'future';
  if (now > lastBlockDateTime) return 'past';
  return 'active-day';
}

function isTestDateToday() {
  return isAnyAgendaDateToday();
}

function formatTodayWithWeekdayAndTime() {
  const d = currentDateTime();
  return `${formatDateWithWeekday(d, { capitalizeFirstWord: true })}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderSelectedTeamBar() {
  const bar = document.getElementById('selected-team-bar');
  if (!bar) return;

  const inner = bar.querySelector('.selected-team-inner');
  if (!inner) return;

  const simDate = simulatedDateValue();
  const simTime = simulatedTimeValue();
  const hasSimulation = Boolean(isSimulatingDate() || isSimulatingTime());

  if (!app.selectedTeam && !hasSimulation) {
    bar.hidden = true;
    return;
  }

  bar.hidden = false;

  const current = currentDateTime();
  const dateText = isSimulatingDate()
    ? formatDateForChip(simDate || current)
    : `hoy ${formatDateWithWeekday(current, { capitalizeFirstWord: false })}`;
  const timeText = isSimulatingTime()
    ? `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')} hs.`
    : `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')} hs.`;

  inner.innerHTML = `
    ${app.selectedTeam ? `
      <span class="selected-context-group selected-context-team">
        <span class="selected-team-prefix">Estás viendo:</span>
        <button id="clear-team-button" class="selected-team-pill" type="button" aria-label="Ver todos los equipos">
          <span id="selected-team-text">${escapeHTML(teamNumber(app.selectedTeam))} · ${escapeHTML(teamName(app.selectedTeam))}</span>
          <i class="ti ti-x"></i>
        </button>
      </span>
    ` : ''}

    ${hasSimulation ? `
      ${app.selectedTeam ? `<span class="selected-team-separator">·</span>` : ''}
      <span class="selected-context-group selected-context-simulation">
        <span class="simulation-prefix"><span class="simulation-icon" aria-hidden="true">💡</span><span class="simulation-text">Simulando:</span></span>
        ${isSimulatingDate() ? `
          <button id="clear-sim-date-button" class="selected-team-pill simulation-pill" type="button" aria-label="Quitar fecha simulada">
            <span>${escapeHTML(dateText)}</span>
            <i class="ti ti-x"></i>
          </button>
        ` : `<span class="simulation-plain">${escapeHTML(dateText)}</span>`}
        ${isSimulatingTime() ? `
          <button id="clear-sim-time-button" class="selected-team-pill simulation-pill" type="button" aria-label="Quitar hora simulada">
            <span>${escapeHTML(timeText)}</span>
            <i class="ti ti-x"></i>
          </button>
        ` : `<span class="simulation-plain">${escapeHTML(timeText)}</span>`}
      </span>
    ` : ''}
  `;

  const clearTeamButton = document.getElementById('clear-team-button');
  if (clearTeamButton) {
    clearTeamButton.onclick = () => {
      app.selectedTeam = '';
      const select = document.getElementById('team-select');
      if (select) select.value = '';
      removeUrlParam('e');
      renderAll();
    };
  }

  const clearSimDateButton = document.getElementById('clear-sim-date-button');
  if (clearSimDateButton) {
    clearSimDateButton.onclick = () => {
      removeUrlParam('f');
      renderAll();
    };
  }

  const clearSimTimeButton = document.getElementById('clear-sim-time-button');
  if (clearSimTimeButton) {
    clearSimTimeButton.onclick = () => {
      removeUrlParam('h');
      renderAll();
    };
  }
}

function removeUrlParam(param) {
  const url = new URL(window.location.href);
  url.searchParams.delete(param);
  history.pushState({}, '', url);
}

    function renderSelector() {
      const select = document.getElementById('team-select');

      if (select.options.length <= 1) {
        for (const [id, data] of app.teams.entries()) {
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = `${teamNumber(id)} · ${data.nombre}`;
          select.appendChild(opt);
        }
      }

      select.value = app.selectedTeam || '';

      select.onchange = () => {
        app.selectedTeam = select.value;
        const url = new URL(window.location.href);

        if (app.selectedTeam) {
          url.searchParams.set('e', app.selectedTeam);
        } else {
          url.searchParams.delete('e');
        }

        history.pushState({}, '', url);
        renderAll();
      };

      window.onpopstate = () => {
        const params = new URLSearchParams(window.location.search);
        app.selectedTeam = params.get('e') || '';
        renderAll();
      };
    }

function renderLinks() {
  renderHeaderFeedbackLink();
  renderHeaderMenuContent();
  updateQrData();
  setupShareButton();
}

function renderHeaderFeedbackLink() {
  const actions = document.querySelector('.header-actions');
  const menuButton = document.getElementById('menu-button');
  const oldLink = document.getElementById('header-feedback-link');

  if (oldLink) oldLink.remove();
  if (!actions || !menuButton || !feedbackFormVisible()) return;

  const link = document.createElement('a');
  link.className = 'header-feedback-btn';
  link.id = 'header-feedback-link';
  link.href = '#';
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Form de feedback';

  actions.insertBefore(link, menuButton);
  setLink('header-feedback-link', app.links.feedback, 'Form de feedback');
}

function renderHeaderMenuContent() {
  const menu = document.getElementById('header-menu');
  if (!menu) return;

  menu.innerHTML = `
    <a class="menu-link" href="#estado-actual" data-section-link="estado-actual">
      Qué está pasando ahora
    </a>

    <a class="menu-link" href="#mi-equipo" data-section-link="mi-equipo">
      Mi equipo
    </a>

    <div id="grilla-menu-links">
      <a class="menu-link" href="#grilla-general" data-section-link="grilla-general">
        Grilla general
      </a>
    </div>

    ${aclaracionesVisible() ? `
      <a class="menu-link" href="#aclaraciones" data-section-link="aclaraciones">
        Aclaraciones
      </a>
    ` : ''}

    <div class="menu-actions">
      <div class="menu-separator"></div>

      <button class="menu-link menu-link-button" id="share-button" type="button">
        <i class="ti ti-share-3"></i>
        Compartir esta app
      </button>

      ${feedbackFormVisible() ? `
        <a class="menu-feedback-btn" id="feedback-link" href="#" target="_blank" rel="noopener">
          Form de feedback
        </a>
      ` : ''}

      ${cuestionarioFormVisible() ? `
        <button class="menu-link menu-link-button" id="qr-button" type="button">
          <i class="ti ti-qrcode"></i>
          Ver código QR para usuarios
        </button>
      ` : ''}
    </div>
  `;

  if (feedbackFormVisible()) {
    setLink('feedback-link', app.links.feedback, 'Form de feedback');
  }
}

function setupShareButton() {
  const shareButton = document.getElementById('share-button');
  if (!shareButton) return;

  shareButton.onclick = async () => {
    const url = new URL(window.location.origin + window.location.pathname);
    const title = getAppTitle();

    try {
      if (navigator.share) {
        await navigator.share({ title, url: url.toString() });
      } else {
        await navigator.clipboard.writeText(url.toString());
        alert('Link copiado');
      }
    } catch (err) {
      console.warn(err);
    }
  };
}

function renderGrillaMenuLinks() {
  const container = document.getElementById('grilla-menu-links');
  if (!container) return;

  const dates = agendaDates();

  if (!dates.length) {
    container.innerHTML = `
      <a class="menu-link" href="#grilla-general" data-section-link="grilla-general">
        Grilla general
      </a>
    `;
    return;
  }

  container.innerHTML = dates.map(dateInfo => `
    <a class="menu-link" href="#grilla-${escapeHTML(dateInfo.key)}" data-section-link="grilla-${escapeHTML(dateInfo.key)}">
      Grilla general · ${escapeHTML(formatDateWithWeekday(dateInfo.date, { capitalizeFirstWord: true }))}
    </a>
  `).join('');
}

function setElementVisible(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  el.style.display = visible ? '' : 'none';
  el.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function disableLink(el) {
  if (!el) return;
  el.href = '#';
  el.style.opacity = '.45';
  el.style.pointerEvents = 'none';
}

function setLink(id, data, fallbackLabel) {
  const el = document.getElementById(id);
  if (!el) return;

  const fixedLabels = {
    'feedback-link': 'Form de feedback',
    'header-feedback-link': 'Form de feedback'
  };

  el.textContent = fixedLabels[id] || data?.label || fallbackLabel;

  if (data?.url) {
    el.href = data.url;
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
  } else {
    el.href = '#';
    el.style.opacity = '.45';
    el.style.pointerEvents = 'none';
  }
}

function renderCurrentStatus() {
  const box = document.getElementById('current-status');
  const nowRows = currentRows();
  const showFeedbackAssignments = feedbackAssignmentsVisible();

  if (!nowRows.length) {
    box.innerHTML = `
      <div class="card">
<div class="eyebrow">Ahora</div>
        <div class="big">No hay actividad ahora</div>
      <div class="sub">De acuerdo a los horarios previstos, en este momento no hay equipos realizando testeos.</div>
      </div>
    `;
    return;
  }

  box.innerHTML = nowRows.map(row => {
    const selectedIsHere = teamInRow(app.selectedTeam, row);
    const feedbackHTML = showFeedbackAssignments && row.feedbacks.length
      ? `
        <div class="sub">Deberían estar dando feedback:</div>

        <div class="feedback-list">
          ${row.feedbacks.map(id => `
            <span class="pill ${isSelectedTeam(id) ? 'selected' : ''}">
              <span class="feedback-pill-row">
                <span class="feedback-emoji" aria-hidden="true">👈</span>
                <span>${teamLabel(id, false)}</span>
              </span>
            </span>
          `).join('')}
        </div>
      `
      : '';

    return `
      <div class="card status-card ${selectedIsHere ? 'current-for-team' : ''}">
<div class="eyebrow status-eyebrow">
  <span><span class="aula-code">${escapeHTML(aulaLabel(row.aula))}</span> · ${blockLabelHTML(row)}</span>
  <span class="live-badge status-live-badge" aria-label="Bloque en vivo"><span class="live-badge-dot">🔴</span><span class="live-badge-text">Ahora</span></span>
</div>

        <div class="now-testing-line team-label-large ${isSelectedTeam(row.testea) ? 'is-selected-inline' : ''}">
          <span aria-hidden="true">📱</span>
          <span class="now-testing-label">Está testeando</span>
          <span class="now-testing-team">${teamLabel(row.testea, true)}</span>
        </div>
        ${feedbackHTML}
      </div>
    `;
  }).join('');
}
function renderTables() {
  const box = document.getElementById('tables');
  if (!box) return;

  const dates = agendaDates();

  if (!dates.length) {
    box.innerHTML = `
      <h2 class="section-band"><span class="section-band-content">Grilla general</span></h2>
      <div class="tables"></div>
    `;
    return;
  }

  box.innerHTML = dates.map(dateInfo => renderDateGridGroup(dateInfo, dates.length > 1)).join('');

  box.querySelectorAll('[data-toggle-date]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-toggle-date');
      app.dateOpenState[key] = !isDateGridOpen(key);
      renderTables();
    });
  });
}

function renderDateGridGroup(dateInfo, hasMultipleDates) {
  ensureDateOpenState(dateInfo.key);

  const open = isDateGridOpen(dateInfo.key);
  const title = `Grilla general · ${formatDateWithWeekday(dateInfo.date, { capitalizeFirstWord: true })}`;

  const rowsByAula = app.aulaOrder.length
    ? app.aulaOrder
    : [...new Set(app.agenda.map(x => x.aula).filter(Boolean))];

  const content = rowsByAula.map(aula => {
    const rows = app.agenda.filter(item => item.fechaKey === dateInfo.key && item.aula === aula);
    if (!rows.length) return '';

    const dataAula = aulaData(aula);

    return `
      <div class="card">
        <h3 class="aula-title-bar">
          <span><span class="aula-code">${escapeHTML(aulaLabel(aula))}</span></span>
          ${dataAula.comentario ? `<span class="aula-comment">${escapeHTML(dataAula.comentario)}</span>` : ''}
        </h3>
        <div class="schedule-list">
          ${rows.map(row => renderScheduleBlock(row)).join('')}
        </div>
      </div>
    `;
  }).join('');

  const titleContent = `
    <button class="date-grid-toggle" type="button" data-toggle-date="${escapeHTML(dateInfo.key)}" aria-expanded="${open ? 'true' : 'false'}">
      <span class="section-band-content date-grid-toggle-inner">
        <span class="date-grid-toggle-text">${escapeHTML(title)}</span>
        <span class="date-grid-toggle-icon" aria-hidden="true">${open ? '▴' : '▾'}</span>
      </span>
    </button>
  `;

  return `
    <div class="date-grid-group ${open ? 'is-open' : 'is-collapsed'}" id="grilla-${escapeHTML(dateInfo.key)}">
      <h2 class="section-band date-grid-title">${titleContent}</h2>
      <div class="tables date-grid-content" ${open ? '' : 'hidden'}>
        ${content}
      </div>
    </div>
  `;
}

function ensureDateOpenState(key) {
  if (Object.prototype.hasOwnProperty.call(app.dateOpenState, key)) return;
  app.dateOpenState[key] = shouldDateGridStartOpen(key);
}

function isDateGridOpen(key) {
  ensureDateOpenState(key);
  return app.dateOpenState[key] !== false;
}

function shouldDateGridStartOpen(key) {
  const lastGlobalBlock = getLastBlockDateTime();
  if (lastGlobalBlock && new Date() > lastGlobalBlock) return true;

  const activeOrNext = nextActiveOrFutureAgendaDate();
  if (activeOrNext) return activeOrNext.key === key;

  return agendaDates()[0]?.key === key;
}

function renderScheduleBlock(row) {
  const isNow = isRowNow(row);
  const isPast = isRowPast(row);
  const feedbackHTML = feedbackAssignmentsVisible() && row.feedbacks.length
    ? `
        <div class="feedback-compact-list">
          ${row.feedbacks.map(id => `
            <div class="feedback-row ${isSelectedTeam(id) ? 'is-selected-inline' : ''}">
              <span class="row-emoji" aria-hidden="true">👈</span>
              <span class="role-label">Da feedback</span>
              <span>${teamLabel(id, false)}</span>
            </div>
          `).join('')}
        </div>
      `
    : '';

  return `
    <div class="schedule-block ${isNow ? 'is-now' : ''} ${isPast ? 'is-past' : ''}">
      <div class="block-title">
        <div class="block-title-main">
          <span class="block-title-label">Bloque</span>
          <span aria-hidden="true">🕒</span>
          <span class="block-title-time">${blockLabelHTML(row)}</span>
        </div>
        ${isNow ? `<span class="live-badge" aria-label="Bloque en vivo"><span class="live-badge-dot">🔴</span><span class="live-badge-text">Ahora</span></span>` : ''}
        ${isPast ? `<span class="done-check" aria-label="Bloque realizado">✓</span>` : ''}
      </div>

      <div class="block-body">
        <div class="test-row ${isSelectedTeam(row.testea) ? 'is-selected-inline' : ''}">
          <div class="test-main">
            <span class="row-emoji" aria-hidden="true">📱</span>
            <span class="role-label">Testea</span>
            <span class="test-team">${escapeHTML(teamNumberAndName(row.testea))}</span>
          </div>
          ${teamTopic(row.testea) ? `<div class="test-topic">${escapeHTML(teamTopic(row.testea))}</div>` : ''}
        </div>

        ${feedbackHTML}
      </div>
    </div>
  `;
}

function renderMySection() {
  const section = document.getElementById('my-section');

  if (!section) return;

  if (!app.selectedTeam) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  const actions = myActions(app.selectedTeam);
  const nowAction = currentActionForTeam(app.selectedTeam);
  const nextAction = nextActionForTeam(app.selectedTeam);

  document.getElementById('my-now').innerHTML = renderMyNow(nowAction, nextAction, actions);

  const agendaBox = document.getElementById('my-agenda');
  agendaBox.innerHTML = renderMyAgenda(actions);
  agendaBox.querySelectorAll('[data-toggle-my-date]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-toggle-my-date');
      app.myDateOpenState[key] = !isMyDateOpen(key);
      agendaBox.innerHTML = renderMyAgenda(actions);
      agendaBox.querySelectorAll('[data-toggle-my-date]').forEach(nextButton => {
        nextButton.addEventListener('click', () => {
          const nextKey = nextButton.getAttribute('data-toggle-my-date');
          app.myDateOpenState[nextKey] = !isMyDateOpen(nextKey);
          renderMySection();
        });
      });
    });
  });
}

function renderMyNow(nowAction, nextAction, actions = []) {
  const myTeam = teamLabel(app.selectedTeam, false);

  if (nowAction) {
    const isFeedback = nowAction.rol === 'Das feedback';
    const isBreak = nowAction.rol === 'Break';
    const isUndefined = nowAction.rol === 'Actividad a definir';

    if (isBreak || isUndefined) {
      return `
        <div class="eyebrow">Ahora · ${myTeam}</div>
        <div class="big">${isUndefined ? 'Actividad a definir' : 'Break ☕'}</div>
        ${isUndefined ? '' : '<div class="sub">En este bloque tu equipo no tiene una actividad asignada.</div>'}
      `;
    }

    const rolTexto = isFeedback
      ? (nowAction.detalle ? 'Das feedback a' : 'Das feedback a un equipo')
      : 'Testeás';

    return `
      <div class="eyebrow">Ahora · ${myTeam}</div>
      <div class="big">${escapeHTML(aulaLabel(nowAction.aula))} · ${escapeHTML(rolTexto)}</div>
      <div class="sub">
        ${isFeedback ? (nowAction.detalle ? `<strong>${escapeHTML(nowAction.detalle)}</strong>` : '') : `${escapeHTML(teamName(app.selectedTeam))} pone a prueba el prototipo`}
      </div>
    `;
  }

  if (nextAction) {
    const isToday = nextAction.fechaKey === currentDateKey();

    if (isToday) {
      const isFeedback = nextAction.rol === 'Das feedback';
      const isBreak = nextAction.rol === 'Break';
      const isUndefined = nextAction.rol === 'Actividad a definir';
      const rolTexto = isFeedback
        ? (nextAction.detalle ? 'Das feedback a' : 'Das feedback a un equipo')
        : nextAction.rol;
      const nextPlace = nextAction.aula ? ` · ${escapeHTML(aulaLabel(nextAction.aula))}` : '';

      return `
        <div class="eyebrow">Ahora tenés break ☕ · ${myTeam}</div>
        <div class="next-block-label">Próximo bloque</div>
        <div class="big">⏭️ ${escapeHTML(blockLabel(nextAction))}${nextPlace}</div>
        <div class="sub">
          ${isFeedback ? `👈 ${escapeHTML(rolTexto)}${nextAction.detalle ? ` <strong>${escapeHTML(nextAction.detalle)}</strong>` : ''}` : isUndefined ? 'Actividad a definir' : isBreak ? 'Break' : `📱 ${escapeHTML(rolTexto)}`}
        </div>
      `;
    }

    return `
      <div class="eyebrow">${myTeam}</div>
      <div class="big">Todavía no llegó tu fecha de testeo</div>
      <div class="sub">${escapeHTML(formatTimeUntil(nextAction.startDateTime))}</div>
    `;
  }

  if (actions.length && actions.every(action => isActionPast(action))) {
    return `
      <div class="eyebrow">${myTeam}</div>
      <div class="big">Ya no tenés más bloques pendientes</div>
    `;
  }

  const nextGlobal = getNextGlobalBlockDateTime();
  if (nextGlobal) {
    return `
      <div class="eyebrow">${myTeam}</div>
      <div class="big">Todavía no empezó el primer bloque</div>
      <div class="sub">${escapeHTML(formatTimeUntil(nextGlobal))}</div>
    `;
  }

  if (testDateStatus() === 'past') {
    return `
      <div class="eyebrow">${myTeam}</div>
      <div class="big">La clase de testeos ya terminó</div>
    `;
  }

  return `
    <div class="eyebrow">${myTeam}</div>
    <div class="big">No hay bloques asignados para este equipo</div>
  `;
}

function renderMyAgenda(actions) {
  if (!actions.length) return `<div class="agenda-item">No hay bloques cargados para este equipo.</div>`;

  const actionDateKeys = uniqueValues(actions.map(action => action.fechaKey));

  return actionDateKeys.map(fechaKey => {
    ensureMyDateOpenState(fechaKey);
    const open = isMyDateOpen(fechaKey);
    const date = dateFromKey(fechaKey);
    const title = myClassTitleForDate(fechaKey);

    const blocks = app.allBlocks.filter(block => block.fechaKey === fechaKey);

    const items = blocks.map(block => {
      const action = actions.find(action =>
        action.fechaKey === block.fechaKey &&
        action.horaInicio === block.horaInicio &&
        action.horaCierre === block.horaCierre
      );

      if (action) return action;

      return placeholderActionForBlock(block);
    });

    return `
      <div class="card my-date-card ${open ? 'is-open' : 'is-collapsed'}" data-my-date-card="${escapeHTML(fechaKey)}">
        <button class="my-date-toggle" type="button" data-toggle-my-date="${escapeHTML(fechaKey)}" aria-expanded="${open ? 'true' : 'false'}">
          <span><span class="my-date-title-emoji" aria-hidden="true">💼</span> ${escapeHTML(title)}</span>
          <span class="my-date-toggle-icon" aria-hidden="true">${open ? '▴' : '▾'}</span>
        </button>
        <div class="my-date-content" ${open ? '' : 'hidden'}>
          ${items.map(item => renderAction(item)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function myClassTitleForDate(fechaKey) {
  const date = dateFromKey(fechaKey);
  const label = date ? formatDateWithWeekday(date, { capitalizeFirstWord: false }) : fechaKey;

  if (isDateToday(date)) {
    return 'Así se organiza mi clase de hoy';
  }

  const last = getLastBlockDateTime(fechaKey);
  if (last && currentDateTime() > last) {
    return `Así fue mi clase del ${label}`;
  }

  return `Así se organiza mi clase del ${label}`;
}

function ensureMyDateOpenState(key) {
  if (Object.prototype.hasOwnProperty.call(app.myDateOpenState, key)) return;
  app.myDateOpenState[key] = shouldMyDateStartOpen(key);
}

function isMyDateOpen(key) {
  ensureMyDateOpenState(key);
  return app.myDateOpenState[key] !== false;
}

function shouldMyDateStartOpen(key) {
  const now = currentDateTime();
  const first = getFirstBlockDateTime(key);
  const last = getLastBlockDateTime(key);

  if (first && last && now >= first && now <= last) return true;
  if (first && now < first) {
    const next = nextActiveOrFutureAgendaDate();
    return next ? next.key === key : false;
  }

  const allDone = getLastBlockDateTime() && now > getLastBlockDateTime();
  return Boolean(allDone);
}

function renderAction(action) {
  const now = isActionNow(action);
  const past = isActionPast(action);
  const isFeedback = action.rol === 'Das feedback';
  const isBreak = action.rol === 'Break';
  const isUndefined = action.rol === 'Actividad a definir';

  if (isBreak || isUndefined) {
    return `
      <div class="agenda-item ${now ? 'now' : ''} ${past ? 'is-past' : ''} is-break">
        <div class="agenda-main-row">
          <div class="agenda-main">${isUndefined ? '🕓' : '☕'} ${escapeHTML(blockLabel(action))} · ${isUndefined ? 'Actividad a definir' : 'Break'}</div>
          ${now ? `<span class="live-badge agenda-live-badge" aria-label="Bloque en vivo"><span class="live-badge-dot">🔴</span><span class="live-badge-text">Ahora</span></span>` : ''}
          ${past ? `<span class="done-check" aria-label="Bloque realizado">✓</span>` : ''}
        </div>
      </div>
    `;
  }

  const main = `<div class="agenda-main-row"><div class="agenda-main">🕒 ${escapeHTML(blockLabel(action))} · ${escapeHTML(aulaLabel(action.aula))}</div>${now ? `<span class="live-badge agenda-live-badge" aria-label="Bloque en vivo"><span class="live-badge-dot">🔴</span><span class="live-badge-text">Ahora</span></span>` : ''}${past ? `<span class="done-check" aria-label="Bloque realizado">✓</span>` : ''}</div>`;

  if (isFeedback) {
    return `
      <div class="agenda-item ${now ? 'now' : ''} ${past ? 'is-past' : ''}">
        ${main}
        <div class="agenda-action-row">
          <span class="agenda-action-emoji">👈</span>
          <span class="agenda-action-content">
            <span>${action.detalle ? 'Das feedback a' : 'Das feedback a un equipo'}</span>
            ${action.detalle ? `<strong>${escapeHTML(action.detalle)}</strong>` : ''}
          </span>
        </div>
      </div>
    `;
  }

  return `
    <div class="agenda-item ${now ? 'now' : ''} ${past ? 'is-past' : ''}">
      ${main}
      <div class="agenda-action-row">
        <span class="agenda-action-emoji">📱</span>
        <span class="agenda-action-content">
          <span>Testeás</span>
          <span class="sub">${escapeHTML(teamName(app.selectedTeam))} pone a prueba el prototipo</span>
        </span>
      </div>
    </div>
  `;
}

function renderTexts() {
  const section = document.getElementById('aclaraciones');
  const box = document.getElementById('texts');
  if (!box) return;

  if (!aclaracionesVisible()) {
    if (section) section.hidden = true;
    box.innerHTML = '';
    return;
  }

  if (section) section.hidden = false;

  const visibleTexts = app.texts.filter(item => item.visible);

  if (!visibleTexts.length) {
    box.innerHTML = `<div class="text-item">No hay aclaraciones visibles.</div>`;
    return;
  }

  box.innerHTML = visibleTexts.map(item => `
    <div class="text-item">${formatText(item.texto)}</div>
  `).join('');
}
function renderFooter() {
  const footer = document.querySelector('.site-footer');

  if (footer && app.config.footer) {
    footer.setAttribute('title', app.config.footer);
  }
}
function myActions(teamId) {
  const actions = [];

  app.agenda.forEach(row => {
    const startDateTime = rowDateTime(row, 'inicio');
    const endDateTime = rowDateTime(row, 'cierre');

    if (row.testea === teamId) {
      actions.push({
        fecha: row.fecha,
        fechaKey: row.fechaKey,
        horaInicio: row.horaInicio,
        horaCierre: row.horaCierre,
        startDateTime,
        endDateTime,
        aula: row.aula,
        rol: 'Testeás',
        detalle: 'Tu equipo y vos ponen a prueba el prototipo'
      });
    }

    if (feedbackActivityVisible() && row.feedbacks.includes(teamId)) {
      actions.push({
        fecha: row.fecha,
        fechaKey: row.fechaKey,
        horaInicio: row.horaInicio,
        horaCierre: row.horaCierre,
        startDateTime,
        endDateTime,
        aula: row.aula,
        rol: 'Das feedback',
        detalle: feedbackAssignmentsVisible() ? plainTeamLabel(row.testea) : ''
      });
    }
  });

  return actions.sort((a, b) => {
    const byDate = String(a.fechaKey).localeCompare(String(b.fechaKey));
    if (byDate !== 0) return byDate;
    return timeToMin(a.horaInicio) - timeToMin(b.horaInicio);
  });
}

function currentActionForTeam(teamId) {
  const action = myActions(teamId).find(action => isActionNow(action));
  if (action) return action;

  const currentBlock = app.allBlocks.find(block => {
    const start = blockDateTime(block, 'inicio');
    const end = blockDateTime(block, 'cierre');
    const now = currentDateTime();
    return start && end && now >= start && now < end;
  });

  return currentBlock ? placeholderActionForBlock(currentBlock) : null;
}

function nextActionForTeam(teamId) {
  const now = currentDateTime();
  const actions = myActions(teamId);
  const nextVisibleAction = actions.find(action => action.startDateTime && action.startDateTime > now);
  if (nextVisibleAction) return nextVisibleAction;

  if (!feedbackExists() || feedbackActivityVisible()) return null;

  const nextBlock = app.allBlocks.find(block => {
    const start = blockDateTime(block, 'inicio');
    return start && start > now;
  });

  return nextBlock ? placeholderActionForBlock(nextBlock) : null;
}

function currentRows() {
  return app.agenda
    .filter(row => isRowNow(row))
    .sort((a, b) => app.aulaOrder.indexOf(a.aula) - app.aulaOrder.indexOf(b.aula));
}

function isRowNow(row) {
  const start = rowDateTime(row, 'inicio');
  const end = rowDateTime(row, 'cierre');
  const now = currentDateTime();
  return Boolean(start && end && now >= start && now < end);
}

function isRowPast(row) {
  const end = rowDateTime(row, 'cierre');
  return Boolean(end && currentDateTime() > end);
}

function isActionNow(action) {
  const now = currentDateTime();
  return Boolean(action.startDateTime && action.endDateTime && now >= action.startDateTime && now < action.endDateTime);
}

function isActionPast(action) {
  return Boolean(action.endDateTime && currentDateTime() > action.endDateTime);
}

    function currentMinutes() {
      const forced = new URLSearchParams(window.location.search).get('t');

      if (forced && /^\d{1,2}:\d{2}$/.test(forced)) {
        return timeToMin(forced);
      }

      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    }

    function timeToMin(time) {
      const [h, m] = String(time || '0:00').split(':').map(Number);
      return h * 60 + m;
    }

    function isTimeLike(value) {
      return /^\d{1,2}:\d{2}$/.test(String(value || '').trim());
    }

function blockLabel(item) {
  return `${item.horaInicio} a ${item.horaCierre} hs.`;
}

function blockLabelHTML(item) {
  return `
    <span class="block-hour">${escapeHTML(item.horaInicio)}</span>
    <span class="block-lower">a</span>
    <span class="block-hour">${escapeHTML(item.horaCierre)}</span>
    <span class="block-lower">hs.</span>
  `;
}

function uniqueBlocks(agenda) {
  const blocks = [];

  agenda.forEach(row => {
    const exists = blocks.some(block =>
      block.fechaKey === row.fechaKey &&
      block.horaInicio === row.horaInicio &&
      block.horaCierre === row.horaCierre
    );

    if (!exists) {
      blocks.push({
        fecha: row.fecha,
        fechaKey: row.fechaKey,
        horaInicio: row.horaInicio,
        horaCierre: row.horaCierre
      });
    }
  });

  return blocks.sort((a, b) => {
    const byDate = String(a.fechaKey).localeCompare(String(b.fechaKey));
    if (byDate !== 0) return byDate;
    return timeToMin(a.horaInicio) - timeToMin(b.horaInicio);
  });
}

function inferMissingEndTimes() {
  const startsByDate = new Map();

  app.agenda.forEach(row => {
    if (!startsByDate.has(row.fechaKey)) startsByDate.set(row.fechaKey, []);
    const starts = startsByDate.get(row.fechaKey);
    if (!starts.includes(row.horaInicio)) starts.push(row.horaInicio);
  });

  startsByDate.forEach(starts => starts.sort((a, b) => timeToMin(a) - timeToMin(b)));

  app.agenda.forEach(row => {
    if (row.horaCierre) return;
    const starts = startsByDate.get(row.fechaKey) || [];
    const currentIndex = starts.indexOf(row.horaInicio);
    const nextStart = starts[currentIndex + 1];
    row.horaCierre = nextStart || minToTime(timeToMin(row.horaInicio) + 35);
  });
}

    function minToTime(totalMinutes) {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

function teamData(id) {
  return app.teams.get(String(id)) || {
    id,
    nombre: `Equipo ${id}`,
    tematica: ''
  };
}

function aulaData(idAula) {
  return app.aulas.get(String(idAula)) || {
    id_aula: idAula,
    nro_aula: idAula,
    nombre_aula: '',
    ubicacion: '',
    comentario: ''
  };
}

function aulaLabel(idAula) {
  const data = aulaData(idAula);
  const nombre = String(data.nombre_aula || '').trim();
  const numero = String(data.nro_aula || '').trim();

  if (nombre) return nombre;
  if (numero) return `Aula ${numero}`;

  return `Aula ${idAula}`;
}

function teamNumber(id) {
  if (!id) return '';
  return String(id).padStart(2, '0');
}

function teamNumberAndName(id) {
  if (!id) return '';
  const data = teamData(id);
  return `${teamNumber(id)} · ${data.nombre}`;
}

function teamTopic(id) {
  if (!id) return '';
  return teamData(id).tematica || '';
}

    function teamName(id) {
      return teamData(id).nombre;
    }

function plainTeamLabel(id) {
  const data = teamData(id);
  return `${teamNumber(id)} · ${data.nombre}`;
}

function teamLabel(id, showTopic = true) {
  if (!id) return '';

  const data = teamData(id);
  const topic = showTopic && data.tematica
    ? `<span class="team-topic">${escapeHTML(data.tematica)}</span>`
    : '';

  return `
    <span class="team-label">
      <span class="team-main">${escapeHTML(teamNumber(id))} · ${escapeHTML(data.nombre)}</span>
      ${topic}
    </span>
  `;
}



function isTrue(value) {
  return String(value || '').trim().toUpperCase() === 'TRUE';
}

function settingIsTrue(key) {
  return isTrue(app.settings[key]);
}

function feedbackExists() {
  return settingIsTrue('hay_feedback');
}

function feedbackAssignmentsVisible() {
  return feedbackExists() && settingIsTrue('feedback_visible');
}

function feedbackActivityVisible() {
  return feedbackExists() && settingIsTrue('actividad_visible');
}

function feedbackFormVisible() {
  return feedbackExists() && settingIsTrue('form_feedback_visible');
}

function cuestionarioFormVisible() {
  return settingIsTrue('form_cuestionario_visible');
}

function aclaracionesVisible() {
  return settingIsTrue('aclaraciones_visible');
}

function placeholderRoleForHiddenBlock() {
  return feedbackExists() && !feedbackActivityVisible()
    ? 'Actividad a definir'
    : 'Break';
}

function placeholderActionForBlock(block) {
  return {
    fecha: block.fecha,
    fechaKey: block.fechaKey,
    horaInicio: block.horaInicio,
    horaCierre: block.horaCierre,
    startDateTime: blockDateTime(block, 'inicio'),
    endDateTime: blockDateTime(block, 'cierre'),
    aula: '',
    rol: placeholderRoleForHiddenBlock(),
    detalle: ''
  };
}

function teamInRow(teamId, row) {
  if (!teamId) return false;
  return row.testea === teamId || (feedbackActivityVisible() && row.feedbacks.includes(teamId));
}

function isSelectedTeam(id) {
  return Boolean(app.selectedTeam && id && id === app.selectedTeam);
}

    function cell(row, index) {
      return row[index] ? String(row[index]).trim() : '';
    }

function currentClockLabel() {
  const d = currentDateTime();
  const hour = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (isAnyAgendaDateToday()) return `${hour}:${minutes}`;

  return formatTodayWithWeekdayAndTime();
}

function formatText(text) {
  let html = escapeHTML(text);

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );

  html = html.replace(
    /(^|[\s>])(https?:\/\/[^\s<]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener">$2</a>'
  );

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<em>$1</em>');

  return html;
}

    function escapeHTML(str) {
      return String(str || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }
    

    function parseCSV(text) {
      const rows = [];
      let row = [];
      let cell = '';
      let insideQuotes = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && insideQuotes && next === '"') {
          cell += '"';
          i++;
          continue;
        }

        if (char === '"') {
          insideQuotes = !insideQuotes;
          continue;
        }

        if (char === ',' && !insideQuotes) {
          row.push(cell);
          cell = '';
          continue;
        }

        if ((char === '\n' || char === '\r') && !insideQuotes) {
          if (char === '\r' && next === '\n') i++;
          row.push(cell);
          rows.push(row);
          row = [];
          cell = '';
          continue;
        }

        cell += char;
      }

      if (cell.length || row.length) {
        row.push(cell);
        rows.push(row);
      }

      return rows.filter(r => r.some(c => String(c).trim() !== ''));
    }

function setupHeaderMenu() {
  const button = document.getElementById('menu-button');
  const menu = document.getElementById('header-menu');
  const backdrop = document.getElementById('menu-backdrop');

  if (!button || !menu) return;

  button.addEventListener('click', event => {
    event.stopPropagation();

    const isOpen = !menu.classList.contains('is-open');

    menu.classList.toggle('is-open', isOpen);
    button.classList.toggle('is-open', isOpen);
    button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

    if (backdrop) backdrop.hidden = !isOpen;
  });

  if (backdrop) {
    backdrop.addEventListener('click', closeHeaderMenu);
  }

menu.addEventListener('click', event => {
  const clickedLink = event.target.closest('a[href^="#"]');
  if (!clickedLink) return;

  const targetId = clickedLink.getAttribute('href').replace('#', '');

  if (targetId === 'mi-equipo') {
    event.preventDefault();
    setActiveMenuLink(targetId);
    closeHeaderMenu();

    if (!app.selectedTeam) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const mySection = document.getElementById('my-section');
    if (mySection) {
      scrollToSection(mySection);
    }

    return;
  }

  const target = document.getElementById(targetId);
  if (target) {
    event.preventDefault();
    setActiveMenuLink(targetId);
    closeHeaderMenu();
    scrollToSection(target);
  }
});

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeHeaderMenu();
      closeQrLightbox();
    }
  });
}


function scrollToSection(target) {
  const header = document.querySelector('.site-header');
  const headerHeight = header ? header.offsetHeight : 0;
  const y = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;

  window.scrollTo({
    top: y,
    behavior: 'smooth'
  });
}

function closeHeaderMenu() {
  const button = document.getElementById('menu-button');
  const menu = document.getElementById('header-menu');
  const backdrop = document.getElementById('menu-backdrop');

  if (!button || !menu) return;

  menu.classList.remove('is-open');
  button.classList.remove('is-open');
  button.setAttribute('aria-expanded', 'false');

  if (backdrop) backdrop.hidden = true;
}

function setupQrLightbox() {
  const lightbox = document.getElementById('qr-lightbox');
  const image = document.getElementById('qr-image');

  if (!lightbox || !image) return;

  updateQrData();

  document.addEventListener('click', event => {
    const button = event.target.closest('#qr-button');
    if (!button) return;

    if (!cuestionarioFormVisible()) return;
    closeHeaderMenu();
    updateQrData();
    lightbox.hidden = false;
  });

  lightbox.querySelectorAll('[data-close-qr]').forEach(el => {
    el.addEventListener('click', closeQrLightbox);
  });

  image.addEventListener('load', () => {
    image.classList.remove('qr-image-error');
  });

  image.addEventListener('error', () => {
    tryNextQrImageSource(image);
  });
}

function updateQrData() {
  const showCuestionario = cuestionarioFormVisible();
  const cuestionario = app.links.cuestionario || {};
  const image = document.getElementById('qr-image');
  const qrButton = document.getElementById('qr-button');
  const qrUrl = document.getElementById('qr-url');
  const copyButton = document.getElementById('qr-copy-link');


  const cuestionarioUrl = showCuestionario ? String(cuestionario.url || '').trim() : '';
  const staticSources = driveUrlToImageSources(cuestionario.url_qr || '');
  const forceStatic = String(cuestionario.forzar_url_qr || '').trim().toUpperCase() === 'TRUE';
  const automaticSources = cuestionarioUrl
    ? [
        `https://api.qrserver.com/v1/create-qr-code/?size=900x900&qzone=2&margin=4&ecc=L&data=${encodeURIComponent(cuestionarioUrl)}`,
        `https://quickchart.io/qr?text=${encodeURIComponent(cuestionarioUrl)}&size=900&margin=14&ecLevel=L`
      ]
    : [];

  const imageSources = forceStatic
    ? staticSources
    : uniqueValues([...automaticSources, ...staticSources]);

  if (image) {
    image.dataset.sources = JSON.stringify(imageSources);
    image.dataset.sourceIndex = '0';
    image.classList.remove('qr-image-error');
    image.alt = 'Código QR para usuarios';
    image.hidden = !imageSources.length;
    image.src = imageSources[0] || '';
  }

  if (qrUrl) {
    if (cuestionarioUrl) {
      qrUrl.href = cuestionarioUrl;
      qrUrl.textContent = cuestionarioUrl;
      qrUrl.hidden = false;
    } else {
      qrUrl.href = '#';
      qrUrl.textContent = '';
      qrUrl.hidden = true;
    }
  }

  if (copyButton) {
    copyButton.hidden = !cuestionarioUrl;
    copyButton.onclick = async () => {
      try {
        await navigator.clipboard.writeText(cuestionarioUrl);
        copyButton.classList.add('copied');
        copyButton.innerHTML = '<i class="ti ti-check"></i> Link copiado';
        setTimeout(() => {
          copyButton.classList.remove('copied');
          copyButton.innerHTML = '<i class="ti ti-copy"></i> Copiar link al formulario';
        }, 1400);
      } catch (err) {
        console.warn(err);
        alert('No se pudo copiar el link');
      }
    };
  }

  if (qrButton) {
    const enabled = Boolean(imageSources.length || cuestionarioUrl);
    qrButton.style.opacity = enabled ? '1' : '.45';
    qrButton.style.pointerEvents = enabled ? 'auto' : 'none';
  }
}

function tryNextQrImageSource(image) {
  let sources = [];

  try {
    sources = JSON.parse(image.dataset.sources || '[]');
  } catch (err) {
    sources = [];
  }

  const currentIndex = Number(image.dataset.sourceIndex || 0);
  const nextIndex = currentIndex + 1;

  if (sources[nextIndex]) {
    image.dataset.sourceIndex = String(nextIndex);
    image.src = sources[nextIndex];
    return;
  }

  image.classList.add('qr-image-error');
  image.alt = 'No se pudo cargar el QR. Abrí el link de abajo para acceder al cuestionario.';
}

function driveUrlToImageSources(url) {
  const raw = String(url || '').trim();
  if (!raw) return [];

  const id = getDriveFileId(raw);

  if (!id) {
    return [raw];
  }

  const encodedId = encodeURIComponent(id);

  return uniqueValues([
    `https://drive.google.com/thumbnail?id=${encodedId}&sz=w1000`,
    `https://drive.usercontent.google.com/download?id=${encodedId}&export=view`,
    `https://drive.google.com/uc?export=view&id=${encodedId}`,
    raw
  ]);
}

function getDriveFileId(url) {
  const raw = String(url || '').trim();
  const fileMatch = raw.match(/\/file\/d\/([^/]+)/);
  const idMatch = raw.match(/[?&]id=([^&]+)/);

  return decodeURIComponent(fileMatch?.[1] || idMatch?.[1] || '');
}

function uniqueValues(values) {
  return values.filter((value, index, array) => value && array.indexOf(value) === index);
}

function closeQrLightbox() {
  const lightbox = document.getElementById('qr-lightbox');
  if (lightbox) lightbox.hidden = true;
}

function setupBackToTopButton() {
  const button = document.getElementById('back-to-top-button');
  if (!button) return;

  function updateVisibility() {
    button.classList.toggle('is-visible', window.scrollY > 520);
  }

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  updateVisibility();
  window.addEventListener('scroll', updateVisibility, { passive: true });
}

function setupSectionSpy() {
  function getTarget(id) {
    if (id === 'mi-equipo') return document.getElementById('my-section');
    return document.getElementById(id);
  }

  function currentSectionMap() {
    return Array.from(document.querySelectorAll('[data-section-link]'))
      .map(link => {
        const id = link.getAttribute('data-section-link');
        const section = getTarget(id);
        return { id, link, section };
      })
      .filter(item => item.section);
  }

  function updateActiveByScroll() {
    const sectionMap = currentSectionMap();
    if (!sectionMap.length) return;

    const header = document.querySelector('.site-header');
    const headerHeight = header ? header.offsetHeight : 0;
    const markerY = window.scrollY + headerHeight + 90;

    const visibleSections = sectionMap.filter(item => {
      if (!item.section || item.section.offsetParent === null) return false;
      const top = item.section.offsetTop;
      const bottom = top + item.section.offsetHeight;
      return markerY >= top && markerY < bottom;
    });

    const activeItem = visibleSections[visibleSections.length - 1] || sectionMap.find(item => {
      return item.section && item.section.offsetParent !== null;
    });

    if (activeItem) setActiveMenuLink(activeItem.id);
  }

  updateActiveByScroll();
  window.addEventListener('scroll', updateActiveByScroll, { passive: true });
  window.addEventListener('resize', updateActiveByScroll);
}

function setActiveMenuLink(activeId) {
  document.querySelectorAll('[data-section-link]').forEach(link => {
    link.classList.toggle(
      'is-active',
      link.getAttribute('data-section-link') === activeId
    );
  });
}
