import { api, ApiError } from './api.js';

const SECTIONS = {
  start:    { title: 'Start',           color: '--ink' },
  news:     { title: 'News',            color: '--c-news' },
  kalender: { title: 'Kalender',        color: '--c-events' },
  kontakte: { title: 'Kontakte',        color: '--c-contacts' },
  brett:    { title: 'Schwarzes Brett', color: '--c-board' },
  // ohne eigenen Tab, erreichbar über die Kopfzeile
  konto:        { title: 'Mein Konto',    color: '--ink' },
  verwaltung:   { title: 'Verwaltung',    color: '--ink' },
  registrieren: { title: 'Registrieren',  color: '--ink' },
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

/** Kalender und Brett brauchen am Desktop mehr Platz als Textseiten. */
const WIDE_SECTIONS = new Set(['start', 'kalender', 'brett']);

function render(html, section) {
  main.style.setProperty('--sec', `var(${SECTIONS[section]?.color ?? '--ink'})`);
  main.classList.toggle('wide', WIDE_SECTIONS.has(section));
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
      ${isAdmin() ? '<a class="who" href="#/verwaltung">Verwaltung</a>' : ''}
      <a class="who" href="#/konto" title="Mein Konto">${escapeHtml(state.user.displayName)}</a>
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
    </form>
    <p class="form-aside">Neu hier? <a href="#/registrieren">Mit Freischaltcode registrieren</a></p>
    <p class="form-aside muted">Passwort vergessen? Wer MicroHub betreut, kann es für dich zurücksetzen.</p>`, 'news');

  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await api('/api/auth/login', { method: 'POST', form: Object.fromEntries(new FormData(form)) });
      await loadUser(); // holt nach dem Login ein neues CSRF-Token
      location.hash = state.user?.mustChangePassword ? '#/konto' : state.returnTo || '#/start';
      state.returnTo = null;
    } catch (error) {
      // Die API unterscheidet bewusst nicht zwischen falschem Passwort und gesperrtem Konto.
      document.getElementById('login-error').innerHTML = error.status === 401
        ? '<p class="notice error">Benutzername oder Passwort stimmt nicht. Falls dein Konto gesperrt wurde, wende dich an die Person, die MicroHub betreut.</p>'
        : '<p class="notice error">Anmelden hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
      button.disabled = false;
    }
  });
}

// ---------- Startseite ----------

const startHeading = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const badgeDay = new Intl.DateTimeFormat('de-DE', { day: 'numeric' });
const badgeMonth = new Intl.DateTimeFormat('de-DE', { month: 'short' });
const shortDay = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

const daysFromToday = (isoDate) => Math.round((fromIsoDay(isoDate) - fromIsoDay(isoDay(new Date()))) / 86_400_000);

/** „Heute“, „Morgen“, „Übermorgen“, sonst nur der Wochentag – das Datum steht jeweils daneben. */
function dayName(isoDate) {
  return ['Heute', 'Morgen', 'Übermorgen'][daysFromToday(isoDate)] ?? weekdayLong.format(fromIsoDay(isoDate));
}

/** Für enge Zeilen: „Morgen“ bzw. „Do., 5. Nov.“ */
function shortDayLabel(isoDate) {
  return daysFromToday(isoDate) <= 2 ? dayName(isoDate) : shortDay.format(fromIsoDay(isoDate));
}

function homeSectionHead(title, href, linkText) {
  return `<div class="home-section-head"><h2>${title}</h2><a href="${href}">${linkText}</a></div>`;
}

/**
 * Der nächste Abfuhrtag groß, die beiden folgenden klein darunter. Abfallarten, die jemand im
 * Kalender ausgeblendet hat (z. B. weil der Haushalt keine Biotonne hat), fehlen auch hier.
 */
function homeWasteHtml(entries) {
  const hidden = new Set(readStored(CALENDAR_HIDDEN_KEY, []));
  const days = new Map();
  for (const entry of entries) {
    if (entry.type !== 'WASTE' || hidden.has(entry.category)) continue;
    if (!days.has(entry.date)) days.set(entry.date, []);
    days.get(entry.date).push(entry);
  }
  const [first, ...rest] = [...days].slice(0, 3);
  const filterHint = [...hidden].some((category) => category !== 'EVENT')
    ? '<p class="home-hint">Abfallarten, die du im Kalender ausgeblendet hast, erscheinen hier nicht.</p>'
    : '';

  if (!first) {
    return `
      <section class="home-panel home-waste">
        ${homeSectionHead('Nächste Müllabfuhr', '#/kalender', 'Zum Kalender')}
        <p class="muted">In den nächsten Wochen ist keine Abfuhr eingetragen.</p>
        ${filterHint}
      </section>`;
  }

  const [day, items] = first;
  const inDays = daysFromToday(day);
  return `
    <section class="home-panel home-waste">
      ${homeSectionHead('Nächste Müllabfuhr', '#/kalender', 'Zum Kalender')}
      <p class="home-waste-day">${escapeHtml(dayName(day))}</p>
      <p class="home-waste-date">${escapeHtml(dayMonth.format(fromIsoDay(day)))}${inDays > 2 ? `, in ${inDays} Tagen` : ''}</p>
      <ul class="home-waste-kinds">
        ${items.map((entry) => `<li>${categoryMark(entry.category)}${escapeHtml(entry.title)}</li>`).join('')}
      </ul>
      ${rest.length ? `
        <ul class="home-waste-next">
          ${rest.map(([nextDay, nextItems]) => `
            <li><span>${escapeHtml(shortDayLabel(nextDay))}</span>
              <span>${nextItems.map((entry) => `${categoryMark(entry.category)}${escapeHtml(entry.title)}`).join(' ')}</span></li>`).join('')}
        </ul>` : ''}
      ${filterHint}
    </section>`;
}

function homeEventsHtml(entries) {
  const events = entries.filter((entry) => entry.type === 'EVENT').slice(0, 3);
  const list = events.length
    ? `<ul class="home-events-list">${events.map((event) => {
      const start = new Date(event.startsAt);
      const href = event.newsId ? `#/news/${event.newsId}` : `#/kalender/termin/${event.id}`;
      return `
        <li><a href="${href}">
          <span class="home-date"><span>${badgeDay.format(start)}</span>${escapeHtml(badgeMonth.format(start))}</span>
          <span><strong>${escapeHtml(event.title)}</strong>
            <span class="cal-sub">${escapeHtml(dayName(event.date))}, ${escapeHtml(eventWhenShort(event))}${event.location ? `, ${escapeHtml(event.location)}` : ''}</span></span>
        </a></li>`;
    }).join('')}</ul>`
    : '<p class="muted">In den nächsten Wochen stehen keine Termine an.</p>';
  return `
    <section class="home-panel home-events">
      ${homeSectionHead('Demnächst', '#/kalender/liste', 'Alle Termine')}
      ${list}
    </section>`;
}

function homeNewsHtml(items) {
  const [lead, ...rest] = items.slice(0, 3);
  return `
    <section class="home-news">
      ${homeSectionHead('Neuigkeiten', '#/news', 'Alle News')}
      ${lead
        ? `${newsLeadHtml(lead)}<ol class="news-list">${rest.map(newsItemHtml).join('')}</ol>`
        : '<p class="muted">Hier erscheinen Neuigkeiten aus dem Haus.</p>'}
    </section>`;
}

/** Was im Haus ansteht, auf einen Blick: Müll, Termine, Neuigkeiten. Ein Abruf je Quelle. */
async function viewStart() {
  const today = new Date();
  const [entries, news] = await Promise.all([
    api(`/api/calendar?from=${isoDay(today)}&to=${isoDay(addDays(today, 60))}`),
    api('/api/news?page=0'),
  ]);

  render(`
    ${pageHead('start', startHeading.format(today))}
    <div class="home">
      ${homeWasteHtml(entries)}
      ${homeEventsHtml(entries)}
      ${homeNewsHtml(news.items)}
    </div>`, 'start');
}

// ---------- News ----------

/** Kurzer Termin-Hinweis für die News-Liste, z. B. „Termin: Sa, 31. Okt., 15:00 Uhr“. */
const eventBadgeDate = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

const dayMonth = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' });

/** „Heute“, „Gestern“, ein Wochentag in der letzten Woche, sonst das Datum – so liest man schneller. */
function relativeDay(iso) {
  const date = new Date(iso);
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (days === 0) return 'Heute';
  if (days === 1) return 'Gestern';
  if (days > 1 && days < 7) return weekdayLong.format(date);
  return date.getFullYear() === new Date().getFullYear() ? dayMonth.format(date) : fullDate.format(date);
}

function newsEventBadge(item) {
  if (!item.event) return '';
  const start = new Date(item.event.startsAt);
  return `
    <p class="news-event"><span class="cal-mark" aria-hidden="true"></span>Termin:
      ${escapeHtml(eventBadgeDate.format(start))}${item.event.allDay ? '' : `, ${timeOnly.format(start)} Uhr`}</p>`;
}

/** Die neueste Meldung steht groß oben, damit man sofort sieht, was gerade los ist. */
function newsLeadHtml(item) {
  // Das Titelbild in voller Größe: der Aufmacher ist breit, das Vorschaubild wäre dort unscharf.
  const cover = item.cover ? `
    <img class="news-lead-cover" src="${escapeHtml(item.cover.url)}" alt=""
         width="${item.cover.width}" height="${item.cover.height}">` : '';
  return `
    <a class="news-lead ${item.cover ? 'has-cover' : ''}" href="#/news/${item.id}">
      ${cover}
      <h2>${escapeHtml(item.title)}</h2>
      ${item.summary ? `<p class="news-lead-summary">${escapeHtml(item.summary)}</p>` : ''}
      ${newsEventBadge(item)}
      <p class="news-meta"><time datetime="${escapeHtml(item.publishedAt)}">${relativeDay(item.publishedAt)}</time>${item.author ? `, von ${escapeHtml(item.author)}` : ''}</p>
    </a>`;
}

function newsItemHtml(item) {
  return `
    <li>
      <a class="news-item ${item.cover ? 'has-thumb' : ''}" href="#/news/${item.id}">
        <div class="news-text">
          <h2>${escapeHtml(item.title)}</h2>
          ${item.summary ? `<p class="news-summary">${escapeHtml(item.summary)}</p>` : ''}
          ${newsEventBadge(item)}
          <p class="news-meta"><time datetime="${escapeHtml(item.publishedAt)}">${relativeDay(item.publishedAt)}</time>${item.author ? `, von ${escapeHtml(item.author)}` : ''}</p>
        </div>
        ${item.cover ? `<img class="news-thumb" src="${escapeHtml(item.cover.thumbUrl)}" alt="" loading="lazy">` : ''}
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
      <p class="muted">Hier erscheinen Neuigkeiten aus dem Haus.${isAdmin() ? ' Schreib die erste über „News schreiben“.' : ' Bisher gibt es noch keine.'}</p>`, 'news');
    return;
  }

  const [lead, ...rest] = data.items;
  render(`
    ${pageHead('news', 'News', action)}
    ${newsLeadHtml(lead)}
    <ol class="news-list" id="news-list">${rest.map(newsItemHtml).join('')}</ol>
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
  const [cover, ...more] = news.photos;

  render(`
    <a class="back" href="#/news">Alle News</a>
    <article>
      ${pageHead('news', news.title)}
      <p class="article-meta">
        ${fullDate.format(new Date(news.publishedAt))}${news.author ? `, von ${escapeHtml(news.author)}` : ''}${edited ? ' (bearbeitet)' : ''}
      </p>
      ${cover ? `
        <button type="button" class="article-cover" data-photo="0" aria-label="Titelbild groß ansehen">
          <img src="${escapeHtml(cover.url)}" alt="" width="${cover.width}" height="${cover.height}">
        </button>` : ''}
      ${news.event ? `
        <div class="event-box">
          <span class="cal-mark" aria-hidden="true"></span>
          <div>
            <p><strong>Termin:</strong> ${escapeHtml(eventWhenLong(news.event))}</p>
            ${news.event.location ? `<p>${escapeHtml(news.event.location)}</p>` : ''}
            <p><a href="#/kalender/monat/${isoDay(new Date(news.event.startsAt)).slice(0, 7)}">Im Kalender ansehen</a></p>
          </div>
        </div>` : ''}
      ${news.summary ? `<p class="article-summary">${escapeHtml(news.summary)}</p>` : ''}
      <div class="article-body">${paragraphs(news.content)}</div>
      ${more.length ? `
        <ul class="article-gallery" aria-label="Weitere Bilder">
          ${more.map((photo, i) => `
            <li><button type="button" data-photo="${i + 1}" aria-label="Bild ${i + 2} groß ansehen">
              <img src="${escapeHtml(photo.thumbUrl)}" alt="" loading="lazy">
            </button></li>`).join('')}
        </ul>` : ''}
    </article>
    ${isAdmin() ? `
      <div class="admin-actions">
        <a class="btn secondary" href="#/news/${news.id}/bearbeiten">Bearbeiten</a>
        <button class="btn danger" type="button" id="delete">Löschen</button>
      </div>` : ''}`, 'news');

  // Titelbild und Galerie öffnen dieselbe Großansicht, jeweils beim angeklickten Bild.
  main.querySelector('article').addEventListener('click', (clickEvent) => {
    const button = clickEvent.target.closest('[data-photo]');
    if (button) openLightbox(news.photos, Number(button.dataset.photo));
  });

  document.getElementById('delete')?.addEventListener('click', async () => {
    const question = news.event
      ? `„${news.title}“ wirklich löschen? Der zugehörige Termin verschwindet auch aus dem Kalender.`
      : `„${news.title}“ wirklich löschen?`;
    if (!confirm(question)) return;
    await api(`/api/news/${news.id}`, { method: 'DELETE' });
    location.hash = '#/news';
  });
}

async function viewNewsEditor(id) {
  if (!isAdmin()) {
    render(`${pageHead('news', 'News schreiben')}<p class="notice">Nur Admins können News schreiben und bearbeiten.</p>`, 'news');
    return;
  }

  const news = id ? await api(`/api/news/${encodeURIComponent(id)}`) : { title: '', summary: '', content: '', photos: [] };

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
      ${photoFieldHtml('Bilder')}
      <fieldset class="event-fieldset">
        <div class="field check">
          <input id="withEvent" type="checkbox" ${news.event ? 'checked' : ''}>
          <label for="withEvent">Termin im Kalender eintragen</label>
        </div>
        <div id="event-fields" ${news.event ? '' : 'hidden'}>
          <p class="hint">Der Termin bekommt den Titel dieses Beitrags und führt im Kalender hierher.</p>
          ${eventFieldsHtml(news.event ?? { location: '', startsAt: null, endsAt: null, allDay: false })}
        </div>
      </fieldset>
      <div><button class="btn" type="submit">${id ? 'Änderungen speichern' : 'Veröffentlichen'}</button></div>
    </form>`, 'news');

  const form = document.getElementById('news-form');
  const errorBox = document.getElementById('editor-error');
  const withEvent = document.getElementById('withEvent');
  const eventFields = document.getElementById('event-fields');
  const photos = enablePhotoPicker({ existing: news.photos, max: 5, errorBox, place: 'in einen Beitrag', firstIsCover: true });
  enableAllDayToggle(form);

  withEvent.addEventListener('change', () => {
    eventFields.hidden = !withEvent.checked;
    form.elements.startsAt.required = withEvent.checked;
  });
  form.elements.startsAt.required = withEvent.checked;

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const fields = form.elements;
    const event = withEvent.checked ? readEventFields(form) : null;
    if (event?.endsAt && event.endsAt < event.startsAt) {
      errorBox.innerHTML = '<p class="notice error">Das Ende des Termins darf nicht vor dem Beginn liegen.</p>';
      return;
    }
    if (id && news.event && !event && !confirm('Der Termin wird aus dem Kalender entfernt. Fortfahren?')) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const body = { title: fields.title.value, summary: fields.summary.value, content: fields.content.value, event };
    let saved;
    try {
      saved = id
        ? await api(`/api/news/${news.id}`, { method: 'PUT', body })
        : await api('/api/news', { method: 'POST', body });
    } catch (error) {
      errorBox.innerHTML = error.status === 400
        ? `<p class="notice error">Titel und Text dürfen nicht leer sein${event ? ', und der Termin braucht einen Beginn' : ''}.</p>`
        : '<p class="notice error">Speichern hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
      button.disabled = false;
      return;
    }

    // Der Text ist gespeichert; jetzt die Bilder. Scheitert eins, bleibt der Beitrag trotzdem bestehen.
    try {
      await photos.save(`/api/news/${saved.id}/photos`);
      location.hash = `#/news/${saved.id}`;
    } catch {
      // Der Knopf bleibt gesperrt: ein zweites Absenden würde einen neuen Beitrag doppelt anlegen.
      errorBox.innerHTML = `
        <p class="notice error">Der Beitrag ist gespeichert, aber nicht alle Bilder konnten hochgeladen werden.
          <a href="#/news/${saved.id}/bearbeiten">Bilder noch einmal versuchen</a></p>`;
    }
  });
}

