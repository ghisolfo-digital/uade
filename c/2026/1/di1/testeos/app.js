    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQb2Ggbd5Y1VOwTbAI7CjvaHNDwyYs5Y5IuJQCtR2G1eF7pN_bECM4_EQKMPvmwUredXZ2vMmZ43uiu/pub?gid=331164853&single=true&output=csv';
const QR_IMAGE_URL = 'https://drive.google.com/uc?export=view&id=REEMPLAZAR_ID_DE_GOOGLE_DRIVE';
const QR_PUBLIC_URL = QR_IMAGE_URL;

const CSV_REFRESH_MS = 120000;
const CSV_REFRESH_JITTER_MS = 30000;
const CSV_FIRST_LIVE_JITTER_MS = 25000;
const LOCAL_CACHE_KEY = 'testeosUX_csv_cache_v1';

    const app = {
      config: {},
      teams: new Map(),
      agenda: [],
      texts: [],
      links: {},
      selectedTeam: null,
      allBlocks: [],
      aulaOrder: []
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
  app.teams = new Map();
  app.agenda = [];
  app.texts = [];
  app.links = {};
  app.allBlocks = [];
  app.aulaOrder = [];
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
  const delay = CSV_REFRESH_MS + randomBetween(0, CSV_REFRESH_JITTER_MS);

  setTimeout(async () => {
    await refreshDataFromCsv();
    scheduleCsvRefresh();
  }, delay);
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

        if (tipo === 'equipos') {
          app.teams.set(a, {
            id: a,
            nombre: b,
            tematica: c
          });
        }

if (tipo === 'agenda') {
  // Formato nuevo recomendado:
  // agenda | data | hora_inicio | hora_cierre | aula | testea | feedback_1 | feedback_2 | ...
  // También mantiene compatibilidad con el formato anterior:
  // agenda | data | hora | aula | testea | feedback_1 | feedback_2 | ...
  const usaFormatoNuevo = isTimeLike(b);

  const horaInicio = a;
  const horaCierre = usaFormatoNuevo ? b : '';
  const aula = usaFormatoNuevo ? c : b;
  const testea = usaFormatoNuevo ? d : c;

  const feedbacks = row
    .slice(usaFormatoNuevo ? 6 : 5)
    .map(value => String(value || '').trim())
    .filter(value => value !== '');

  if (aula && !app.aulaOrder.includes(aula)) {
    app.aulaOrder.push(aula);
  }

  app.agenda.push({
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
            texto: b
          });
        }

        if (tipo === 'links') {
          app.links[a] = {
            label: b,
            url: c
          };
        }
      });

      inferMissingEndTimes();

      app.agenda.sort((x, y) => {
        const byTime = timeToMin(x.horaInicio) - timeToMin(y.horaInicio);
        if (byTime !== 0) return byTime;

        return app.aulaOrder.indexOf(x.aula) - app.aulaOrder.indexOf(y.aula);
      });

      app.texts.sort((x, y) => x.orden - y.orden);
      app.allBlocks = uniqueBlocks(app.agenda);
    }

