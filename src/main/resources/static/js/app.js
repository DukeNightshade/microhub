import { api, ApiError } from './api.js';

const SECTIONS = {
  news:     { title: 'News',            color: '--c-news' },
  termine:  { title: 'Termine',         color: '--c-events' },
  muell:    { title: 'Müllabfuhr',      color: '--c-waste' },
  kontakte: { title: 'Kontakte',        color: '--c-contacts', loginRequired: true },
  brett:    { title: 'Schwarzes Brett', color: '--c-board',    loginRequired: true },
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

// ---------- Bereiche, die noch gebaut werden ----------

function viewPlaceholder(section) {
  const { title, loginRequired } = SECTIONS[section];
  if (loginRequired && !state.user) {
    state.returnTo = `#/${section}`;
    render(`
      ${pageHead(section, title)}
      <p class="notice">Dieser Bereich ist nur für angemeldete Mitglieder sichtbar.</p>
      <a class="btn" href="#/login">Anmelden</a>`, section);
    return;
  }
  render(`${pageHead(section, title)}<p class="muted">Dieser Bereich wird gerade gebaut.</p>`, section);
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
    else if (SECTIONS[section]) viewPlaceholder(section);
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
