import { api, ApiError } from './api.js';

const SECTIONS = {
  news:     { title: 'News',            color: '--c-news' },
  termine:  { title: 'Termine',         color: '--c-events' },
  muell:    { title: 'Müllabfuhr',      color: '--c-waste' },
  kontakte: { title: 'Kontakte',        color: '--c-contacts' },
  brett:    { title: 'Schwarzes Brett', color: '--c-board' },
};

const state = { user: null, returnTo: null };
const main = document.getElementById('main');
const account = document.getElementById('account');

// ---------- Hilfsfunktionen ----------

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const isAdmin = () => Boolean(state.user?.roles?.includes('ROLE_ADMIN'));

const fullDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
const dayOnly = new Intl.DateTimeFormat('de-DE', { day: 'numeric' });
const monthShort = new Intl.DateTimeFormat('de-DE', { month: 'short' });
const weekdayLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long' });
const timeOnly = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Text mit Leerzeilen → Absätze (bewusst kein HTML aus der Datenbank, das schützt vor Schadcode). */
function paragraphs(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function pageHead(section, title, actionHtml = '') {
  return `
    <header class="page-head" style="--sec: var(${SECTIONS[section].color})">
      <h1>${escapeHtml(title)}</h1>
      ${actionHtml}
    </header>`;
}

function render(html, section) {
  main.style.setProperty('--sec', `var(${SECTIONS[section]?.color ?? '--ink'})`);
  main.innerHTML = html;
}

function setActiveTab(section) {
  document.querySelectorAll('.tabs a').forEach((link) => {
    if (link.dataset.section === section) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

// ---------- Anmeldung ----------

async function loadUser() {
  const me = await api('/api/auth/me'); // setzt nebenbei das CSRF-Cookie
  state.user = me.authenticated ? me : null;
  renderAccount();
}

function renderAccount() {
  if (state.user) {
    account.innerHTML = `
      <span class="who">${escapeHtml(state.user.username)}</span>
      <button class="link-button" type="button" id="logout">Abmelden</button>`;
    document.getElementById('logout').addEventListener('click', logout);
  } else {
    account.innerHTML = `<a class="btn small secondary" href="#/login">Anmelden</a>`;
  }
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  await loadUser();
  route();
}

function viewLogin() {
  render(`
    ${pageHead('news', 'Anmelden')}
    <div id="login-error"></div>
    <form class="form" id="login-form">
      <div class="field">
        <label for="username">Benutzername</label>
        <input id="username" name="username" autocomplete="username" required>
      </div>
      <div class="field">
        <label for="password">Passwort</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
      </div>
      <div><button class="btn" type="submit">Anmelden</button></div>
    </form>`, 'news');

  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await api('/api/auth/login', { method: 'POST', form: Object.fromEntries(new FormData(form)) });
      await loadUser(); // holt nach dem Login ein neues CSRF-Token
      location.hash = state.returnTo || '#/news';
      state.returnTo = null;
    } catch (error) {
      document.getElementById('login-error').innerHTML = error.status === 401
        ? '<p class="notice error">Benutzername oder Passwort stimmt nicht.</p>'
        : '<p class="notice error">Anmelden hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
      button.disabled = false;
    }
  });
}

// ---------- News ----------

function newsItemHtml(item) {
  const date = new Date(item.publishedAt);
  return `
    <li>
      <a class="news-item" href="#/news/${item.id}">
        <time class="news-date" datetime="${escapeHtml(item.publishedAt)}">
          <span class="day">${dayOnly.format(date)}</span>
          <span class="month">${monthShort.format(date)}</span>
        </time>
        <div>
          <h2>${escapeHtml(item.title)}</h2>
          ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ''}
        </div>
      </a>
    </li>`;
}

async function viewNewsList() {
  const action = isAdmin() ? '<a class="btn" href="#/news/neu">News schreiben</a>' : '';
  let page = 0;
  const data = await api('/api/news?page=0');

  if (data.items.length === 0) {
    render(`
      ${pageHead('news', 'News', action)}
      <p class="muted">Noch keine News veröffentlicht.${isAdmin() ? ' Schreib die erste über „News schreiben“.' : ''}</p>`, 'news');
    return;
  }

  render(`
    ${pageHead('news', 'News', action)}
    <ol class="news-list" id="news-list">${data.items.map(newsItemHtml).join('')}</ol>
    <div class="more" id="more">${data.hasMore ? '<button class="btn secondary" type="button">Ältere News laden</button>' : ''}</div>`, 'news');

  const more = document.getElementById('more');
  more.addEventListener('click', async (event) => {
    if (event.target.tagName !== 'BUTTON') return;
    event.target.disabled = true;
    page += 1;
    const next = await api(`/api/news?page=${page}`);
    document.getElementById('news-list').insertAdjacentHTML('beforeend', next.items.map(newsItemHtml).join(''));
    more.innerHTML = next.hasMore ? '<button class="btn secondary" type="button">Ältere News laden</button>' : '';
  });
}

async function viewNewsDetail(id) {
  const news = await api(`/api/news/${encodeURIComponent(id)}`);
  const edited = news.updatedAt && new Date(news.updatedAt) - new Date(news.publishedAt) > 60_000;

  render(`
    <a class="back" href="#/news">Alle News</a>
    <article>
      ${pageHead('news', news.title)}
      <p class="article-meta">
        ${fullDate.format(new Date(news.publishedAt))}${news.author ? `, von ${escapeHtml(news.author)}` : ''}${edited ? ' (bearbeitet)' : ''}
      </p>
      ${news.summary ? `<p class="article-summary">${escapeHtml(news.summary)}</p>` : ''}
      <div class="article-body">${paragraphs(news.content)}</div>
    </article>
    ${isAdmin() ? `
      <div class="admin-actions">
        <a class="btn secondary" href="#/news/${news.id}/bearbeiten">Bearbeiten</a>
        <button class="btn danger" type="button" id="delete">Löschen</button>
      </div>` : ''}`, 'news');

  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`„${news.title}“ wirklich löschen?`)) return;
    await api(`/api/news/${news.id}`, { method: 'DELETE' });
    location.hash = '#/news';
  });
}