function renderAll() {
  renderHeader();
  renderSelector();
  renderLinks();
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

    function renderHeader() {
      document.title = app.config.titulo || 'Testeos UX';
      document.getElementById('site-title').textContent = app.config.titulo || 'Testeos UX';
      document.getElementById('site-subtitle').textContent = app.config.bajada || '';
    }


function renderSelectedTeamBar() {
  const bar = document.getElementById('selected-team-bar');
  const text = document.getElementById('selected-team-text');
  const clearButton = document.getElementById('clear-team-button');

  if (!bar || !text || !clearButton) return;

  if (!app.selectedTeam) {
    bar.hidden = true;
    return;
  }

  bar.hidden = false;
  text.textContent = `${teamNumber(app.selectedTeam)} · ${teamName(app.selectedTeam)}`;

  clearButton.onclick = () => {
    app.selectedTeam = '';

    const select = document.getElementById('team-select');
    if (select) select.value = '';

    const url = new URL(window.location.href);
    url.searchParams.delete('e');
    history.pushState({}, '', url);

    renderAll();
  };
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
  setLink('feedback-link', app.links.feedback, 'Form de feedback a otro equipo');
      

      document.getElementById('share-button').onclick = async () => {
        const url = new URL(window.location.href);
url.searchParams.delete('e');
url.searchParams.delete('t');
        const title = app.selectedTeam
          ? `Agenda del equipo ${app.selectedTeam} · ${teamName(app.selectedTeam)}`
          : app.config.titulo || 'Testeos UX';

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

function setLink(id, data, fallbackLabel) {
  const el = document.getElementById(id);
  if (!el) return;

  const fixedLabels = {
    'feedback-link': 'Form de feedback a otro equipo'
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

  if (!nowRows.length) {
    box.innerHTML = `
      <div class="card">
<div class="eyebrow">Ahora</div>
        <div class="big">No hay un bloque activo</div>
        <div class="sub">Puede ser antes del primer turno o después del último.</div>
      </div>
    `;
    return;
  }

  box.innerHTML = nowRows.map(row => {
    const selectedIsHere = teamInRow(app.selectedTeam, row);

    return `
      <div class="card status-card ${selectedIsHere ? 'current-for-team' : ''}">
<div class="eyebrow">Aula <span class="aula-code">${escapeHTML(row.aula)}</span> · ${blockLabelHTML(row)}</div>

        <div class="now-testing-line team-label-large">
          <span aria-hidden="true">📱</span>
          <span class="now-testing-label">Está testeando</span>
          <span class="now-testing-team">${teamLabel(row.testea, true)}</span>
        </div>

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
      </div>
    `;
  }).join('');
}
function renderTables() {
  const box = document.getElementById('tables');
  const aulas = app.aulaOrder.length
    ? app.aulaOrder
    : [...new Set(app.agenda.map(x => x.aula).filter(Boolean))];

  box.innerHTML = aulas.map(aula => {
    const rows = app.agenda.filter(item => item.aula === aula);

    return `
      <div class="card">
        <h3>Aula <span class="aula-code">${escapeHTML(aula)}</span></h3>
        <div class="schedule-list">
          ${rows.map(row => renderScheduleBlock(row)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderScheduleBlock(row) {
  const isNow = isRowNow(row);

  return `
    <div class="schedule-block ${isNow ? 'is-now' : ''}">
      <div class="block-title">
        <span class="block-title-label">Bloque</span>
        <span aria-hidden="true">🕒</span>
        <span class="block-title-time">${blockLabelHTML(row)}</span>
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

        <div class="feedback-compact-list">
          ${row.feedbacks.map(id => `
            <div class="feedback-row ${isSelectedTeam(id) ? 'is-selected-inline' : ''}">
              <span class="row-emoji" aria-hidden="true">👈</span>
              <span class="role-label">Da feedback</span>
              <span>${teamLabel(id, false)}</span>
            </div>
          `).join('')}
        </div>
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

  document.getElementById('my-now').innerHTML = renderMyNow(nowAction, nextAction);

  const fullAgenda = app.allBlocks.map(block => {
    const action = actions.find(action =>
      action.horaInicio === block.horaInicio &&
      action.horaCierre === block.horaCierre
    );

    if (action) return action;

    return {
      horaInicio: block.horaInicio,
      horaCierre: block.horaCierre,
      aula: '',
      rol: 'Break',
      detalle: ''
    };
  });

  document.getElementById('my-agenda').innerHTML = fullAgenda
    .map(item => renderAction(item))
    .join('');
}

function renderMyNow(nowAction, nextAction) {
  const myTeam = teamLabel(app.selectedTeam, false);

  if (nowAction) {
    const isFeedback = nowAction.rol === 'Das feedback';
    const rolTexto = isFeedback ? 'Das feedback a' : 'Testeás';

    return `
      <div class="eyebrow">Ahora · ${myTeam}</div>
      <div class="big">Aula ${escapeHTML(nowAction.aula)} · ${escapeHTML(rolTexto)}</div>
      <div class="sub">
        ${isFeedback
          ? `<strong>${escapeHTML(nowAction.detalle)}</strong>`
          : 'Tu equipo y vos ponen a prueba el prototipo'
        }
      </div>
    `;
  }

  if (nextAction) {
    const isFeedback = nextAction.rol === 'Das feedback';
    const rolTexto = isFeedback ? 'Das feedback a' : 'Testeás';

    return `
      <div class="eyebrow">Ahora tenés break ☕ · ${myTeam}</div>
      <div class="next-block-label">Próximo bloque</div>
      <div class="big">⏭️ ${escapeHTML(blockLabel(nextAction))} · Aula ${escapeHTML(nextAction.aula)}</div>
      <div class="sub">
        ${isFeedback
          ? `👈 ${escapeHTML(rolTexto)} <strong>${escapeHTML(nextAction.detalle)}</strong>`
          : `📱 ${escapeHTML(rolTexto)}`
        }
      </div>
    `;
  }

  return `
    <div class="eyebrow">${myTeam}</div>
    <div class="big">Ya no tenés más bloques pendientes</div>
  `;
}

function renderAction(action) {
  const now = isActionNow(action);
  const isFeedback = action.rol === 'Das feedback';
  const isBreak = action.rol === 'Break';

  if (isBreak) {
    return `
      <div class="agenda-item ${now ? 'now' : ''} is-break">
        <div class="agenda-main">☕ ${escapeHTML(blockLabel(action))} · Break</div>
      </div>
    `;
  }

  if (isFeedback) {
    return `
      <div class="agenda-item ${now ? 'now' : ''}">
        <div class="agenda-main">🕒 ${escapeHTML(blockLabel(action))} · Aula ${escapeHTML(action.aula)}</div>
        <div class="agenda-action-row">
          <span class="agenda-action-emoji">👈</span>
          <span class="agenda-action-content">
            <span>Das feedback a</span>
            <strong>${escapeHTML(action.detalle)}</strong>
          </span>
        </div>
      </div>
    `;
  }

  return `
    <div class="agenda-item ${now ? 'now' : ''}">
      <div class="agenda-main">🕒 ${escapeHTML(blockLabel(action))} · Aula ${escapeHTML(action.aula)}</div>
      <div class="agenda-action-row">
        <span class="agenda-action-emoji">📱</span>
        <span class="agenda-action-content">
          <span>Testeás</span>
          <span class="sub">Tu equipo y vos ponen a prueba el prototipo</span>
        </span>
      </div>
    </div>
  `;
}
function renderTexts() {
  const box = document.getElementById('texts');

  if (!app.texts.length) {
    box.innerHTML = `<div class="text-item">No hay aclaraciones cargadas.</div>`;
    return;
  }

  box.innerHTML = app.texts.map(item => `
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
    if (row.testea === teamId) {
      actions.push({
        horaInicio: row.horaInicio,
        horaCierre: row.horaCierre,
        aula: row.aula,
        rol: 'Testeás',
        detalle: 'Tu equipo y vos ponen a prueba el prototipo'
      });
    }

    if (row.feedbacks.includes(teamId)) {
      actions.push({
        horaInicio: row.horaInicio,
        horaCierre: row.horaCierre,
        aula: row.aula,
        rol: 'Das feedback',
        detalle: plainTeamLabel(row.testea)
      });
    }
  });

  return actions.sort((a, b) => timeToMin(a.horaInicio) - timeToMin(b.horaInicio));
}
    function currentActionForTeam(teamId) {
      return myActions(teamId).find(action => isActionNow(action)) || null;
    }

    function nextActionForTeam(teamId) {
      const nowMin = currentMinutes();

      return myActions(teamId).find(action =>
        timeToMin(action.horaInicio) > nowMin
      ) || null;
    }

    function currentRows() {
      return app.agenda
        .filter(row => isRowNow(row))
        .sort((a, b) => app.aulaOrder.indexOf(a.aula) - app.aulaOrder.indexOf(b.aula));
    }

    function isRowNow(row) {
      const now = currentMinutes();
      return now >= timeToMin(row.horaInicio) && now < timeToMin(row.horaCierre);
    }

    function isActionNow(action) {
      const now = currentMinutes();
      return now >= timeToMin(action.horaInicio) && now < timeToMin(action.horaCierre);
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
          block.horaInicio === row.horaInicio &&
          block.horaCierre === row.horaCierre
        );

        if (!exists) {
          blocks.push({
            horaInicio: row.horaInicio,
            horaCierre: row.horaCierre
          });
        }
      });

      return blocks.sort((a, b) => timeToMin(a.horaInicio) - timeToMin(b.horaInicio));
    }

    function inferMissingEndTimes() {
      const starts = [...new Set(app.agenda.map(row => row.horaInicio))]
        .sort((a, b) => timeToMin(a) - timeToMin(b));

      app.agenda.forEach(row => {
        if (row.horaCierre) return;

        const currentIndex = starts.indexOf(row.horaInicio);
        const nextStart = starts[currentIndex + 1];

        if (nextStart) {
          row.horaCierre = nextStart;
        } else {
          row.horaCierre = minToTime(timeToMin(row.horaInicio) + 35);
        }
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


function teamInRow(teamId, row) {
  if (!teamId) return false;
  return row.testea === teamId || row.feedbacks.includes(teamId);
}

function isSelectedTeam(id) {
  return Boolean(app.selectedTeam && id && id === app.selectedTeam);
}

    function cell(row, index) {
      return row[index] ? String(row[index]).trim() : '';
    }

    function currentClockLabel() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
      const selector = document.querySelector('.selector-card');
      if (selector) {
        selector.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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
  const button = document.getElementById('qr-button');
  const lightbox = document.getElementById('qr-lightbox');
  const image = document.getElementById('qr-image');
const qrUrl = document.getElementById('qr-url');
  if (!button || !lightbox || !image) return;

image.src = QR_IMAGE_URL;

if (qrUrl) {
  qrUrl.href = QR_PUBLIC_URL;
  qrUrl.textContent = QR_PUBLIC_URL;
}

  button.addEventListener('click', () => {
    closeHeaderMenu();
    lightbox.hidden = false;
  });

  lightbox.querySelectorAll('[data-close-qr]').forEach(el => {
    el.addEventListener('click', closeQrLightbox);
  });

  image.addEventListener('error', () => {
    image.alt = 'No se pudo cargar el QR. Revisá el enlace de Google Drive.';
  });
}

function closeQrLightbox() {
  const lightbox = document.getElementById('qr-lightbox');
  if (lightbox) lightbox.hidden = true;
}

function setupSectionSpy() {
  const links = Array.from(document.querySelectorAll('[data-section-link]'));

  function getTarget(id) {
    if (id === 'mi-equipo') {
      return document.getElementById('my-section');
    }

    return document.getElementById(id);
  }

  const sectionMap = links
    .map(link => {
      const id = link.getAttribute('data-section-link');
      const section = getTarget(id);
      return { id, link, section };
    })
    .filter(item => item.section);

  if (!sectionMap.length) return;

  function updateActiveByScroll() {
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

    if (activeItem) {
      setActiveMenuLink(activeItem.id);
    }
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
