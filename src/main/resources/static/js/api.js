// Kleine Hilfsfunktion für alle Anfragen an das Spring-Backend.

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `HTTP ${status}`);
    this.status = status;
  }
}

function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * api('/api/news')                                  → GET, liefert JSON
 * api('/api/news', { method: 'POST', body: {...} }) → JSON senden
 * api('/api/auth/login', { method: 'POST', form: {...} }) → Formular senden
 */
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { Accept: 'application/json' };

  if (method !== 'GET') {
    const token = csrfToken();
    if (token) headers['X-XSRF-TOKEN'] = token;
  }

  let payload;
  if (form) {
    payload = new URLSearchParams(form);
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' });

  if (!response.ok) {
    let detail;
    try { detail = (await response.json()).detail; } catch { /* keine JSON-Antwort */ }
    throw new ApiError(response.status, detail);
  }

  const type = response.headers.get('content-type') || '';
  return type.includes('json') ? response.json() : null;
}