async function viewNewsEditor(id) {
  if (!isAdmin()) {
    render(`${pageHead('news', 'News schreiben')}<p class="notice">Nur Admins können News schreiben und bearbeiten.</p>`, 'news');
    return;
  }

  const news = id ? await api(`/api/news/${encodeURIComponent(id)}`) : { title: '', summary: '', content: '' };

  render(`
    <a class="back" href="${id ? `#/news/${news.id}` : '#/news'}">Abbrechen</a>
    ${pageHead('news', id ? 'News bearbeiten' : 'News schreiben')}
    <div id="editor-error"></div>
    <form class="form" id="news-form">
      <div class="field">
        <label for="title">Titel</label>
        <input id="title" name="title" maxlength="200" required value="${escapeHtml(news.title)}">
      </div>
      <div class="field">
        <label for="summary">Kurzfassung</label>
        <span class="hint">Optional. Erscheint in der Liste unter dem Titel.</span>
        <input id="summary" name="summary" maxlength="500" value="${escapeHtml(news.summary)}">
      </div>
      <div class="field">
        <label for="content">Text</label>
        <span class="hint">Eine Leerzeile beginnt einen neuen Absatz.</span>
        <textarea id="content" name="content" required>${escapeHtml(news.content)}</textarea>
      </div>
      <div><button class="btn" type="submit">${id ? 'Änderungen speichern' : 'Veröffentlichen'}</button></div>
    </form>`, 'news');

  const form = document.getElementById('news-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    const body = Object.fromEntries(new FormData(form));
    try {
      const saved = id
        ? await api(`/api/news/${news.id}`, { method: 'PUT', body })
        : await api('/api/news', { method: 'POST', body });
      location.hash = `#/news/${saved.id}`;
    } catch (error) {
      document.getElementById('editor-error').innerHTML = error.status === 400
        ? '<p class="notice error">Titel und Text dürfen nicht leer sein.</p>'
        : '<p class="notice error">Speichern hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
      button.disabled = false;
    }
  });
}

// ---------- Termine ----------

const sameDay = (a, b) => a.toDateString() === b.toDateString();

/** Volle Zeitangabe für die Detailansicht, in ganzen Worten. */
function eventWhenLong(event) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const startTag = `${weekdayLong.format(start)}, ${fullDate.format(start)}`;

  if (event.allDay) {
    return end && !sameDay(start, end)
      ? `${startTag} bis ${weekdayLong.format(end)}, ${fullDate.format(end)}, ganztägig`
      : `${startTag}, ganztägig`;
  }
  if (!end) return `${startTag}, ${timeOnly.format(start)} Uhr`;
  if (sameDay(start, end)) return `${startTag}, ${timeOnly.format(start)} bis ${timeOnly.format(end)} Uhr`;
  return `${startTag}, ${timeOnly.format(start)} Uhr bis ${weekdayLong.format(end)}, ${fullDate.format(end)}, ${timeOnly.format(end)} Uhr`;
}

/** Kurze Zeitangabe für die Liste – das Datum steht dort schon links daneben. */
function eventWhenShort(event) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;

  if (event.allDay) {
    return end && !sameDay(start, end) ? `ganztägig bis ${fullDate.format(end)}` : 'ganztägig';
  }
  if (end && sameDay(start, end)) return `${timeOnly.format(start)} bis ${timeOnly.format(end)} Uhr`;
  return `${timeOnly.format(start)} Uhr`;
}

function eventItemHtml(item) {
  const date = new Date(item.startsAt);
  const locationHtml = item.location ? `<span class="sep">·</span>${escapeHtml(item.location)}` : '';
  return `
    <li>
      <a class="event-item" href="#/termine/${item.id}">
        <time class="event-date" datetime="${escapeHtml(item.startsAt)}">
          <span class="day">${dayOnly.format(date)}</span>
          <span class="month">${monthShort.format(date)}</span>
        </time>
        <div>
          <h2>${escapeHtml(item.title)}</h2>
          <p class="event-when">${escapeHtml(eventWhenShort(item))}${locationHtml}</p>
        </div>
      </a>
    </li>`;
}

async function viewEventList(past) {
  const action = isAdmin() ? '<a class="btn" href="#/termine/neu">Termin eintragen</a>' : '';
  const title = past ? 'Vergangene Termine' : 'Termine';
  const moreLabel = past ? 'Noch ältere Termine laden' : 'Spätere Termine laden';
  const moreButton = `<button class="btn secondary" type="button">${moreLabel}</button>`;
  const toggle = past
    ? '<p class="list-switch"><a href="#/termine">Zu den kommenden Terminen</a></p>'
    : '<p class="list-switch"><a href="#/termine/vergangen">Vergangene Termine ansehen</a></p>';
  const query = past ? '&vergangen=true' : '';

  let page = 0;
  const data = await api(`/api/events?page=0${query}`);

  if (data.items.length === 0) {
    const emptyText = past
      ? 'Es gibt noch keine vergangenen Termine.'
      : `Zurzeit steht nichts an.${isAdmin() ? ' Trag den ersten Termin über „Termin eintragen“ ein.' : ''}`;
    render(`${pageHead('termine', title, action)}${toggle}<p class="muted">${emptyText}</p>`, 'termine');
    return;
  }

  render(`
    ${pageHead('termine', title, action)}
    ${toggle}
    <ol class="event-list" id="event-list">${data.items.map(eventItemHtml).join('')}</ol>
    <div class="more" id="more">${data.hasMore ? moreButton : ''}</div>`, 'termine');

  const more = document.getElementById('more');
  more.addEventListener('click', async (clickEvent) => {
    if (clickEvent.target.tagName !== 'BUTTON') return;
    clickEvent.target.disabled = true;
    page += 1;
    const next = await api(`/api/events?page=${page}${query}`);
    document.getElementById('event-list').insertAdjacentHTML('beforeend', next.items.map(eventItemHtml).join(''));
    more.innerHTML = next.hasMore ? moreButton : '';
  });
}