// ---------- Kalender (Termine und Müllabfuhr) ----------

const sameDay = (a, b) => a.toDateString() === b.toDateString();

/** Volle Zeitangabe für Detailansichten, in ganzen Worten. */
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

/** Kurze Zeitangabe für Listen – der Tag steht dort schon als Überschrift. */
function eventWhenShort(event) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;

  if (event.allDay) {
    return end && !sameDay(start, end) ? `ganztägig bis ${fullDate.format(end)}` : 'ganztägig';
  }
  if (end && sameDay(start, end)) return `${timeOnly.format(start)} bis ${timeOnly.format(end)} Uhr`;
  return `${timeOnly.format(start)} Uhr`;
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

/** Felder für Beginn, Ende, Ganztägig und Ort – im Termin-Formular und im News-Formular. */
function eventFieldsHtml(event) {
  const type = event.allDay ? 'date' : 'datetime-local';
  return `
    <div class="field">
      <label for="location">Ort</label>
      <span class="hint">Optional, zum Beispiel „Innenhof“ oder „Gemeindesaal“.</span>
      <input id="location" name="location" maxlength="200" value="${escapeHtml(event.location)}">
    </div>
    <div class="field check">
      <input id="allDay" name="allDay" type="checkbox" ${event.allDay ? 'checked' : ''}>
      <label for="allDay">Ganztägig – ohne Uhrzeit</label>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="startsAt">Beginn</label>
        <input id="startsAt" name="startsAt" type="${type}" value="${toInputValue(event.startsAt, event.allDay)}">
      </div>
      <div class="field">
        <label for="endsAt">Ende</label>
        <span class="hint">Optional.</span>
        <input id="endsAt" name="endsAt" type="${type}" value="${toInputValue(event.endsAt, event.allDay)}">
      </div>
    </div>`;
}

