# CLAUDE.md – Projektübergabe MicroHub

Diese Datei ist die Übergabe für Claude Code. Sie beschreibt Ziel, Architektur, getroffene
Entscheidungen, aktuellen Stand und nächste Schritte. Bitte vor jeder Arbeit lesen und bei
wichtigen Änderungen aktuell halten.

## Zusammenarbeit

- Sprache: **Deutsch**, in Antworten, Commit-Nachrichten und Code-Kommentaren.
- Der Entwickler ist Einsteiger in Spring Boot, Docker und Deployment. Schritte kurz erklären,
  Befehle für **Windows/PowerShell** angeben (das IntelliJ-Terminal ist PowerShell).
- In kleinen, testbaren Schritten arbeiten. Nach jedem Schritt sagen, wie man ihn prüft
  (Browser, `docker exec … psql`, Log-Zeile), dann committen.
- Größere Entscheidungen (neue Abhängigkeiten, Architektur, Datenmodell-Änderungen) vorher
  kurz vorschlagen und Zustimmung abwarten.
- Das Repo ist **öffentlich** (https://github.com/DukeNightshade/microhub). Niemals Passwörter,
  API-Keys, VAPID-Private-Keys oder `.env`-Dateien committen. Geheimnisse nur über
  Umgebungsvariablen.

## Ziel des Projekts

Lokale Nachrichten-/Infoseite unter **microhub.dev** (Domain bei Name.com, ein Jahr gratis,
noch keine DNS-Einträge gesetzt). Komplett kostenlos betrieben.

- **Gäste** (nicht eingeloggt): lesen News, Termine, Müllabfuhr.
- **User** (eingeloggt): zusätzlich Kontakte, Schwarzes Brett (lesen + posten), Push-Abos.
- **Admin**: pflegt News, Termine, Müllabfuhr, Kontakte.
- **PWA** mit Web-Push-Benachrichtigungen aufs Handy (z. B. „Morgen Restmüll“, neue News).

## Tech-Stack

- Java 25 (Microsoft OpenJDK 25), Spring Boot **4.1.1**, Maven (Wrapper `mvnw`)
- Spring Web MVC, Spring Security, Spring Data JPA, Validation, Actuator, DevTools
- PostgreSQL 17, Flyway (`spring-boot-starter-flyway` + `flyway-database-postgresql`)
- Docker Compose Support: `compose.yaml` startet lokal Postgres automatisch beim App-Start
- Frontend: Vanilla JS (ES-Module), kein Build-Schritt, ausgeliefert aus
  `src/main/resources/static`
- Spring Boot 4 nutzt Jackson 3; `Instant` wird als ISO-String serialisiert.

## Projektstruktur (Paket nach Fachbereich)

```
src/main/java/dev/microhub/
├── MicrohubApplication.java
├── common/      NotFoundException (→ 404), ConflictException (→ 409),
│                BadRequestException (→ 400)
├── config/      SecurityConfig
├── user/        AppUser, Role, AppUserRepository, AppUserDetailsService,
│                AdminInitializer, AuthController
├── news/        News, NewsRepository, NewsService, NewsController,
│                NewsRequest, NewsResponse, NewsListItem, NewsPage
├── events/      CalendarEvent, EventRepository, EventService, EventController,
│                EventRequest, EventResponse, EventListItem, EventPage
├── waste/       WasteCollection, WasteType, WasteRepository, WasteService,
│                WasteController, WasteImportService, IcsParser, IcsEvent,
│                WasteRequest, WasteItem, WastePage, WasteTypeOption, WasteImportResult
├── contacts/    Contact, ContactRepository, ContactService, ContactController,
│                ContactRequest, ContactItem
├── board/       (geplant) Schwarzes Brett
└── push/        (geplant) Web Push, Abos, Scheduler
src/main/resources/
├── application.yaml
├── db/migration/V1__init.sql, V2__contact_public.sql
└── static/      index.html, css/app.css, js/api.js, js/app.js
```

Neue Module folgen dem Muster von `news/`: Entity → Repository → Service
(`@Transactional`, mappt auf DTO-Records) → Controller. DTOs sind Java-Records.

## Datenbank

- Schema kommt **ausschließlich aus Flyway**, `spring.jpa.hibernate.ddl-auto: validate`.
- `V1__init.sql` enthält bereits alle Tabellen: `app_user`, `news`, `calendar_event`,
  `waste_collection` (mit `reminder_sent`), `contact`, `board_post` (mit `expires_at`),
  `push_subscription` (mit `notify_news/events/waste/board`).
- **Ausgeführte Migrationen nie ändern.** Änderungen nur als neue Datei `V2__…sql` usw.
  Ausgeführt sind `V1` und `V2__contact_public.sql` (Spalte `contact.public`);
  die nächste Migration heißt `V3__…`.
- `open-in-view: false` → Lazy-Relationen nur innerhalb von `@Transactional` auflösen
  (oder `@EntityGraph` nutzen, siehe `NewsRepository`).
- Text-Spalten (`TEXT`) in Entities mit `@Column(columnDefinition = "text")` mappen.

## Security (config/SecurityConfig.java)

- Session-Login per `formLogin` unter `POST /api/auth/login` (form-urlencoded
  `username`, `password`), Antwort 200 bzw. 401 statt Redirect.
- `POST /api/auth/logout` → 204. `GET /api/auth/me` → Login-Status + Rollen und setzt
  nebenbei das CSRF-Cookie.
- Nicht eingeloggt auf geschützter API → 401 (`HttpStatusEntryPoint`).
- CSRF aktiv: Cookie `XSRF-TOKEN` (nicht HttpOnly), Frontend sendet Header `X-XSRF-TOKEN`
  (`static/js/api.js`). Nach Login/Logout `/api/auth/me` erneut aufrufen (Token rotiert).
- Regeln: GET `/api/news|events|waste|contacts/**` öffentlich (bei Kontakten filtert der
  `ContactService`: Gäste nur `public = true`); `/api/board/**`, `/api/push/**` nur eingeloggt; Schreibzugriffe auf
  news/events/waste/contacts nur `ROLE_ADMIN`.
- Passwort-Hashing: `DelegatingPasswordEncoder` (bcrypt).
- Erster Admin wird beim Start von `AdminInitializer` aus `ADMIN_USERNAME`
  (Standard `admin`) und `ADMIN_PASSWORD` angelegt, falls noch kein Admin existiert.

## Frontend

- Single-Page-App mit Hash-Router in `static/js/app.js`. Routen:
  - `#/login`
  - News: `#/news`, `#/news/neu`, `#/news/:id`, `#/news/:id/bearbeiten`
  - Termine: `#/termine`, `#/termine/vergangen`, `#/termine/neu`, `#/termine/:id`,
    `#/termine/:id/bearbeiten`
  - Müll: `#/muell`, `#/muell/vergangen`, `#/muell/neu`, `#/muell/import`,
    `#/muell/:id/bearbeiten` (keine Detailseite – die Zeile führt Admins direkt ins Formular)
  - Kontakte: `#/kontakte`, `#/kontakte/neu`, `#/kontakte/:id/bearbeiten` (keine Detailseite)
  - noch Platzhalter: `#/brett`
- `static/js/api.js` kennt vier Arten von Anfragen: GET, `body` (JSON), `form`
  (form-urlencoded, für den Login) und `upload` (FormData, für den ICS-Import).
- Alle Daten aus der API **immer escapen** (`escapeHtml`). Kein HTML aus der Datenbank
  rendern; Fließtext wird über Leerzeilen in Absätze geteilt.
- Gestaltung: Bereichsfarben nach Tonnenfarben (`--c-news` blau, `--c-events` grün,
  `--c-waste` gelb, `--c-contacts` grau, `--c-board` Kork). Hell-/Dunkelmodus über
  `prefers-color-scheme`. Handy: Tab-Leiste unten; ab 900 px: Seitenleiste links.
- **Keine Google Fonts oder andere externe CDNs** (DSGVO in Deutschland) – Systemschrift.
- Texte in einfachem Deutsch aus Nutzersicht, Buttons sagen, was passiert.

## Lokal starten (Windows)

1. Docker Desktop starten („Engine running“).
2. In IntelliJ Run-Konfiguration `MicrohubApplication` mit Umgebungsvariable
   `ADMIN_PASSWORD=…` starten (steht nur in `.idea`, das per `.gitignore` ausgeschlossen ist).
3. Browser: http://localhost:8080
4. DB prüfen:
   `docker exec -it microhub-postgres-1 psql -U microhub -d microhub`

Lokale DB-Zugangsdaten (nur Entwicklung): DB/User `microhub`, Passwort `devpassword`.

## Aktueller Stand

- [x] Projektgerüst, GitHub-Repo, Oracle-Cloud-Konto (Free Tier, noch keine Ressourcen)
- [x] Datenmodell (V1), Security, Admin-Initialisierung – lokal getestet, Admin existiert
- [x] News-Modul (API) + Frontend (Startseite, Login, News lesen/schreiben/bearbeiten/löschen)
      – committet in `92c48e5`, `mvnw compile` läuft fehlerfrei
- [x] Termine-Modul (API) + Frontend (Liste, kommend/vergangen, Detail, Formular)
- [x] Müllabfuhr (API, ICS-Import, Frontend) – Erinnerung per Push kommt später
- [x] Kontakte (API + Frontend, öffentlich/intern getrennt)
- [ ] Schwarzes Brett
- [ ] Benutzerverwaltung / Registrierung über Freischaltcodes
- [ ] PWA (manifest.json, Service Worker, Icons, Offline-Fallback)
- [ ] Web Push (VAPID)
- [ ] Tests + GitHub Actions CI
- [ ] Deployment auf Oracle Cloud + DNS + HTTPS

## Handover – Stand 26.10.2026

**Zuletzt gemacht:** Kontakte-Modul fertig (Migration V2, API, Frontend), mit Gast und Admin
im Browser getestet. Commits `2cb4c52` (API) und `984bffd` (Frontend) plus diese Doku liegen
nur lokal – `origin/master` steht auf `e53769f`.

**Zustand der lokalen Umgebung:**
- Datenbank enthält die **185 echten Abfuhrtermine** aus den ICS-Dateien des Landkreises
  (02.01.2026 bis 30.12.2027) – echte Daten, nicht wegwerfen. Flyway steht auf `V2`.
- Genau **ein Benutzer**: `admin` (ROLE_ADMIN). News, Termine und Kontakte sind leer.
- Der Container `microhub-postgres-1` läuft oder lässt sich mit dem App-Start neu hochziehen.

**Nächster Schritt: Schwarzes Brett** (Tabelle `board_post` mit `expires_at` steht schon in V1).
Vorher mit dem Entwickler klären: Wer darf löschen (Autor und Admin?), wie lange bleibt ein
Beitrag stehen (Standard für `expires_at`), braucht es Arten wie „Biete/Suche“?

Danach: Benutzerverwaltung mit Freischaltcodes.

## Getroffene Entscheidungen

1. **Registrierung über Freischaltcodes** (18.10.2026): Es gibt eine Selbstregistrierung,
   aber nur mit gültigem Code. Ein Code ist **maximal 2× einlösbar** – zwei Personen pro
   Wohnung. Der Admin erzeugt und verteilt die Codes.
   → Braucht später eine Migration `V…__invite_code.sql` (Tabelle `invite_code` mit
   `code`, `label` für die Wohnung, `max_uses` Standard 2, `used_count`, `expires_at`,
   `created_at`), eine Registrierungsseite und eine Admin-Ansicht für die Codes.
2. **Kontakte nach Kategorie trennen** (18.10.2026): Öffentliche Kontakte (z. B.
   Notfallnummern) sind auch für Gäste sichtbar, alle übrigen nur für Eingeloggte.
   → Braucht später die Spalte `public BOOLEAN NOT NULL DEFAULT FALSE` in `contact`
   (eigene Migration) und eine feinere Regel: GET `/api/contacts` wird öffentlich, liefert
   Gästen aber nur die öffentlichen Einträge.
3. **Müllabfuhr: ICS-Import** (18.10.2026, umgesetzt): Der Landkreis Vorpommern-Rügen bietet
   einen ICS-Export an. Der Admin lädt die Datei hoch, einzelne Termine kann er zusätzlich von
   Hand pflegen. Das Feld `area` bleibt vorerst leer (eine Tour).
   → Einzelheiten unter „Festlegungen Müllabfuhr-Modul“.

## Festlegungen Termine-Modul

- Liste zeigt standardmäßig **kommende** Termine aufsteigend (der nächste zuerst);
  vergangene Termine sind über einen Umschalter erreichbar (absteigend).
- Grenze zwischen kommend und vergangen ist **der Beginn des heutigen Tages in
  Europe/Berlin**, damit ein Termin von heute Vormittag nicht schon mittags verschwindet.
- Ganztägige Termine (`all_day = true`) werden als Mitternacht Europe/Berlin gespeichert;
  das Frontend zeigt dann nur das Datum, keine Uhrzeit.

## Festlegungen Müllabfuhr-Modul

- Der Entsorger ist der **Landkreis Vorpommern-Rügen**. Unter
  https://www.lk-vr.de/Abfallkalender gibt es nach Auswahl von Ort und Abfallarten einen
  Export als **ICS**, PDF oder CSV. Der Admin lädt die ICS-Datei unter `#/muell/import` hoch.
- Ein automatischer Abruf der dahinterliegenden Schnittstelle (`api.abfall.io`) ist bewusst
  **nicht** umgesetzt: direkte Aufrufe werden mit 403 abgewiesen, die Schnittstelle ist nicht
  dokumentiert und könnte jederzeit brechen.
- Der ICS-Parser (`IcsParser`) ist absichtlich klein gehalten statt eine Kalender-Bibliothek
  einzubinden: Abfuhrtermine sind immer ganztägig, gebraucht werden nur `DTSTART` und `SUMMARY`.
- Beschriftungen werden über Stichwörter auf die Abfallarten abgebildet
  (`bio`, `papier`/`pappe`, `gelb`/`verpackung`/`wertstoff`, `sperrmüll`,
  `restabfall`/`restmüll`/`hausmüll`). Alles andere landet unter `SONSTIGES` und behält
  seinen Originaltext als Hinweis – so wurde aus `Tannenbaum` ein sichtbarer Termin.
- **Stolperstelle:** `UNIQUE (waste_type, collection_date, area)` greift nicht, solange `area`
  leer ist – in PostgreSQL gilt `NULL` nie als gleich. Die Dublettenprüfung macht deshalb der
  `WasteService` bzw. `WasteImportService` selbst.
- In den Dateien des Landkreises fällt `Restabfallbehälter monatlich` immer auf einen Tag, an
  dem schon `Restabfallbehälter` steht. Das ist dieselbe Abfuhr (nur für Haushalte mit
  Monatsleerung) und wird von der Dublettenprüfung korrekt übersprungen.
- Der Import ist wiederholbar: aus derselben Datei entstehen beim zweiten Hochladen keine
  neuen Termine.
- Für den Upload steht in `application.yaml` `spring.servlet.multipart.max-file-size: 1MB`
  (die Jahresdateien des Landkreises sind knapp 40 KB groß).
- Mit den echten Dateien geprüft: 2026 → 106 Einträge, 94 angelegt, 12 übersprungen,
  `Tannenbaum` unter „Sonstiges“. 2027 → 103 Einträge, 91 angelegt, 12 übersprungen.

## Festlegungen Kontakte-Modul

- Keine Seitenaufteilung: ein Telefonbuch hat nur wenige Dutzend Einträge.
- Sortierung `sort_order`, dann `name`. Das Frontend gruppiert nach `category` in der
  Reihenfolge der ersten Zeile jeder Gruppe – `sort_order` steuert also auch die Gruppen.
  Kontakte ohne Kategorie stehen unter „Weitere Kontakte“.
- Das Java-Feld heißt `publicContact`, weil `public` ein Java-Schlüsselwort ist; die Spalte
  heißt `public`.
- Interne Kontakte liefern Gästen auch bei `GET /api/contacts/{id}` eine 404 (nicht 403),
  damit niemand erfährt, dass es den Eintrag gibt.
- Eingeloggt-Prüfung im Controller: Gäste haben ein `AnonymousAuthenticationToken`, das
  `isAuthenticated()` ebenfalls mit `true` beantwortet – der Typ muss mitgeprüft werden.
- Webseiten nur mit `http(s)://` (Validierung im Record und zusätzlich im Frontend), sonst
  wären `javascript:`-Links möglich.

## Bekannte Stolperstellen

- Jackson 3 lehnt JSON ab, in dem ein primitives Feld (`int`, `boolean`) eines Records fehlt
  (400 „Failed to read request“). Das Frontend schickt deshalb immer alle Felder.
- Im Formular-JS Felder über `form.elements.<name>` lesen: `form.name` ist der Name des
  Formulars selbst, nicht das Eingabefeld `name`.

- `src/test/.../MicrohubApplicationTests` (contextLoads) braucht eine Datenbank. Docker
  Compose wird in Tests standardmäßig übersprungen → Test schlägt ohne DB fehl.
  Vor dem CI-Schritt auf **Testcontainers** umstellen.
- Konfigurationsdatei heißt `application.yaml` (nicht `.yml`) – keine zweite anlegen.
- Push-Erinnerungen brauchen einen dauerhaft laufenden Server (Scheduler). Deshalb Oracle
  Cloud statt Plattformen, die schlafen gehen.

## Geplante Umsetzung PWA & Push

- `manifest.json` (Name, Icons 192/512 + maskable, `display: standalone`, Theme-Farben aus CSS),
  `sw.js` im Root von `static` (Pfade sind in der SecurityConfig schon freigegeben).
- Web Push mit VAPID; Java-Bibliothek in `pom.xml` ergänzen (vorher Version/Pflege prüfen und
  mit dem Entwickler abstimmen). Keys als Umgebungsvariablen, nie im Repo.
- iPhone: Push nur, wenn die Seite als PWA zum Home-Bildschirm hinzugefügt wurde (iOS 16.4+).
  Im UI erklären.
- Erinnerungen per `@Scheduled` (z. B. Vorabend 18 Uhr, Zeitzone Europe/Berlin),
  `reminder_sent` verhindert Doppelversand. Abgelaufene Abos (HTTP 404/410) löschen.

## Geplantes Deployment (Oracle Cloud Always Free)

- Konto ist im **Free Tier** – nicht auf Pay-As-You-Go upgraden. Nur Ressourcen mit
  „Always Free-eligible“ anlegen. Home-Region ist fest.
- Eine ARM-VM (Ubuntu), darauf Docker: App-Container + Postgres-Container + **Caddy**
  als Reverse Proxy mit automatischem Let's-Encrypt-HTTPS.
- `.dev` erzwingt HTTPS (HSTS-Preload) – ohne gültiges Zertifikat lädt die Seite nicht.
- DNS bei Name.com: A-Record `microhub.dev` (und ggf. `www`) auf die öffentliche IP der VM.
  Ports 80/443 in der Oracle Security List **und** in der VM-Firewall öffnen.
- Produktion: `COOKIE_SECURE=true`, `SPRING_DATASOURCE_URL/USERNAME/PASSWORD`,
  `ADMIN_PASSWORD`, VAPID-Keys als Umgebungsvariablen (z. B. `.env` nur auf dem Server).
- Docker-Image auf Basis eines Java-25-JRE-Images; Build/Deploy später per GitHub Actions.
- Regelmäßiges DB-Backup (`pg_dump` per Cron) einplanen.