async function viewEventDetail(id) {
  const event = await api(`/api/events/${encodeURIComponent(id)}`);

  render(`
    <a class="back" href="#/termine">Alle Termine</a>
    <article>
      ${pageHead('termine', event.title)}
      <p class="article-meta">
        ${escapeHtml(eventWhenLong(event))}${event.location ? `<br>${escapeHtml(event.location)}` : ''}
      </p>
      ${event.description ? `<div class="article-body">${paragraphs(event.description)}</div>` : ''}
    </article>
    ${isAdmin() ? `
      <div class="admin-actions">
        <a class="btn secondary" href="#/termine/${event.id}/bearbeiten">Bearbeiten</a>
        <button class="btn danger" type="button" id="delete">Löschen</button>
      </div>` : ''}`, 'termine');

  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`„${event.title}“ wirklich löschen?`)) return;
    await api(`/api/events/${event.id}`, { method: 'DELETE' });
    location.hash = '#/termine';
  });
}

/** ISO-Zeitstempel → Wert für <input type="date"> bzw. <input type="datetime-local"> (Ortszeit). */
function toInputValue(iso, allDay) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  const dateOnly = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return allDay ? dateOnly : `${dateOnly}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Formulareingabe (Ortszeit) → ISO-Zeitstempel für die API. Leer bleibt leer. */
function toInstant(value, allDay) {
  if (!value) return null;
  const d = new Date(allDay ? `${value}T00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function viewEventEditor(id) {
  if (!isAdmin()) {
    render(`${pageHead('termine', 'Termin eintragen')}<p class="notice">Nur Admins können Termine eintragen und bearbeiten.</p>`, 'termine');
    return;
  }

  const event = id
    ? await api(`/api/events/${encodeURIComponent(id)}`)
    : { title: '', description: '', location: '', startsAt: null, endsAt: null, allDay: false };
  const type = event.allDay ? 'date' : 'datetime-local';

  render(`
    <a class="back" href="${id ? `#/termine/${event.id}` : '#/termine'}">Abbrechen</a>
    ${pageHead('termine', id ? 'Termin bearbeiten' : 'Termin eintragen')}
    <div id="editor-error"></div>
    <form class="form" id="event-form">
      <div class="field">
        <label for="title">Titel</label>
        <input id="title" name="title" maxlength="200" required value="${escapeHtml(event.title)}">
      </div>
      <div class="field">
        <label for="location">Ort</label>
        <span class="hint">Optional, zum Beispiel „Gemeindesaal“.</span>
        <input id="location" name="location" maxlength="200" value="${escapeHtml(event.location)}">
      </div>
      <div class="field check">
        <input id="allDay" name="allDay" type="checkbox" ${event.allDay ? 'checked' : ''}>
        <label for="allDay">Ganztägig – ohne Uhrzeit</label>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="startsAt">Beginn</label>
          <input id="startsAt" name="startsAt" type="${type}" required value="${toInputValue(event.startsAt, event.allDay)}">
        </div>
        <div class="field">
          <label for="endsAt">Ende</label>
          <span class="hint">Optional.</span>
          <input id="endsAt" name="endsAt" type="${type}" value="${toInputValue(event.endsAt, event.allDay)}">
        </div>
      </div>
      <div class="field">
        <label for="description">Beschreibung</label>
        <span class="hint">Optional. Eine Leerzeile beginnt einen neuen Absatz.</span>
        <textarea id="description" name="description">${escapeHtml(event.description)}</textarea>
      </div>
      <div><button class="btn" type="submit">${id ? 'Änderungen speichern' : 'Termin eintragen'}</button></div>
    </form>`, 'termine');

  const form = document.getElementById('event-form');
  const errorBox = document.getElementById('editor-error');

  // Das Häkchen schaltet Beginn und Ende zwischen Datum und Datum+Uhrzeit um.
  form.allDay.addEventListener('change', () => {
    const isFullDay = form.allDay.checked;
    [form.startsAt, form.endsAt].forEach((field) => {
      const dateOnly = field.value.slice(0, 10);
      field.type = isFullDay ? 'date' : 'datetime-local';
      // Ohne Uhrzeit verwirft der Browser den Wert eines datetime-local-Feldes.
      field.value = dateOnly ? (isFullDay ? dateOnly : `${dateOnly}T09:00`) : '';
    });
  });

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const button = form.querySelector('button');
    const allDay = form.allDay.checked;
    const body = {
      title: form.title.value,
      description: form.description.value,
      location: form.location.value,
      startsAt: toInstant(form.startsAt.value, allDay),
      endsAt: toInstant(form.endsAt.value, allDay),
      allDay,
    };

    if (body.endsAt && body.startsAt && body.endsAt < body.startsAt) {
      errorBox.innerHTML = '<p class="notice error">Das Ende darf nicht vor dem Beginn liegen.</p>';
      return;
    }

    button.disabled = true;
    try {
      const saved = id
        ? await api(`/api/events/${event.id}`, { method: 'PUT', body })
        : await api('/api/events', { method: 'POST', body });
      location.hash = `#/termine/${saved.id}`;
    } catch (error) {
      errorBox.innerHTML = error.status === 400
        ? '<p class="notice error">Titel und Beginn müssen ausgefüllt sein, und das Ende darf nicht vor dem Beginn liegen.</p>'
        : '<p class="notice error">Speichern hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
      button.disabled = false;
    }
  });
}