/** Das Häkchen „Ganztägig“ schaltet Beginn und Ende zwischen Datum und Datum+Uhrzeit um. */
function enableAllDayToggle(form) {
  form.elements.allDay.addEventListener('change', () => {
    const isFullDay = form.elements.allDay.checked;
    [form.elements.startsAt, form.elements.endsAt].forEach((field) => {
      const dateOnly = field.value.slice(0, 10);
      field.type = isFullDay ? 'date' : 'datetime-local';
      // Ohne Uhrzeit verwirft der Browser den Wert eines datetime-local-Feldes.
      field.value = dateOnly ? (isFullDay ? dateOnly : `${dateOnly}T09:00`) : '';
    });
  });
}

/** Liest die Termin-Felder aus; null, wenn der Beginn fehlt. */
function readEventFields(form) {
  const allDay = form.elements.allDay.checked;
  return {
    location: form.elements.location.value,
    startsAt: toInstant(form.elements.startsAt.value, allDay),
    endsAt: toInstant(form.elements.endsAt.value, allDay),
    allDay,
  };
}

const weekdayAndDate = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const dayHeading = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const monthTitle = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

/** Die Abfallarten kommen aus der API, damit Beschriftung und Reihenfolge nur einmal gepflegt werden. */
let wasteTypes = null;

async function loadWasteTypes() {
  if (!wasteTypes) wasteTypes = await api('/api/waste/types');
  return wasteTypes;
}

/** Tag als „2026-10-31“ in Ortszeit – so liefert die API auch das Feld date. */
function isoDay(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const fromIsoDay = (value) => new Date(`${value}T00:00`);

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// Merkt sich die ausgeblendeten Kategorien pro Browser. Ohne Speicher (privates Fenster)
// funktioniert alles weiter, nur eben ohne Erinnerung.
const CALENDAR_HIDDEN_KEY = 'microhub.calendarHidden';

function readStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function writeStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* nicht schlimm */ }
}

/** Farbiges Zeichen pro Kategorie: Termine als Quadrat, Müll als Punkt in Tonnenfarbe. */
function categoryMark(category) {
  return category === 'EVENT'
    ? '<span class="cal-mark" aria-hidden="true"></span>'
    : `<span class="waste-dot wt-${escapeHtml(category)}" aria-hidden="true"></span>`;
}

function calendarEntryHtml(entry, admin) {
  if (entry.type === 'EVENT') {
    const href = entry.newsId ? `#/news/${entry.newsId}` : `#/kalender/termin/${entry.id}`;
    const where = entry.location ? `, ${escapeHtml(entry.location)}` : '';
    return `
      <li class="cal-entry" data-category="EVENT">
        <a class="cal-row" href="${href}">
          ${categoryMark('EVENT')}
          <span><strong>${escapeHtml(entry.title)}</strong>
            <span class="cal-sub">${escapeHtml(eventWhenShort(entry))}${where}</span></span>
        </a>
      </li>`;
  }
  const inner = `
    ${categoryMark(entry.category)}
    <span>${escapeHtml(entry.title)}${entry.note ? `<span class="cal-sub">${escapeHtml(entry.note)}</span>` : ''}</span>`;
  // Admins kommen über die Zeile direkt ins Formular, alle anderen lesen nur.
  return `
    <li class="cal-entry" data-category="${escapeHtml(entry.category)}">
      ${admin ? `<a class="cal-row" href="#/kalender/muell/${entry.id}/bearbeiten">${inner}</a>` : `<div class="cal-row">${inner}</div>`}
    </li>`;
}

/** Einträge nach Tag gruppiert; die Reihenfolge der Tage kommt aus der übergebenen Liste. */
function calendarDaysHtml(entries, admin) {
  const days = new Map();
  for (const entry of entries) {
    if (!days.has(entry.date)) days.set(entry.date, []);
    days.get(entry.date).push(entry);
  }
  const today = isoDay(new Date());
  return [...days].map(([day, items]) => `
    <section class="cal-day" data-day="${day}">
      <h2>${day === today ? 'Heute, ' : ''}${escapeHtml(dayHeading.format(fromIsoDay(day)))}</h2>
      <ul class="cal-entries">${items.map((entry) => calendarEntryHtml(entry, admin)).join('')}</ul>
    </section>`).join('');
}

/** Kopf mit Admin-Knöpfen, Umschalter Liste/Monat und den Filter-Chips. */
async function calendarHeadHtml(view) {
  const types = await loadWasteTypes();
  const hidden = new Set(readStored(CALENDAR_HIDDEN_KEY, []));
  const actions = isAdmin() ? `
    <div class="head-actions">
      <a class="btn" href="#/kalender/termin/neu">Termin eintragen</a>
      <a class="btn secondary" href="#/kalender/muell/neu">Abfuhr eintragen</a>
      <a class="btn secondary" href="#/kalender/muell/import">Abfuhrtermine importieren</a>
    </div>` : '';
  const chips = [{ value: 'EVENT', label: 'Termine' }, ...types].map((type) => `
    <button type="button" class="filter chip" data-category="${escapeHtml(type.value)}"
            aria-pressed="${!hidden.has(type.value)}">${categoryMark(type.value)}${escapeHtml(type.label)}</button>`).join('');
  return `
    ${pageHead('kalender', 'Kalender', actions)}
    <div class="cal-toolbar">
      <nav class="segmented" aria-label="Ansicht">
        <a href="#/kalender/monat" ${view === 'monat' ? 'aria-current="page"' : ''}>Kalender</a>
        <a href="#/kalender/liste" ${view === 'liste' ? 'aria-current="page"' : ''}>Liste</a>
      </nav>
      <div class="filters" role="group" aria-label="Was soll angezeigt werden?">${chips}</div>
    </div>`;
}

/**
 * Blendet ausgeschaltete Kategorien aus – in Listen, Tagesgruppen und Monatsraster.
 * onChange läuft danach, z. B. um „Nichts gefunden“-Hinweise zu aktualisieren.
 */
function enableCalendarFilter(onChange = () => {}) {
  const apply = () => {
    const hidden = new Set(readStored(CALENDAR_HIDDEN_KEY, []));
    document.querySelectorAll('.cal-entry, .cal-dot').forEach((el) => {
      el.hidden = hidden.has(el.dataset.category);
    });
    document.querySelectorAll('.cal-day').forEach((day) => {
      day.hidden = !day.querySelector('.cal-entry:not([hidden])');
    });
    document.querySelectorAll('.filter.chip').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(!hidden.has(chip.dataset.category)));
    });
    onChange();
  };

  document.querySelector('.filters').addEventListener('click', (clickEvent) => {
    const chip = clickEvent.target.closest('.filter.chip');
    if (!chip) return;
    const hidden = new Set(readStored(CALENDAR_HIDDEN_KEY, []));
    if (hidden.has(chip.dataset.category)) hidden.delete(chip.dataset.category);
    else hidden.add(chip.dataset.category);
    writeStored(CALENDAR_HIDDEN_KEY, [...hidden]);
    apply();
  });
  apply();
  return apply;
}

/** Der Reiter öffnet immer das Monatsraster; die Liste gibt es über den Umschalter (Entscheidung 26.10.2026). */
function viewCalendar() {
  location.replace('#/kalender/monat');
}

/** Liste nach Tagen: kommend (vorwärts) oder vergangen (rückwärts), jeweils in 8-Wochen-Schritten. */
async function viewCalendarList(past) {
  const admin = isAdmin();
  const CHUNK = 56;
  const today = new Date();
  let from = past ? addDays(today, -CHUNK) : today;
  let to = past ? addDays(today, -1) : addDays(today, CHUNK - 1);

  const load = async () => {
    const entries = await api(`/api/calendar?from=${isoDay(from)}&to=${isoDay(to)}`);
    return past ? entries.reverse() : entries;
  };

  const toggle = past
    ? '<p class="list-switch"><a href="#/kalender/liste">Zu den kommenden Einträgen</a></p>'
    : '<p class="list-switch"><a href="#/kalender/vergangen">Vergangene Einträge ansehen</a></p>';
  const moreLabel = past ? 'Ältere Einträge laden' : 'Spätere Einträge laden';

  const head = await calendarHeadHtml('liste');
  const first = await load();
  render(`
    ${head}
    ${toggle}
    <p class="muted" id="cal-empty" hidden></p>
    <div id="cal-list">${calendarDaysHtml(first, admin)}</div>
    <div class="more"><button class="btn secondary" type="button" id="more">${moreLabel}</button></div>`, 'kalender');

  const updateEmpty = () => {
    const anyVisible = document.querySelector('#cal-list .cal-entry:not([hidden])');
    const box = document.getElementById('cal-empty');
    box.hidden = Boolean(anyVisible);
    box.textContent = past
      ? 'In den letzten Wochen gab es dazu keine Einträge.'
      : 'In den nächsten Wochen steht dazu nichts an.';
  };
  const applyFilter = enableCalendarFilter(updateEmpty);

  document.getElementById('more').addEventListener('click', async (clickEvent) => {
    const button = clickEvent.target;
    button.disabled = true;
    if (past) {
      to = addDays(from, -1);
      from = addDays(to, -(CHUNK - 1));
    } else {
      from = addDays(to, 1);
      to = addDays(from, CHUNK - 1);
    }
    const next = await load();
    document.getElementById('cal-list').insertAdjacentHTML('beforeend', calendarDaysHtml(next, admin));
    applyFilter();
    button.disabled = false;
  });
}