// ---------- Müllabfuhr ----------

const weekdayAndDate = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

/** Die Abfallarten kommen aus der API, damit Beschriftung und Reihenfolge nur einmal gepflegt werden. */
let wasteTypes = null;

async function loadWasteTypes() {
  if (!wasteTypes) wasteTypes = await api('/api/waste/types');
  return wasteTypes;
}

function wasteRowHtml(item, admin) {
  const date = new Date(`${item.collectionDate}T00:00`);
  const inner = `
    <time class="waste-date" datetime="${escapeHtml(item.collectionDate)}">
      <span class="day">${dayOnly.format(date)}</span>
      <span class="month">${monthShort.format(date)}</span>
    </time>
    <div>
      <p class="waste-kind">
        <span class="waste-dot wt-${escapeHtml(item.wasteType)}" aria-hidden="true"></span>
        ${escapeHtml(item.label)}
      </p>
      <p class="waste-note">${escapeHtml(weekdayAndDate.format(date))}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</p>
    </div>`;

  // Admins kommen über die Zeile direkt ins Formular, Gäste lesen nur.
  return admin
    ? `<li><a class="waste-row" href="#/muell/${item.id}/bearbeiten">${inner}</a></li>`
    : `<li><div class="waste-row">${inner}</div></li>`;
}

async function viewWasteList(past) {
  const admin = isAdmin();
  const action = admin
    ? '<div class="head-actions"><a class="btn secondary" href="#/muell/import">Termine importieren</a><a class="btn" href="#/muell/neu">Abfuhr eintragen</a></div>'
    : '';
  const title = past ? 'Vergangene Abfuhren' : 'Müllabfuhr';
  const moreLabel = past ? 'Noch ältere Abfuhren laden' : 'Spätere Abfuhren laden';
  const moreButton = `<button class="btn secondary" type="button">${moreLabel}</button>`;
  const toggle = past
    ? '<p class="list-switch"><a href="#/muell">Zu den kommenden Abfuhren</a></p>'
    : '<p class="list-switch"><a href="#/muell/vergangen">Vergangene Abfuhren ansehen</a></p>';
  const query = past ? '&vergangen=true' : '';

  let page = 0;
  const data = await api(`/api/waste?page=0${query}`);

  if (data.items.length === 0) {
    const emptyText = past
      ? 'Es gibt noch keine vergangenen Abfuhren.'
      : `Es sind noch keine Abfuhrtermine eingetragen.${admin ? ' Trag den ersten über „Abfuhr eintragen“ ein.' : ''}`;
    render(`${pageHead('muell', title, action)}${toggle}<p class="muted">${emptyText}</p>`, 'muell');
    return;
  }

  render(`
    ${pageHead('muell', title, action)}
    ${toggle}
    <ol class="waste-list" id="waste-list">${data.items.map((i) => wasteRowHtml(i, admin)).join('')}</ol>
    <div class="more" id="more">${data.hasMore ? moreButton : ''}</div>`, 'muell');

  const more = document.getElementById('more');
  more.addEventListener('click', async (clickEvent) => {
    if (clickEvent.target.tagName !== 'BUTTON') return;
    clickEvent.target.disabled = true;
    page += 1;
    const next = await api(`/api/waste?page=${page}${query}`);
    document.getElementById('waste-list')
      .insertAdjacentHTML('beforeend', next.items.map((i) => wasteRowHtml(i, admin)).join(''));
    more.innerHTML = next.hasMore ? moreButton : '';
  });
}

async function viewWasteEditor(id) {
  if (!isAdmin()) {
    render(`${pageHead('muell', 'Abfuhr eintragen')}<p class="notice">Nur Admins können Abfuhrtermine pflegen.</p>`, 'muell');
    return;
  }

  const [types, collection] = await Promise.all([
    loadWasteTypes(),
    id ? api(`/api/waste/${encodeURIComponent(id)}`) : Promise.resolve({ wasteType: 'RESTMUELL', collectionDate: '', note: '' }),
  ]);

  const options = types.map((type) => `
    <option value="${escapeHtml(type.value)}" ${type.value === collection.wasteType ? 'selected' : ''}>
      ${escapeHtml(type.label)}
    </option>`).join('');

  render(`
    <a class="back" href="#/muell">Abbrechen</a>
    ${pageHead('muell', id ? 'Abfuhr bearbeiten' : 'Abfuhr eintragen')}
    <div id="editor-error"></div>
    <form class="form" id="waste-form">
      <div class="field">
        <label for="wasteType">Abfallart</label>
        <select id="wasteType" name="wasteType" required>${options}</select>
      </div>
      <div class="field">
        <label for="collectionDate">Tag der Abfuhr</label>
        <input id="collectionDate" name="collectionDate" type="date" required value="${escapeHtml(collection.collectionDate)}">
      </div>
      <div class="field">
        <label for="note">Hinweis</label>
        <span class="hint">Optional, zum Beispiel „bitte bis 6 Uhr rausstellen“.</span>
        <input id="note" name="note" maxlength="300" value="${escapeHtml(collection.note)}">
      </div>
      <div class="admin-actions">
        <button class="btn" type="submit">${id ? 'Änderungen speichern' : 'Abfuhr eintragen'}</button>
        ${id ? '<button class="btn danger" type="button" id="delete">Löschen</button>' : ''}
      </div>
    </form>`, 'muell');

  const form = document.getElementById('waste-form');
  const errorBox = document.getElementById('editor-error');

  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`„${collection.label}“ am ${collection.collectionDate} wirklich löschen?`)) return;
    await api(`/api/waste/${collection.id}`, { method: 'DELETE' });
    location.hash = '#/muell';
  });

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const body = {
      wasteType: form.wasteType.value,
      collectionDate: form.collectionDate.value,
      note: form.note.value,
    };

    try {
      if (id) await api(`/api/waste/${collection.id}`, { method: 'PUT', body });
      else await api('/api/waste', { method: 'POST', body });
      location.hash = '#/muell';
    } catch (error) {
      errorBox.innerHTML = error.status === 409
        ? `<p class="notice error">${escapeHtml(error.message)}</p>`
        : error.status === 400
          ? '<p class="notice error">Abfallart und Tag der Abfuhr müssen ausgefüllt sein.</p>'
          : '<p class="notice error">Speichern hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
      button.disabled = false;
    }
  });
}

async function viewWasteImport() {
  if (!isAdmin()) {
    render(`${pageHead('muell', 'Termine importieren')}<p class="notice">Nur Admins können Abfuhrtermine importieren.</p>`, 'muell');
    return;
  }

  render(`
    <a class="back" href="#/muell">Zurück zur Müllabfuhr</a>
    ${pageHead('muell', 'Termine importieren')}
    <p class="muted import-intro">
      Beim Landkreis Vorpommern-Rügen findest du unter „Abfallkalender“ einen Export deiner
      Abfuhrtermine. Wähle dort deinen Ort, kreuze alle Abfallarten an, wähle das Format
      <strong>ICS</strong> und lade die Datei herunter. Diese Datei kannst du hier hochladen.
      Termine, die schon eingetragen sind, werden dabei übersprungen – du kannst dieselbe
      Datei also gefahrlos ein zweites Mal hochladen.
    </p>
    <div id="import-result"></div>
    <form class="form" id="import-form">
      <div class="field">
        <label for="file">ICS-Datei</label>
        <input id="file" name="file" type="file" accept=".ics,text/calendar" required>
      </div>
      <div><button class="btn" type="submit">Datei einlesen</button></div>
    </form>`, 'muell');

  const form = document.getElementById('import-form');
  const result = document.getElementById('import-result');

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const button = form.querySelector('button');
    const file = form.file.files[0];
    if (!file) return;

    button.disabled = true;
    result.innerHTML = '<p class="muted">Die Datei wird eingelesen …</p>';

    const upload = new FormData();
    upload.append('file', file);

    try {
      const report = await api('/api/waste/import', { method: 'POST', upload });
      const unknown = report.unknownTypes.length
        ? `<p class="muted">Ohne passende Abfallart, deshalb unter „Sonstiges“ geführt:
             ${escapeHtml(report.unknownTypes.join(', '))}.</p>`
        : '';
      result.innerHTML = `
        <div class="notice">
          <p><strong>${report.imported} ${report.imported === 1 ? 'Termin' : 'Termine'} eingetragen.</strong></p>
          <p class="muted">
            ${report.found} ${report.found === 1 ? 'Eintrag' : 'Einträge'} in der Datei,
            ${report.skipped} davon übersprungen, weil es sie schon gab.
          </p>
          ${unknown}
          <p><a href="#/muell">Zur Übersicht</a></p>
        </div>`;
      form.reset();
    } catch (error) {
      result.innerHTML = error.status === 413 || error.status === 400
        ? '<p class="notice error">Mit dieser Datei kann MicroHub nichts anfangen. Erwartet wird eine ICS-Datei bis 1 MB.</p>'
        : '<p class="notice error">Der Import hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
    }
    button.disabled = false;
  });
}

// ---------- Kontakte ----------

const OTHER_CATEGORY = 'Weitere Kontakte';

/** Gruppen in der Reihenfolge, in der ihre erste Zeile kommt – so steuert die Sortierung auch die Gruppen. */
function groupByCategory(contacts) {
  const groups = new Map();
  for (const contact of contacts) {
    const category = contact.category || OTHER_CATEGORY;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(contact);
  }
  return groups;
}

/** Für tel:-Links nur Ziffern und ein führendes Plus, sonst wählen manche Handys falsch. */
const telHref = (phone) => `tel:${phone.replace(/[^\d+]/g, '')}`;

function contactHtml(contact, admin) {
  const lines = [];
  if (contact.phone) lines.push(`<a href="${escapeHtml(telHref(contact.phone))}">${escapeHtml(contact.phone)}</a>`);
  if (contact.email) lines.push(`<a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>`);
  // Die API lässt nur http(s) zu; die Prüfung hier schützt zusätzlich vor alten oder fremden Daten.
  if (contact.website && /^https?:\/\//i.test(contact.website)) {
    lines.push(`<a href="${escapeHtml(contact.website)}" target="_blank" rel="noopener">${escapeHtml(contact.website.replace(/^https?:\/\//i, ''))}</a>`);
  }
  if (contact.address) lines.push(escapeHtml(contact.address));

  return `
    <li class="contact">
      <div class="contact-head">
        <h3>${escapeHtml(contact.name)}</h3>
        ${admin && !contact.publicContact ? '<span class="tag">Nur für Mitglieder</span>' : ''}
      </div>
      ${contact.organization ? `<p class="muted">${escapeHtml(contact.organization)}</p>` : ''}
      ${lines.length ? `<p class="contact-lines">${lines.join('<br>')}</p>` : ''}
      ${contact.note ? `<p class="contact-note">${escapeHtml(contact.note)}</p>` : ''}
      ${admin ? `<a class="contact-edit" href="#/kontakte/${contact.id}/bearbeiten">Bearbeiten</a>` : ''}
    </li>`;
}