/** Monatsraster Mo–So mit farbigen Zeichen; ein Klick auf einen Tag zeigt dessen Einträge darunter. */
async function viewCalendarMonth(yearMonth) {
  const admin = isAdmin();
  const now = new Date();
  const [year, month] = /^\d{4}-\d{2}$/.test(yearMonth ?? '')
    ? yearMonth.split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);
  // Das Raster beginnt am Montag vor dem Ersten und endet am Sonntag nach dem Letzten.
  const gridStart = addDays(firstOfMonth, -((firstOfMonth.getDay() + 6) % 7));
  const gridEnd = addDays(lastOfMonth, (7 - lastOfMonth.getDay()) % 7);
  const ym = (date) => isoDay(date).slice(0, 7);

  const [head, entries] = await Promise.all([
    calendarHeadHtml('monat'),
    api(`/api/calendar?from=${isoDay(gridStart)}&to=${isoDay(gridEnd)}`),
  ]);

  const byDay = new Map();
  for (const entry of entries) {
    if (!byDay.has(entry.date)) byDay.set(entry.date, []);
    byDay.get(entry.date).push(entry);
  }

  const todayIso = isoDay(now);
  let selected = todayIso >= isoDay(firstOfMonth) && todayIso <= isoDay(lastOfMonth) ? todayIso : isoDay(firstOfMonth);

  const cells = [];
  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
    const iso = isoDay(day);
    const items = byDay.get(iso) ?? [];
    const dots = items.map((entry) =>
      `<span class="cal-dot" data-category="${escapeHtml(entry.category)}">${categoryMark(entry.category)}</span>`).join('');
    const classes = ['cal-cell', day.getMonth() !== month - 1 ? 'outside' : '', iso === todayIso ? 'today' : ''].join(' ');
    cells.push(`
      <button type="button" class="${classes}" data-day="${iso}" aria-pressed="${iso === selected}"
              aria-label="${escapeHtml(weekdayAndDate.format(day))}${items.length ? `, ${items.length} Einträge` : ''}">
        <span class="cal-num">${day.getDate()}</span>
        <span class="cal-dots">${dots}</span>
      </button>`);
  }

  render(`
    ${head}
    <div class="cal-month-layout">
    <div>
    <div class="cal-month-nav">
      <a class="btn small secondary" href="#/kalender/monat/${ym(new Date(year, month - 2, 1))}" aria-label="Vorheriger Monat">‹</a>
      <h2>${escapeHtml(monthTitle.format(firstOfMonth))}</h2>
      <a class="btn small secondary" href="#/kalender/monat/${ym(new Date(year, month, 1))}" aria-label="Nächster Monat">›</a>
      ${ym(now) !== ym(firstOfMonth) ? '<a class="cal-today-link" href="#/kalender/monat">Heute</a>' : ''}
    </div>
    <div class="cal-grid" role="grid">
      ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<span class="cal-weekday">${d}</span>`).join('')}
      ${cells.join('')}
    </div>
    </div>
    <div id="cal-selected"></div>
    </div>`, 'kalender');

  const panel = document.getElementById('cal-selected');
  let applyFilter = () => {};
  const showDay = () => {
    const items = byDay.get(selected) ?? [];
    panel.innerHTML = items.length
      ? calendarDaysHtml(items, admin)
      : `<section class="cal-day"><h2>${escapeHtml(dayHeading.format(fromIsoDay(selected)))}</h2></section>`;
    panel.insertAdjacentHTML('beforeend', '<p class="muted" id="cal-empty" hidden>An diesem Tag steht nichts an.</p>');
    applyFilter();
  };

  applyFilter = enableCalendarFilter(() => {
    const day = panel.querySelector('.cal-day');
    if (day) day.hidden = false; // die Überschrift des gewählten Tags bleibt immer sichtbar
    const empty = document.getElementById('cal-empty');
    if (empty) empty.hidden = Boolean(panel.querySelector('.cal-entry:not([hidden])'));
  });

  document.querySelector('.cal-grid').addEventListener('click', (clickEvent) => {
    const cell = clickEvent.target.closest('.cal-cell');
    if (!cell) return;
    selected = cell.dataset.day;
    document.querySelectorAll('.cal-cell').forEach((c) => c.setAttribute('aria-pressed', String(c === cell)));
    showDay();
  });
  showDay();
}

/** Ein einzelner Termin ohne News-Beitrag; Termine mit Beitrag leiten zum Beitrag weiter. */
async function viewEventDetail(id) {
  const event = await api(`/api/events/${encodeURIComponent(id)}`);
  if (event.newsId) {
    location.replace(`#/news/${event.newsId}`);
    return;
  }

  render(`
    <a class="back" href="#/kalender">Zum Kalender</a>
    <article>
      ${pageHead('kalender', event.title)}
      <p class="article-meta">
        ${escapeHtml(eventWhenLong(event))}${event.location ? `<br>${escapeHtml(event.location)}` : ''}
      </p>
      ${event.description ? `<div class="article-body">${paragraphs(event.description)}</div>` : ''}
    </article>
    ${isAdmin() ? `
      <div class="admin-actions">
        <a class="btn secondary" href="#/kalender/termin/${event.id}/bearbeiten">Bearbeiten</a>
        <button class="btn danger" type="button" id="delete">Löschen</button>
      </div>` : ''}`, 'kalender');

  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`„${event.title}“ wirklich löschen?`)) return;
    await api(`/api/events/${event.id}`, { method: 'DELETE' });
    location.hash = '#/kalender';
  });
}

async function viewEventEditor(id) {
  if (!isAdmin()) {
    render(`${pageHead('kalender', 'Termin eintragen')}<p class="notice">Nur Admins können Termine eintragen und bearbeiten.</p>`, 'kalender');
    return;
  }

  const event = id
    ? await api(`/api/events/${encodeURIComponent(id)}`)
    : { title: '', description: '', location: '', startsAt: null, endsAt: null, allDay: false };
  // Termine eines News-Beitrags werden nur dort gepflegt.
  if (event.newsId) {
    location.replace(`#/news/${event.newsId}/bearbeiten`);
    return;
  }

  render(`
    <a class="back" href="${id ? `#/kalender/termin/${event.id}` : '#/kalender'}">Abbrechen</a>
    ${pageHead('kalender', id ? 'Termin bearbeiten' : 'Termin eintragen')}
    <p class="muted form-intro">Für Termine mit ausführlicher Beschreibung kannst du auch einen
      <a href="#/news/neu">News-Beitrag mit Termin</a> schreiben.</p>
    <div id="editor-error"></div>
    <form class="form" id="event-form">
      <div class="field">
        <label for="title">Titel</label>
        <input id="title" name="title" maxlength="200" required value="${escapeHtml(event.title)}">
      </div>
      ${eventFieldsHtml(event)}
      <div class="field">
        <label for="description">Beschreibung</label>
        <span class="hint">Optional. Eine Leerzeile beginnt einen neuen Absatz.</span>
        <textarea id="description" name="description" class="short-text">${escapeHtml(event.description)}</textarea>
      </div>
      <div><button class="btn" type="submit">${id ? 'Änderungen speichern' : 'Termin eintragen'}</button></div>
    </form>`, 'kalender');

  const form = document.getElementById('event-form');
  const errorBox = document.getElementById('editor-error');
  form.elements.startsAt.required = true;
  enableAllDayToggle(form);

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const button = form.querySelector('button');
    const body = { title: form.elements.title.value, description: form.elements.description.value, ...readEventFields(form) };

    if (body.endsAt && body.startsAt && body.endsAt < body.startsAt) {
      errorBox.innerHTML = '<p class="notice error">Das Ende darf nicht vor dem Beginn liegen.</p>';
      return;
    }

    button.disabled = true;
    try {
      const saved = id
        ? await api(`/api/events/${event.id}`, { method: 'PUT', body })
        : await api('/api/events', { method: 'POST', body });
      location.hash = `#/kalender/termin/${saved.id}`;
    } catch (error) {
      errorBox.innerHTML = error.status === 400
        ? '<p class="notice error">Titel und Beginn müssen ausgefüllt sein, und das Ende darf nicht vor dem Beginn liegen.</p>'
        : '<p class="notice error">Speichern hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
      button.disabled = false;
    }
  });
}

async function viewWasteEditor(id) {
  if (!isAdmin()) {
    render(`${pageHead('kalender', 'Abfuhr eintragen')}<p class="notice">Nur Admins können Abfuhrtermine pflegen.</p>`, 'kalender');
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
    <a class="back" href="#/kalender">Abbrechen</a>
    ${pageHead('kalender', id ? 'Abfuhr bearbeiten' : 'Abfuhr eintragen')}
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
    </form>`, 'kalender');

  const form = document.getElementById('waste-form');
  const errorBox = document.getElementById('editor-error');

  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`„${collection.label}“ am ${collection.collectionDate} wirklich löschen?`)) return;
    await api(`/api/waste/${collection.id}`, { method: 'DELETE' });
    location.hash = '#/kalender';
  });

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const body = {
      wasteType: form.elements.wasteType.value,
      collectionDate: form.elements.collectionDate.value,
      note: form.elements.note.value,
    };

    try {
      if (id) await api(`/api/waste/${collection.id}`, { method: 'PUT', body });
      else await api('/api/waste', { method: 'POST', body });
      location.hash = '#/kalender';
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
    render(`${pageHead('kalender', 'Abfuhrtermine importieren')}<p class="notice">Nur Admins können Abfuhrtermine importieren.</p>`, 'kalender');
    return;
  }

  render(`
    <a class="back" href="#/kalender">Zurück zum Kalender</a>
    ${pageHead('kalender', 'Abfuhrtermine importieren')}
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
    </form>`, 'kalender');

  const form = document.getElementById('import-form');
  const result = document.getElementById('import-result');

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const button = form.querySelector('button');
    const file = form.elements.file.files[0];
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
          <p><a href="#/kalender">Zum Kalender</a></p>
        </div>`;
      form.reset();
    } catch (error) {
      result.innerHTML = error.status === 413 || error.status === 400
        ? '<p class="notice error">Mit dieser Datei kann MicroHub nichts anfangen. Erwartet wird eine ICS-Datei bis 5 MB.</p>'
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

/**
 * Verkleinert ein Foto im Browser auf höchstens 1600 px und macht ein JPEG daraus.
 * Das spart Datenvolumen und Speicher, und das Neuzeichnen entfernt nebenbei alle Metadaten
 * wie den GPS-Standort. Der Server kodiert das Bild zur Sicherheit noch einmal neu.
 */
async function shrinkPhoto(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff'; // Transparenz (PNG) wird weiß, JPEG kennt keine
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht umgewandelt werden'))), 'image/jpeg', 0.85);
  });
}

/** Das Feld zur Fotoauswahl; verhalten wird es über enablePhotoPicker. */
function photoFieldHtml(label) {
  return `
    <div class="field">
      <label for="photos">${label}</label>
      <span class="hint" id="photo-hint"></span>
      <ul class="photo-picker" id="photo-picker"></ul>
      <input id="photos" type="file" accept="image/jpeg,image/png" multiple>
    </div>`;
}

/**
 * Fotoauswahl für News und Brett: Vorschau, Entfernen, Obergrenze. Hochgeladen bzw. gelöscht wird
 * erst mit save(), also beim Speichern des Formulars – „Abbrechen“ ändert nichts.
 * firstIsCover markiert das erste Bild als Titelbild (News).
 */
function enablePhotoPicker({ existing, max, errorBox, place, firstIsCover = false }) {
  const kept = [...existing];
  const removed = [];
  const added = []; // { blob, url } – url ist eine lokale Vorschau-Adresse
  const picker = document.getElementById('photo-picker');
  const fileInput = document.getElementById('photos');

  const render = () => {
    const total = kept.length + added.length;
    const item = (src, attr, index) => `
      <li>${firstIsCover && index === 0 ? '<span class="cover-tag">Titelbild</span>' : ''}<img src="${src}" alt="">
        <button type="button" class="link-button" ${attr}>Entfernen</button></li>`;
    picker.innerHTML = [
      ...kept.map((photo, i) => item(escapeHtml(photo.thumbUrl), `data-kept="${photo.id}"`, i)),
      ...added.map((photo, i) => item(photo.url, `data-added="${i}"`, kept.length + i)),
    ].join('');
    fileInput.hidden = total >= max;
    document.getElementById('photo-hint').textContent = total >= max
      ? `Mehr als ${max} Bilder gehen nicht. Entferne eins, um ein anderes zu wählen.`
      : `Optional, bis zu ${max}.${firstIsCover ? ' Das erste Bild ist das Titelbild.' : ''} Bilder werden vor dem Hochladen verkleinert, Standortdaten aus dem Handy werden entfernt.`;
  };

  picker.addEventListener('click', (clickEvent) => {
    const button = clickEvent.target.closest('button');
    if (!button) return;
    if (button.dataset.kept) {
      const index = kept.findIndex((photo) => String(photo.id) === button.dataset.kept);
      removed.push(...kept.splice(index, 1));
    } else {
      const [photo] = added.splice(Number(button.dataset.added), 1);
      URL.revokeObjectURL(photo.url);
    }
    render();
  });

  fileInput.addEventListener('change', async () => {
    errorBox.innerHTML = '';
    const free = max - kept.length - added.length;
    const files = [...fileInput.files];
    fileInput.value = '';
    for (const file of files.slice(0, free)) {
      try {
        const blob = await shrinkPhoto(file);
        added.push({ blob, url: URL.createObjectURL(blob) });
      } catch {
        errorBox.innerHTML = `<p class="notice error">„${escapeHtml(file.name)}“ lässt sich nicht als Bild lesen. Bitte ein JPEG- oder PNG-Bild wählen.</p>`;
      }
    }
    if (files.length > free) {
      errorBox.innerHTML = `<p class="notice error">Es passen nur ${max} Bilder ${place} – die übrigen wurden weggelassen.</p>`;
    }
    render();
  });

  render();

  return {
    /** Erst entfernen, dann hochladen – so bleibt die Obergrenze auf dem Server nie überschritten. */
    async save(photosUrl) {
      for (const photo of removed) {
        await api(`${photosUrl}/${photo.id}`, { method: 'DELETE' });
      }
      for (const photo of added) {
        const upload = new FormData();
        upload.append('file', photo.blob, 'foto.jpg');
        await api(photosUrl, { method: 'POST', upload });
        URL.revokeObjectURL(photo.url);
      }
    },
  };
}

/** Großansicht von Fotos (Brett und News). Ein <dialog> bringt Fokusfalle und Escape-Taste gleich mit. */
function openLightbox(photos, start = 0) {
  let dialog = document.getElementById('lightbox');
  if (!dialog) {
    document.body.insertAdjacentHTML('beforeend', `
      <dialog class="lightbox" id="lightbox" aria-label="Fotos">
        <img alt="">
        <div class="lightbox-bar">
          <button type="button" class="btn secondary small" data-step="-1">Zurück</button>
          <span class="lightbox-count"></span>
          <button type="button" class="btn secondary small" data-step="1">Weiter</button>
          <button type="button" class="btn small" data-close>Schließen</button>
        </div>
      </dialog>`);
    dialog = document.getElementById('lightbox');
    const show = () => {
      const photo = dialog.photos[dialog.index];
      dialog.querySelector('img').src = photo.url;
      dialog.querySelector('.lightbox-count').textContent = `${dialog.index + 1} von ${dialog.photos.length}`;
      dialog.querySelectorAll('[data-step]').forEach((button) => { button.hidden = dialog.photos.length < 2; });
    };
    const step = (delta) => {
      dialog.index = (dialog.index + delta + dialog.photos.length) % dialog.photos.length;
      show();
    };
    dialog.showPhoto = show;
    dialog.addEventListener('click', (clickEvent) => {
      // Klick neben das Bild (auf den abgedunkelten Hintergrund) schließt ebenfalls.
      if (clickEvent.target === dialog || clickEvent.target.closest('[data-close]')) dialog.close();
      const stepButton = clickEvent.target.closest('[data-step]');
      if (stepButton) step(Number(stepButton.dataset.step));
    });
    dialog.addEventListener('keydown', (keyEvent) => {
      if (keyEvent.key === 'ArrowLeft') step(-1);
      if (keyEvent.key === 'ArrowRight') step(1);
    });
  }
  dialog.photos = photos;
  dialog.index = start;
  dialog.showPhoto();
  dialog.showModal();
}

function boardCardHtml(post) {
  const [first, ...more] = post.photos;
  const photo = first ? `
    <button type="button" class="note-photo" data-post="${post.id}" aria-label="Fotos von „${escapeHtml(post.title)}“ groß ansehen">
      <img src="${escapeHtml(first.thumbUrl)}" alt="" loading="lazy" width="${first.width}" height="${first.height}">
      ${more.length ? `<span class="note-photo-more">+${more.length} ${more.length === 1 ? 'Foto' : 'Fotos'}</span>` : ''}
    </button>` : '';

  return `
    <li class="note" data-kind="${escapeHtml(post.kind)}">
      ${photo}
      <span class="note-kind kind-${escapeHtml(post.kind)}">${escapeHtml(post.label)}</span>
      <h2>${escapeHtml(post.title)}</h2>
      <div class="note-body">${paragraphs(post.content)}</div>
      ${post.contact ? `<p class="note-contact"><span class="muted">Kontakt:</span> ${boardContactHtml(post.contact)}</p>` : ''}
      <p class="note-meta">
        ${escapeHtml(post.authorName)}, hängt bis ${dayAndMonth.format(new Date(post.expiresAt))}
      </p>
      ${post.editable ? `<a class="note-edit" href="#/brett/${post.id}/bearbeiten">Bearbeiten</a>` : ''}
    </li>`;
}