async function viewContactList() {
  const admin = isAdmin();
  const action = admin ? '<a class="btn" href="#/kontakte/neu">Kontakt anlegen</a>' : '';
  const contacts = await api('/api/contacts');

  // Gäste sehen nur die öffentlichen Kontakte und sollen wissen, dass es mehr gibt.
  const guestHint = state.user
    ? ''
    : '<p class="notice">Weitere Kontakte siehst du, wenn du <a href="#/login">angemeldet</a> bist.</p>';
  if (!state.user) state.returnTo = '#/kontakte';

  if (contacts.length === 0) {
    const emptyText = `Es sind noch keine Kontakte eingetragen.${admin ? ' Leg den ersten über „Kontakt anlegen“ an.' : ''}`;
    render(`${pageHead('kontakte', 'Kontakte', action)}${guestHint}<p class="muted">${emptyText}</p>`, 'kontakte');
    return;
  }

  const groups = [...groupByCategory(contacts)].map(([category, items]) => `
    <section class="contact-group">
      <h2>${escapeHtml(category)}</h2>
      <ul class="contact-list">${items.map((c) => contactHtml(c, admin)).join('')}</ul>
    </section>`).join('');

  render(`${pageHead('kontakte', 'Kontakte', action)}${guestHint}${groups}`, 'kontakte');
}

async function viewContactEditor(id) {
  if (!isAdmin()) {
    render(`${pageHead('kontakte', 'Kontakt anlegen')}<p class="notice">Nur Admins können Kontakte pflegen.</p>`, 'kontakte');
    return;
  }

  const empty = {
    name: '', organization: '', category: '', phone: '', email: '',
    address: '', website: '', note: '', sortOrder: 0, publicContact: false,
  };
  const [contact, all] = await Promise.all([
    id ? api(`/api/contacts/${encodeURIComponent(id)}`) : Promise.resolve(empty),
    api('/api/contacts'),
  ]);

  // Vorschläge aus den vorhandenen Kategorien, damit nicht „Notfall“ und „Notfälle“ nebeneinander stehen.
  const categories = [...new Set(all.map((c) => c.category).filter(Boolean))];
  const field = (name, label, attrs = '', hint = '') => `
    <div class="field">
      <label for="${name}">${label}</label>
      ${hint ? `<span class="hint">${hint}</span>` : ''}
      <input id="${name}" name="${name}" ${attrs} value="${escapeHtml(contact[name])}">
    </div>`;

  render(`
    <a class="back" href="#/kontakte">Abbrechen</a>
    ${pageHead('kontakte', id ? 'Kontakt bearbeiten' : 'Kontakt anlegen')}
    <div id="editor-error"></div>
    <form class="form" id="contact-form">
      ${field('name', 'Name', 'maxlength="150" required', 'Person oder Stelle, zum Beispiel „Hausmeister“ oder „Feuerwehr“.')}
      ${field('organization', 'Firma oder Behörde', 'maxlength="150"')}
      ${field('category', 'Kategorie', 'maxlength="50" list="categories"', 'Kontakte mit derselben Kategorie stehen zusammen, zum Beispiel „Notfall“.')}
      <datalist id="categories">${categories.map((c) => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
      <div class="field-row">
        ${field('phone', 'Telefon', 'type="tel" maxlength="50"')}
        ${field('email', 'E-Mail', 'type="email" maxlength="255"')}
      </div>
      ${field('website', 'Webseite', 'type="url" maxlength="300" placeholder="https://"')}
      ${field('address', 'Adresse', 'maxlength="300"')}
      ${field('note', 'Hinweis', 'maxlength="500"', 'Optional, zum Beispiel Sprechzeiten.')}
      ${field('sortOrder', 'Reihenfolge', 'type="number" step="1"', 'Kleinere Zahlen stehen weiter oben. Bei gleicher Zahl wird nach Namen sortiert.')}
      <div class="field check">
        <input id="publicContact" name="publicContact" type="checkbox" ${contact.publicContact ? 'checked' : ''}>
        <label for="publicContact">Auch für Gäste sichtbar (z. B. Notfallnummern)</label>
      </div>
      <div class="admin-actions">
        <button class="btn" type="submit">${id ? 'Änderungen speichern' : 'Kontakt anlegen'}</button>
        ${id ? '<button class="btn danger" type="button" id="delete">Löschen</button>' : ''}
      </div>
    </form>`, 'kontakte');

  const form = document.getElementById('contact-form');
  const errorBox = document.getElementById('editor-error');

  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`„${contact.name}“ wirklich löschen?`)) return;
    await api(`/api/contacts/${contact.id}`, { method: 'DELETE' });
    location.hash = '#/kontakte';
  });

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    // Über elements, weil form.name den Namen des Formulars liefert statt des Felds „name“.
    const fields = form.elements;
    const body = {
      name: fields.name.value,
      organization: fields.organization.value,
      category: fields.category.value,
      phone: fields.phone.value,
      email: fields.email.value,
      address: fields.address.value,
      website: fields.website.value,
      note: fields.note.value,
      sortOrder: Number.parseInt(fields.sortOrder.value, 10) || 0,
      publicContact: fields.publicContact.checked,
    };

    try {
      if (id) await api(`/api/contacts/${contact.id}`, { method: 'PUT', body });
      else await api('/api/contacts', { method: 'POST', body });
      location.hash = '#/kontakte';
    } catch (error) {
      errorBox.innerHTML = error.status === 400
        ? '<p class="notice error">Bitte prüfe die Angaben: Der Name muss ausgefüllt sein, die E-Mail-Adresse gültig und die Webseite mit http:// oder https:// beginnen.</p>'
        : '<p class="notice error">Speichern hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
      button.disabled = false;
    }
  });
}