async function viewBoardList() {
  if (!state.user) {
    loginPrompt('brett');
    return;
  }

  const [options, { active: posts, expired }] = await Promise.all([loadBoardOptions(), api('/api/board')]);
  const action = '<a class="btn" href="#/brett/neu">Aushang schreiben</a>';

  // Eigene abgelaufene Aushänge: nur für den Autor sichtbar, einmal rettbar, sonst bald gelöscht.
  const expiredSection = expired.length ? `
    <section class="expired">
      <h2>Deine abgelaufenen Aushänge</h2>
      <p class="muted">Nur du siehst sie. Du kannst jeden davon einmal neu aufhängen – sonst wird er samt Fotos gelöscht.</p>
      <ul class="expired-list">${expired.map((post) => `
        <li>
          <div>
            <strong>${escapeHtml(post.title)}</strong>
            <span class="muted">abgelaufen am ${dayAndMonth.format(new Date(post.expiresAt))},
              wird am ${dayAndMonth.format(new Date(post.deletionDate))} gelöscht</span>
          </div>
          <a class="btn small secondary" href="#/brett/${post.id}/bearbeiten">Noch einmal aufhängen</a>
        </li>`).join('')}
      </ul>
    </section>` : '';

  if (posts.length === 0) {
    render(`
      ${pageHead('brett', 'Schwarzes Brett', action)}
      <ul class="board board-empty">
        <li class="note">
          <h2>Noch hängt hier nichts</h2>
          <p>Du suchst etwas, bietest etwas an oder möchtest tauschen? Häng den ersten Aushang auf.</p>
          <a class="btn small" href="#/brett/neu">Aushang schreiben</a>
        </li>
      </ul>
      ${expiredSection}`, 'brett');
    return;
  }

  const filters = [{ value: 'ALLE', label: 'Alle' }, ...options.kinds].map((kind) => `
    <button type="button" class="filter" data-filter="${escapeHtml(kind.value)}"
            aria-pressed="${kind.value === boardFilter}">${escapeHtml(kind.label)}</button>`).join('');

  render(`
    ${pageHead('brett', 'Schwarzes Brett', action)}
    <div class="filters" role="group" aria-label="Nach Art filtern">${filters}</div>
    <p class="muted" id="board-empty" hidden>Zu dieser Art hängt gerade nichts.</p>
    <ul class="board" id="board">${posts.map(boardCardHtml).join('')}</ul>
    ${expiredSection}`, 'brett');

  document.getElementById('board').addEventListener('click', (clickEvent) => {
    const photoButton = clickEvent.target.closest('.note-photo');
    if (!photoButton) return;
    const post = posts.find((p) => String(p.id) === photoButton.dataset.post);
    openLightbox(post.photos);
  });

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
    : { kind: options.kinds[0].value, title: '', content: '', contact: '', editable: true, photos: [] };

  if (!post.editable) {
    render(`${pageHead('brett', 'Aushang bearbeiten')}<p class="notice">Diesen Aushang können nur die Person, die ihn geschrieben hat, und Admins ändern.</p>`, 'brett');
    return;
  }

  // Ein abgelaufener Aushang wird hier einmalig neu aufgehängt; das Backend lässt es nur einmal zu.
  const reviving = Boolean(post.expired);
  const heading = reviving ? 'Noch einmal aufhängen' : id ? 'Aushang bearbeiten' : 'Aushang schreiben';
  const reviveNotice = reviving
    ? `<p class="notice">Dieser Aushang ist am ${escapeHtml(fullDate.format(new Date(post.expiresAt)))} abgelaufen.
         Du kannst ihn <strong>einmal</strong> neu aufhängen. Läuft er danach wieder ab, wird er gelöscht.</p>`
    : '';

  const kinds = options.kinds.map((kind) => `
    <label class="choice">
      <input type="radio" name="kind" value="${escapeHtml(kind.value)}" ${kind.value === post.kind ? 'checked' : ''}>
      <span>${escapeHtml(kind.label)}</span>
    </label>`).join('');

  const durations = options.durations.map((days) => `
    <option value="${days}" ${days === options.defaultDuration ? 'selected' : ''}>${days} Tage</option>`).join('');

  const durationHint = reviving
    ? 'Ab heute gerechnet.'
    : id
      ? `Hängt bisher bis ${escapeHtml(fullDate.format(new Date(post.expiresAt)))}. Beim Speichern wird die Laufzeit ab heute neu gerechnet.`
      : 'Danach verschwindet der Aushang von selbst.';

  const submitLabel = reviving ? 'Noch einmal aufhängen' : id ? 'Änderungen speichern' : 'Aushang aufhängen';

  render(`
    <a class="back" href="#/brett">Abbrechen</a>
    ${pageHead('brett', heading)}
    ${reviveNotice}
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
      ${photoFieldHtml('Fotos')}
      <div class="field">
        <label for="durationDays">Wie lange soll der Aushang hängen?</label>
        <span class="hint">${durationHint}</span>
        <select id="durationDays" name="durationDays">${durations}</select>
      </div>
      <div class="admin-actions">
        <button class="btn" type="submit">${submitLabel}</button>
        ${id ? '<button class="btn danger" type="button" id="delete">Abnehmen</button>' : ''}
      </div>
    </form>`, 'brett');

  const form = document.getElementById('board-form');
  const errorBox = document.getElementById('editor-error');

  const photos = enablePhotoPicker({ existing: post.photos, max: options.maxPhotos, errorBox, place: 'an einen Aushang' });

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

    let saved;
    try {
      saved = id
        ? await api(`/api/board/${post.id}`, { method: 'PUT', body })
        : await api('/api/board', { method: 'POST', body });
    } catch (error) {
      errorBox.innerHTML = error.status === 400
        ? '<p class="notice error">Überschrift und Text müssen ausgefüllt sein.</p>'
        : error.status === 403 || error.status === 409
          ? `<p class="notice error">${escapeHtml(error.message)}</p>`
          : '<p class="notice error">Speichern hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
      button.disabled = false;
      return;
    }

    // Der Text ist gespeichert; jetzt die Fotos. Scheitert eins, bleibt der Aushang trotzdem bestehen.
    try {
      await photos.save(`/api/board/${saved.id}/photos`);
      location.hash = '#/brett';
    } catch {
      // Der Knopf bleibt gesperrt: ein zweites Absenden würde einen neuen Aushang doppelt anlegen.
      errorBox.innerHTML = `
        <p class="notice error">Der Aushang ist gespeichert, aber nicht alle Fotos konnten hochgeladen werden.
          <a href="#/brett/${saved.id}/bearbeiten">Fotos noch einmal versuchen</a></p>`;
    }
  });
}

// ---------- Registrierung und Mein Konto ----------

const PASSWORD_MIN = 10;

/** Ein Passwortfeld mit „Passwort anzeigen“ – auf dem Handy hilfreicher als ein zweites Feld zum Wiederholen. */
function passwordField(id, label, hint = '', autocomplete = 'new-password') {
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      ${hint ? `<span class="hint">${hint}</span>` : ''}
      <input id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" required
             ${autocomplete === 'new-password' ? `minlength="${PASSWORD_MIN}" maxlength="64"` : ''}>
      <label class="show-password"><input type="checkbox" data-toggle="${id}"> Passwort anzeigen</label>
    </div>`;
}

function enablePasswordToggles(root) {
  root.querySelectorAll('[data-toggle]').forEach((box) => {
    box.addEventListener('change', () => {
      document.getElementById(box.dataset.toggle).type = box.checked ? 'text' : 'password';
    });
  });
}

/** Fehlermeldung aus der API (409 bringt einen verständlichen Text mit), sonst ein allgemeiner Hinweis. */
function errorNotice(error, invalidText) {
  if (error.status === 409 || error.status === 403) return `<p class="notice error">${escapeHtml(error.message)}</p>`;
  if (error.status === 400) return `<p class="notice error">${invalidText}</p>`;
  return '<p class="notice error">Das hat nicht geklappt. Prüfe deine Verbindung und versuche es noch einmal.</p>';
}

function viewRegister() {
  if (state.user) {
    location.hash = '#/start';
    return;
  }

  render(`
    ${pageHead('registrieren', 'Registrieren')}
    <p class="muted form-intro">Den Freischaltcode hast du auf einem Zettel im Briefkasten bekommen.</p>
    <div id="register-error"></div>
    <form class="form" id="register-form">
      <div class="field">
        <label for="code">Freischaltcode</label>
        <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false"
               placeholder="XXXX-XXXX-XXXX" required>
      </div>
      <div class="field">
        <label for="displayName">Dein Name</label>
        <span class="hint">So sehen dich die anderen am Schwarzen Brett, zum Beispiel „Familie Müller“ oder „Anna, Whg. 3“.</span>
        <input id="displayName" name="displayName" autocomplete="name" minlength="2" maxlength="100" required>
      </div>
      <div class="field">
        <label for="username">Benutzername</label>
        <span class="hint">Damit meldest du dich an. 3 bis 30 Zeichen: Buchstaben, Ziffern, Punkt, Binde- oder Unterstrich.</span>
        <input id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false"
               pattern="[A-Za-z0-9._\\-]{3,30}" required>
      </div>
      ${passwordField('password', 'Passwort', `Mindestens ${PASSWORD_MIN} Zeichen. Ein langer Satz ist sicherer als ein kurzes Wort mit Sonderzeichen.`)}
      <div><button class="btn" type="submit">Konto anlegen</button></div>
    </form>
    <p class="form-aside">Schon registriert? <a href="#/login">Anmelden</a></p>`, 'registrieren');

  const form = document.getElementById('register-form');
  enablePasswordToggles(form);

  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const fields = form.elements;
    const body = {
      code: fields.code.value,
      displayName: fields.displayName.value,
      username: fields.username.value,
      password: fields.password.value,
    };

    try {
      await api('/api/auth/register', { method: 'POST', body });
      // Gleich anmelden, damit niemand seine frisch gewählten Daten zweimal tippen muss.
      await api('/api/auth/login', { method: 'POST', form: { username: body.username, password: body.password } });
      await loadUser();
      location.hash = '#/brett';
    } catch (error) {
      document.getElementById('register-error').innerHTML = errorNotice(error,
        'Bitte prüfe deine Angaben: Name mindestens 2 Zeichen, Benutzername 3 bis 30 erlaubte Zeichen, Passwort mindestens 10 Zeichen.');
      button.disabled = false;
    }
  });
}

function viewAccount() {
  if (!state.user) {
    loginPrompt('konto');
    return;
  }

  const forced = state.user.mustChangePassword;
  const passwordForm = `
    <section class="account-section">
      <h2>Passwort ändern</h2>
      <div id="password-result"></div>
      <form class="form" id="password-form">
        ${passwordField('currentPassword', forced ? 'Einmal-Passwort, das du bekommen hast' : 'Bisheriges Passwort', '', 'current-password')}
        ${passwordField('newPassword', 'Neues Passwort', `Mindestens ${PASSWORD_MIN} Zeichen.`)}
        <div><button class="btn" type="submit">Passwort ändern</button></div>
      </form>
    </section>`;

  if (forced) {
    render(`
      ${pageHead('konto', 'Eigenes Passwort setzen')}
      <p class="notice">Dein Passwort wurde zurückgesetzt. Bitte wähle jetzt ein eigenes – danach geht es ganz normal weiter.</p>
      ${passwordForm}`, 'konto');
  } else {
    render(`
      ${pageHead('konto', 'Mein Konto')}
      <p class="muted">Angemeldet als <strong>${escapeHtml(state.user.username)}</strong>.</p>
      <section class="account-section">
        <h2>Dein Name</h2>
        <div id="name-result"></div>
        <form class="form" id="name-form">
          <div class="field">
            <label for="displayName">So sehen dich die anderen am Schwarzen Brett</label>
            <input id="displayName" name="displayName" minlength="2" maxlength="100" required value="${escapeHtml(state.user.displayName)}">
          </div>
          <div><button class="btn secondary" type="submit">Namen speichern</button></div>
        </form>
      </section>
      ${passwordForm}
      <section class="account-section danger-zone">
        <h2>Konto löschen</h2>
        <p class="muted">Dein Konto wird sofort gelöscht, zusammen mit deinen Aushängen und Fotos. Das lässt sich nicht rückgängig machen.</p>
        <div id="delete-result"></div>
        <form class="form" id="delete-form">
          ${passwordField('deletePassword', 'Zur Bestätigung dein Passwort', '', 'current-password')}
          <div><button class="btn danger" type="submit">Konto endgültig löschen</button></div>
        </form>
      </section>`, 'konto');
  }

  enablePasswordToggles(main);

  document.getElementById('password-form').addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const form = submitEvent.target;
    const result = document.getElementById('password-result');
    try {
      await api('/api/account/password', {
        method: 'PUT',
        body: { currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value },
      });
      form.reset();
      if (forced) {
        await loadUser();
        location.hash = '#/start';
      } else {
        result.innerHTML = '<p class="notice">Dein Passwort ist geändert.</p>';
      }
    } catch (error) {
      result.innerHTML = errorNotice(error, `Das neue Passwort braucht mindestens ${PASSWORD_MIN} Zeichen.`);
    }
  });

  document.getElementById('name-form')?.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const result = document.getElementById('name-result');
    try {
      await api('/api/account/display-name', { method: 'PUT', body: { displayName: submitEvent.target.elements.displayName.value } });
      await loadUser();
      result.innerHTML = '<p class="notice">Dein Name ist gespeichert.</p>';
    } catch (error) {
      result.innerHTML = errorNotice(error, 'Der Name braucht mindestens 2 Zeichen.');
    }
  });

  document.getElementById('delete-form')?.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    if (!confirm('Dein Konto, deine Aushänge und Fotos werden endgültig gelöscht. Wirklich fortfahren?')) return;
    try {
      await api('/api/account/delete', { method: 'POST', body: { password: submitEvent.target.elements.deletePassword.value } });
      await loadUser();
      location.hash = '#/start';
    } catch (error) {
      document.getElementById('delete-result').innerHTML = errorNotice(error, 'Bitte gib dein Passwort ein.');
    }
  });
}

// ---------- Verwaltung (nur Admins) ----------

function adminHead(active) {
  const link = (hash, label, key) => `<a href="${hash}" ${key === active ? 'aria-current="page"' : ''}>${label}</a>`;
  return `
    ${pageHead('verwaltung', 'Verwaltung')}
    <nav class="subnav" aria-label="Verwaltung">
      ${link('#/verwaltung', 'Mitglieder', 'members')}
      ${link('#/verwaltung/codes', 'Freischaltcodes', 'codes')}
    </nav>`;
}

function requireAdmin() {
  if (isAdmin()) return true;
  render(`${pageHead('verwaltung', 'Verwaltung')}<p class="notice">Diesen Bereich sehen nur Admins.</p>`, 'verwaltung');
  return false;
}

async function viewAdminMembers(notice = '') {
  if (!requireAdmin()) return;
  const members = await api('/api/admin/members');

  const rows = members.map((member) => {
    const tags = [
      member.role === 'ADMIN' ? '<span class="tag">Admin</span>' : '',
      member.enabled ? '' : `<span class="tag tag-warn">Gesperrt – wird am ${dayAndMonth.format(new Date(member.deletionDate))} gelöscht</span>`,
      member.mustChangePassword ? '<span class="tag">Muss Passwort ändern</span>' : '',
    ].join('');
    // Gesperrte Konten: entsperren oder endgültig löschen – alles andere ergibt dann keinen Sinn.
    const actions = member.self
      ? '<span class="muted">Das bist du</span>'
      : member.enabled
        ? `
          <button type="button" class="btn small secondary" data-action="reset" data-id="${member.id}">Passwort zurücksetzen</button>
          <button type="button" class="btn small secondary" data-action="block" data-id="${member.id}">Sperren</button>
          <button type="button" class="btn small secondary" data-action="${member.role === 'ADMIN' ? 'demote' : 'promote'}" data-id="${member.id}">
            ${member.role === 'ADMIN' ? 'Admin-Rechte entziehen' : 'Zum Admin machen'}</button>`
        : `
          <button type="button" class="btn small secondary" data-action="unblock" data-id="${member.id}">Entsperren</button>
          <button type="button" class="btn small danger" data-action="delete" data-id="${member.id}">Jetzt endgültig löschen</button>`;
    return `
      <li class="member">
        <div class="member-head"><strong>${escapeHtml(member.displayName)}</strong>${tags}</div>
        <p class="muted">${member.apartment ? `${escapeHtml(member.apartment)}, ` : ''}Benutzername ${escapeHtml(member.username)},
          dabei seit ${fullDate.format(new Date(member.createdAt))}</p>
        <div class="member-actions">${actions}</div>
      </li>`;
  }).join('');

  render(`
    ${adminHead('members')}
    <div id="admin-notice">${notice}</div>
    <ul class="member-list" id="member-list">${rows}</ul>`, 'verwaltung');

  document.getElementById('member-list').addEventListener('click', async (clickEvent) => {
    const button = clickEvent.target.closest('button[data-action]');
    if (!button) return;
    const member = members.find((m) => String(m.id) === button.dataset.id);
    const name = `„${member.displayName}“`;
    const box = document.getElementById('admin-notice');

    const questions = {
      reset: `Passwort von ${name} zurücksetzen? Die Person wird überall abgemeldet und bekommt ein Einmal-Passwort.`,
      block: `${name} sperren? Die Person wird sofort abgemeldet und kann sich nicht mehr anmelden. `
        + 'Nach 14 Tagen wird das Konto samt Aushängen und Fotos automatisch gelöscht – bis dahin kannst du es wieder entsperren.',
      unblock: `${name} wieder entsperren? Das Konto wird dann nicht gelöscht.`,
      delete: `${name} jetzt endgültig löschen? Konto, Aushänge und Fotos verschwinden sofort. Das lässt sich nicht rückgängig machen.`,
      promote: `${name} zum Admin machen? Admins können Inhalte, Codes und Mitglieder verwalten.`,
      demote: `${name} die Admin-Rechte entziehen?`,
    };
    if (!confirm(questions[button.dataset.action])) return;

    try {
      if (button.dataset.action === 'reset') {
        const { temporaryPassword } = await api(`/api/admin/members/${member.id}/password-reset`, { method: 'POST' });
        // Das Einmal-Passwort gibt es nur in dieser Antwort; gespeichert ist nur der Hash.
        await viewAdminMembers(`
          <div class="notice">
            <p>Einmal-Passwort für ${escapeHtml(name)}: <code class="secret">${escapeHtml(temporaryPassword)}</code></p>
            <p class="muted">Gib es der Person persönlich weiter. Es wird nur jetzt angezeigt; beim Anmelden muss sie sofort ein eigenes Passwort wählen.</p>
          </div>`);
        return;
      }
      if (button.dataset.action === 'delete') {
        await api(`/api/admin/members/${member.id}`, { method: 'DELETE' });
        await viewAdminMembers(`<p class="notice">${escapeHtml(name)} wurde gelöscht.</p>`);
        return;
      }
      const body = {
        block: { enabled: false }, unblock: { enabled: true },
        promote: { role: 'ADMIN' }, demote: { role: 'USER' },
      }[button.dataset.action];
      await api(`/api/admin/members/${member.id}`, { method: 'PUT', body });
      await viewAdminMembers();
    } catch (error) {
      box.innerHTML = errorNotice(error, 'Das hat nicht geklappt.');
    }
  });
}

/** Aufgebrauchte Codes gibt es nicht mehr – das Backend löscht sie bei der zweiten Registrierung. */
function codeStatus(code) {
  if (code.revoked) return `<span class="tag tag-warn">Gesperrt – wird am ${dayAndMonth.format(new Date(code.deletionDate))} gelöscht</span>`;
  return '<span class="tag tag-ok">Frei</span>';
}

async function viewAdminCodes(notice = '') {
  if (!requireAdmin()) return;
  const codes = await api('/api/admin/codes');

  const rows = codes.map((code) => `
    <li class="code-row">
      <label class="code-pick"><input type="checkbox" value="${code.id}" ${code.usable ? '' : 'disabled'}
        aria-label="${escapeHtml(code.label)} zum Drucken auswählen"></label>
      <div>
        <div class="member-head"><strong>${escapeHtml(code.label)}</strong>${codeStatus(code)}</div>
        <p class="muted"><code class="secret">${escapeHtml(code.code)}</code>, ${code.usedCount} von ${code.maxUses} benutzt</p>
      </div>
      <div class="code-actions">
        <button type="button" class="btn small secondary" data-id="${code.id}" data-revoked="${!code.revoked}">
          ${code.revoked ? 'Entsperren' : 'Sperren'}</button>
        ${code.revoked ? `<button type="button" class="btn small danger" data-id="${code.id}" data-delete>Jetzt löschen</button>` : ''}
      </div>
    </li>`).join('');

  render(`
    ${adminHead('codes')}
    <div id="admin-notice">${notice}</div>
    <section class="account-section">
      <h2>Neue Codes erzeugen</h2>
      <form class="form" id="code-form">
        <div class="field">
          <label for="labels">Für welche Wohnungen?</label>
          <span class="hint">Eine Wohnung pro Zeile, zum Beispiel „Whg. 3“ oder „EG links“. Jeder Code gilt für zwei Personen und läuft nicht ab.
            Haben sich beide registriert, verschwindet der Code automatisch.</span>
          <textarea id="labels" name="labels" class="short-text" required></textarea>
        </div>
        <div><button class="btn" type="submit">Codes erzeugen</button></div>
      </form>
    </section>
    <section class="account-section">
      <h2>Alle Codes</h2>
      ${codes.length ? `
        <p class="muted">Kreuze freie Codes an, um Zettel für den Briefkasten zu drucken.</p>
        <ul class="member-list" id="code-list">${rows}</ul>
        <div class="admin-actions"><button class="btn" type="button" id="print">Zettel für Ausgewählte drucken</button></div>`
        : '<p class="muted">Noch keine Codes erzeugt.</p>'}
    </section>`, 'verwaltung');

  document.getElementById('code-form').addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const labels = submitEvent.target.elements.labels.value.split('\n').map((l) => l.trim()).filter(Boolean);
    try {
      const created = await api('/api/admin/codes', { method: 'POST', body: { labels } });
      await viewAdminCodes(`
        <p class="notice">${created.length} ${created.length === 1 ? 'Code' : 'Codes'} erzeugt.
          <a href="#/verwaltung/drucken/${created.map((c) => c.id).join(',')}">Zettel dafür drucken</a></p>`);
    } catch (error) {
      document.getElementById('admin-notice').innerHTML = errorNotice(error, 'Bitte gib mindestens eine Wohnung an (höchstens 100 Zeichen pro Zeile).');
    }
  });

  document.getElementById('code-list')?.addEventListener('click', async (clickEvent) => {
    const button = clickEvent.target.closest('button[data-id]');
    if (!button) return;
    if (button.hasAttribute('data-delete')) {
      if (!confirm('Code jetzt endgültig löschen? Bestehende Konten bleiben erhalten.')) return;
      await api(`/api/admin/codes/${button.dataset.id}`, { method: 'DELETE' });
      await viewAdminCodes('<p class="notice">Der Code wurde gelöscht.</p>');
      return;
    }
    const revoked = button.dataset.revoked === 'true';
    if (revoked && !confirm('Code sperren? Damit kann sich niemand mehr registrieren. Bestehende Konten bleiben. '
      + 'Nach 14 Tagen wird der Code automatisch gelöscht – bis dahin kannst du ihn wieder entsperren.')) return;
    await api(`/api/admin/codes/${button.dataset.id}`, { method: 'PUT', body: { revoked } });
    await viewAdminCodes();
  });

  document.getElementById('print')?.addEventListener('click', () => {
    const ids = [...document.querySelectorAll('#code-list input:checked')].map((box) => box.value);
    if (!ids.length) {
      document.getElementById('admin-notice').innerHTML = '<p class="notice error">Kreuze zuerst mindestens einen freien Code an.</p>';
      return;
    }
    location.hash = `#/verwaltung/drucken/${ids.join(',')}`;
  });
}