// ---------- Schwarzes Brett ----------

const dayAndMonth = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' });

/** Arten und Laufzeiten kommen aus der API, damit sie nur im Backend gepflegt werden. */
let boardOptions = null;
/** Gewählter Filter bleibt beim Zurückkehren zur Liste erhalten. */
let boardFilter = 'ALLE';

async function loadBoardOptions() {
  if (!boardOptions) boardOptions = await api('/api/board/options');
  return boardOptions;
}

function loginPrompt(section) {
  state.returnTo = location.hash;
  render(`
    ${pageHead(section, SECTIONS[section].title)}
    <p class="notice">Dieser Bereich ist nur für angemeldete Mitglieder sichtbar.</p>
    <a class="btn" href="#/login">Anmelden</a>`, section);
}

/** Telefonnummer oder E-Mail werden antippbar, alles andere (z. B. „Whg. 3, 2. OG“) bleibt Text. */
function boardContactHtml(contact) {
  const value = contact.trim();
  if (/^\+?[\d\s/()-]{5,}$/.test(value)) return `<a href="${escapeHtml(telHref(value))}">${escapeHtml(value)}</a>`;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `<a href="mailto:${escapeHtml(value)}">${escapeHtml(value)}</a>`;
  return escapeHtml(value);
}

function boardCardHtml(post) {
  return `
    <li class="note" data-kind="${escapeHtml(post.kind)}">
      <span class="note-kind kind-${escapeHtml(post.kind)}">${escapeHtml(post.label)}</span>
      <h2>${escapeHtml(post.title)}</h2>
      <div class="note-body">${paragraphs(post.content)}</div>
      ${post.contact ? `<p class="note-contact"><span class="muted">Kontakt:</span> ${boardContactHtml(post.contact)}</p>` : ''}
      <p class="note-meta">
        ${escapeHtml(post.authorName)} · hängt bis ${dayAndMonth.format(new Date(post.expiresAt))}
      </p>
      ${post.editable ? `<a class="note-edit" href="#/brett/${post.id}/bearbeiten">Bearbeiten</a>` : ''}
    </li>`;
}

async function viewBoardList() {
  if (!state.user) {
    loginPrompt('brett');
    return;
  }

  const [options, posts] = await Promise.all([loadBoardOptions(), api('/api/board')]);
  const action = '<a class="btn" href="#/brett/neu">Aushang schreiben</a>';

  if (posts.length === 0) {
    render(`
      ${pageHead('brett', 'Schwarzes Brett', action)}
      <p class="muted">Am Brett hängt gerade nichts. Du suchst oder bietest etwas? Schreib den ersten Aushang.</p>`, 'brett');
    return;
  }

  const filters = [{ value: 'ALLE', label: 'Alle' }, ...options.kinds].map((kind) => `
    <button type="button" class="filter" data-filter="${escapeHtml(kind.value)}"
            aria-pressed="${kind.value === boardFilter}">${escapeHtml(kind.label)}</button>`).join('');

  render(`
    ${pageHead('brett', 'Schwarzes Brett', action)}
    <div class="filters" role="group" aria-label="Nach Art filtern">${filters}</div>
    <p class="muted" id="board-empty" hidden>Zu dieser Art hängt gerade nichts.</p>
    <ul class="board" id="board">${posts.map(boardCardHtml).join('')}</ul>`, 'brett');

  // Gefiltert wird im Browser: alle Aushänge sind schon geladen, das spart Anfragen.
  const applyFilter = () => {
    let visible = 0;
    document.querySelectorAll('#board .note').forEach((note) => {
      note.hidden = boardFilter !== 'ALLE' && note.dataset.kind !== boardFilter;
      if (!note.hidden) visible += 1;
    });
    document.querySelectorAll('.filter').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === boardFilter));
    });
    document.getElementById('board-empty').hidden = visible > 0;
  };

  document.querySelector('.filters').addEventListener('click', (clickEvent) => {
    const button = clickEvent.target.closest('.filter');
    if (!button) return;
    boardFilter = button.dataset.filter;
    applyFilter();
  });
  applyFilter();
}