/** Zettel für den Briefkasten: ein Abschnitt pro Wohnung, mit Schnittkante, beim Drucken ohne Navigation. */
async function viewCodeSlips(idList = '') {
  if (!requireAdmin()) return;
  const wanted = new Set(idList.split(','));
  const codes = (await api('/api/admin/codes')).filter((code) => wanted.has(String(code.id)));
  const site = location.host;

  const slips = codes.map((code) => `
    <article class="slip">
      <p class="slip-brand">MicroHub – die Infoseite für unser Haus</p>
      <p class="slip-for">Für: <strong>${escapeHtml(code.label)}</strong></p>
      <p>Hier findest du News, Termine, die Müllabfuhr, wichtige Kontakte und das Schwarze Brett.
         So meldest du dich an:</p>
      <ol>
        <li>Öffne <strong>${escapeHtml(site)}</strong> im Browser, gern auf dem Handy.</li>
        <li>Tippe auf „Anmelden“ und dann auf „Mit Freischaltcode registrieren“.</li>
        <li>Gib diesen Code ein: <code class="slip-code">${escapeHtml(code.code)}</code></li>
      </ol>
      <p class="slip-note">Der Code gilt für zwei Personen eures Haushalts. Bitte nicht weitergeben.
         MicroHub ist ein privates Projekt aus der Nachbarschaft – kein Angebot der Hausverwaltung.</p>
    </article>`).join('');

  render(`
    <div class="no-print">
      <a class="back" href="#/verwaltung/codes">Zurück zu den Codes</a>
      ${pageHead('verwaltung', 'Zettel drucken')}
      ${codes.length
        ? '<p class="muted">Jeder Zettel ist durch eine gestrichelte Linie getrennt. Beim Drucken erscheinen nur die Zettel.</p><div class="admin-actions"><button class="btn" type="button" id="do-print">Jetzt drucken</button></div>'
        : '<p class="notice">Keine passenden Codes gefunden.</p>'}
    </div>
    <div class="slips">${slips}</div>`, 'verwaltung');

  document.getElementById('do-print')?.addEventListener('click', () => window.print());
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
  const [section = 'start', first, second, third] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  setActiveTab(section === 'login' ? null : section);

  // Mit einem Einmal-Passwort vom Admin geht es erst weiter, wenn ein eigenes gesetzt ist.
  if (state.user?.mustChangePassword && section !== 'konto') {
    location.hash = '#/konto';
    return;
  }

  try {
    if (section === 'start') await viewStart();
    else if (section === 'login') viewLogin();
    else if (section === 'registrieren') viewRegister();
    else if (section === 'konto') viewAccount();
    else if (section === 'verwaltung' && !first) await viewAdminMembers();
    else if (section === 'verwaltung' && first === 'codes') await viewAdminCodes();
    else if (section === 'verwaltung' && first === 'drucken') await viewCodeSlips(second);
    else if (section === 'news' && !first) await viewNewsList();
    else if (section === 'news' && first === 'neu') await viewNewsEditor();
    else if (section === 'news' && second === 'bearbeiten') await viewNewsEditor(first);
    else if (section === 'news') await viewNewsDetail(first);
    else if (section === 'kalender' && !first) viewCalendar();
    else if (section === 'kalender' && first === 'liste') await viewCalendarList(false);
    else if (section === 'kalender' && first === 'vergangen') await viewCalendarList(true);
    else if (section === 'kalender' && first === 'monat') await viewCalendarMonth(second);
    else if (section === 'kalender' && first === 'termin' && second === 'neu') await viewEventEditor();
    else if (section === 'kalender' && first === 'termin' && third === 'bearbeiten') await viewEventEditor(second);
    else if (section === 'kalender' && first === 'termin') await viewEventDetail(second);
    else if (section === 'kalender' && first === 'muell' && second === 'neu') await viewWasteEditor();
    else if (section === 'kalender' && first === 'muell' && second === 'import') await viewWasteImport();
    else if (section === 'kalender' && first === 'muell' && third === 'bearbeiten') await viewWasteEditor(second);
    // Alte Adressen (Lesezeichen) aus der Zeit vor dem gemeinsamen Kalender
    else if (section === 'termine' || section === 'muell') location.replace('#/kalender');
    else if (section === 'kontakte' && !first) await viewContactList();
    else if (section === 'kontakte' && first === 'neu') await viewContactEditor();
    else if (section === 'kontakte' && second === 'bearbeiten') await viewContactEditor(first);
    else if (section === 'brett' && !first) await viewBoardList();
    else if (section === 'brett' && first === 'neu') await viewBoardEditor();
    else if (section === 'brett' && second === 'bearbeiten') await viewBoardEditor(first);
    else location.hash = '#/start';
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