async function viewBoardEditor(id) {
  if (!state.user) {
    loginPrompt('brett');
    return;
  }

  const options = await loadBoardOptions();
  const post = id
    ? await api(`/api/board/${encodeURIComponent(id)}`)
    : { kind: options.kinds[0].value, title: '', content: '', contact: '', editable: true };

  if (!post.editable) {
    render(`${pageHead('brett', 'Aushang bearbeiten')}<p class="notice">Diesen Aushang können nur die Person, die ihn geschrieben hat, und Admins ändern.</p>`, 'brett');
    return;
  }

  const kinds = options.kinds.map((kind) => `
    <label class="choice">
      <input type="radio" name="kind" value="${escapeHtml(kind.value)}" ${kind.value === post.kind ? 'checked' : ''}>
      <span>${escapeHtml(kind.label)}</span>
    </label>`).join('');

  const durations = options.durations.map((days) => `
    <option value="${days}" ${days === options.defaultDuration ? 'selected' : ''}>${days} Tage</option>`).join('');

  const durationHint = id
    ? `Hängt bisher bis ${escapeHtml(fullDate.format(new Date(post.expiresAt)))}. Beim Speichern wird die Laufzeit ab heute neu gerechnet.`
    : 'Danach verschwindet der Aushang von selbst.';

  render(`
    <a class="back" href="#/brett">Abbrechen</a>
    ${pageHead('brett', id ? 'Aushang bearbeiten' : 'Aushang schreiben')}
    <div id="editor-error"></div>
    <form class="form" id="board-form">
      <fieldset class="field">
        <legend>Art</legend>
        <div class="choices">${kinds}</div>
      </fieldset>
      <div class="field">
        <label for="title">Überschrift</label>
        <input id="title" name="title" maxlength="200" required value="${escapeHtml(post.title)}">
      </div>
      <div class="field">
        <label for="content">Text</label>
        <textarea id="content" name="content" maxlength="5000" required>${escapeHtml(post.content)}</textarea>
      </div>
      <div class="field">
        <label for="contact">Kontakt</label>
        <span class="hint">Optional. Wie man dich erreicht, zum Beispiel Telefonnummer, E-Mail oder „Whg. 3, 2. OG“. Sehen alle angemeldeten Mitglieder.</span>
        <input id="contact" name="contact" maxlength="200" value="${escapeHtml(post.contact)}">
      </div>
      <div class="field">
        <label for="durationDays">Wie lange soll der Aushang hängen?</label>
        <span class="hint">${durationHint}</span>
        <select id="durationDays" name="durationDays">${durations}</select>
      </div>
      <div class="admin-actions">
        <button class="btn" type="submit">${id ? 'Änderungen speichern' : 'Aushang aufhängen'}</button>
        ${id ? '<button class="btn danger" type="button" id="delete">Abnehmen</button>' : ''}
      </div>
    </form>`, 'brett');

  const form = document.getElementById('board-form');
  const errorBox = document.getElementById('editor-error');

  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`„${post.title}“ wirklich abnehmen? Der Aushang wird gelöscht.`)) return;
    await api(`/api/board/${post.id}`, { method: 'DELETE' });
    location.hash = '#/brett';
  });

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const fields = form.elements;
    const body = {
      kind: fields.kind.value,
      title: fields.title.value,
      content: fields.content.value,
      contact: fields.contact.value,
      durationDays: Number(fields.durationDays.value),
    };

    try {
      if (id) await api(`/api/board/${post.id}`, { method: 'PUT', body });
      else await api('/api/board', { method: 'POST', body });
      location.hash = '#/brett';
    } catch (error) {
      errorBox.innerHTML = error.status === 400
        ? '<p class="notice error">Überschrift und Text müssen ausgefüllt sein.</p>'
        : error.status === 403
          ? `<p class="notice error">${escapeHtml(error.message)}</p>`
          : '<p class="notice error">Speichern hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
      button.disabled = false;
    }
  });
}

// ---------- Fehler ----------

function viewError(error, section) {
  if (error instanceof ApiError && error.status === 401) {
    state.returnTo = location.hash;
    render(`<p class="notice">Bitte melde dich an, um diese Seite zu sehen.</p><a class="btn" href="#/login">Anmelden</a>`, section);
  } else if (error instanceof ApiError && error.status === 404) {
    render(`<p class="notice">Diesen Eintrag gibt es nicht mehr.</p><a href="#/${section || 'news'}">Zur Übersicht</a>`, section);
  } else {
    console.error(error);
    render(`<p class="notice error">Der Server antwortet gerade nicht. Lade die Seite neu oder versuche es in ein paar Minuten noch einmal.</p>`, section);
  }
}

// ---------- Router ----------

async function route() {
  const [section = 'news', first, second] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  setActiveTab(section === 'login' ? null : section);

  try {
    if (section === 'login') viewLogin();
    else if (section === 'news' && !first) await viewNewsList();
    else if (section === 'news' && first === 'neu') await viewNewsEditor();
    else if (section === 'news' && second === 'bearbeiten') await viewNewsEditor(first);
    else if (section === 'news') await viewNewsDetail(first);
    else if (section === 'termine' && !first) await viewEventList(false);
    else if (section === 'termine' && first === 'vergangen') await viewEventList(true);
    else if (section === 'termine' && first === 'neu') await viewEventEditor();
    else if (section === 'termine' && second === 'bearbeiten') await viewEventEditor(first);
    else if (section === 'termine') await viewEventDetail(first);
    else if (section === 'muell' && !first) await viewWasteList(false);
    else if (section === 'muell' && first === 'vergangen') await viewWasteList(true);
    else if (section === 'muell' && first === 'neu') await viewWasteEditor();
    else if (section === 'muell' && first === 'import') await viewWasteImport();
    else if (section === 'muell' && second === 'bearbeiten') await viewWasteEditor(first);
    else if (section === 'kontakte' && !first) await viewContactList();
    else if (section === 'kontakte' && first === 'neu') await viewContactEditor();
    else if (section === 'kontakte' && second === 'bearbeiten') await viewContactEditor(first);
    else if (section === 'brett' && !first) await viewBoardList();
    else if (section === 'brett' && first === 'neu') await viewBoardEditor();
    else if (section === 'brett' && second === 'bearbeiten') await viewBoardEditor(first);
    else location.hash = '#/news';
  } catch (error) {
    viewError(error, section);
  }

  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

window.addEventListener('hashchange', route);

try {
  await loadUser();
} catch {
  renderAccount();
}
route();
