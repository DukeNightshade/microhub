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
├── common/      NotFoundException (→ 404)
├── config/      SecurityConfig
├── user/        AppUser, Role, AppUserRepository, AppUserDetailsService,
│                AdminInitializer, AuthController
├── news/        News, NewsRepository, NewsService, NewsController,
│                NewsRequest, NewsResponse, NewsListItem, NewsPage
├── events/      CalendarEvent, EventRepository, EventService, EventController,
│                EventRequest, EventResponse, EventListItem, EventPage
├── waste/       (geplant) Müllabfuhr
├── contacts/    (geplant)
├── board/       (geplant) Schwarzes Brett
└── push/        (geplant) Web Push, Abos, Scheduler
src/main/resources/
├── application.yaml
├── db/migration/V1__init.sql
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
- Regeln: GET `/api/news|events|waste/**` öffentlich; GET `/api/contacts/**`,
  `/api/board/**`, `/api/push/**` nur eingeloggt; Schreibzugriffe auf
  news/events/waste/contacts nur `ROLE_ADMIN`.
- Passwort-Hashing: `DelegatingPasswordEncoder` (bcrypt).
- Erster Admin wird beim Start von `AdminInitializer` aus `ADMIN_USERNAME`
  (Standard `admin`) und `ADMIN_PASSWORD` angelegt, falls noch kein Admin existiert.

## Frontend

- Single-Page-App mit Hash-Router in `static/js/app.js` (`#/news`, `#/news/:id`,
  `#/news/neu`, `#/news/:id/bearbeiten`, `#/login`, `#/termine`, `#/muell`,
  `#/kontakte`, `#/brett`).
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
- [ ] Müllabfuhr (inkl. späterer Erinnerung per Push)
- [ ] Kontakte
- [ ] Schwarzes Brett
- [ ] Benutzerverwaltung / Registrierung über Freischaltcodes
- [ ] PWA (manifest.json, Service Worker, Icons, Offline-Fallback)
- [ ] Web Push (VAPID)
- [ ] Tests + GitHub Actions CI
- [ ] Deployment auf Oracle Cloud + DNS + HTTPS

## Getroffene Entscheidungen

1. **Registrierung über Freischaltcodes** (18.10.2026): Es gibt eine Selbstregistrierung,
   aber nur mit gültigem Code. Ein Code ist **maximal 2× einlösbar** – zwei Personen pro
   Wohnung. Der Admin erzeugt und verteilt die Codes.
   → Braucht später die Migration `V2__invite_code.sql` (Tabelle `invite_code` mit
   `code`, `label` für die Wohnung, `max_uses` Standard 2, `used_count`, `expires_at`,
   `created_at`), eine Registrierungsseite und eine Admin-Ansicht für die Codes.
2. **Kontakte nach Kategorie trennen** (18.10.2026): Öffentliche Kontakte (z. B.
   Notfallnummern) sind auch für Gäste sichtbar, alle übrigen nur für Eingeloggte.
   → Braucht später die Spalte `public BOOLEAN NOT NULL DEFAULT FALSE` in `contact`
   (Migration `V3`) und eine feinere Regel: GET `/api/contacts` wird öffentlich, liefert
   Gästen aber nur die öffentlichen Einträge.
3. **Müllabfuhr: ICS-Import, wenn möglich** (18.10.2026): Vor dem Müll-Modul prüfen, ob der
   zuständige Entsorger eine ICS-Datei anbietet. Wenn ja, importiert der Admin sie; wenn
   nein, pflegt er die Termine von Hand. Das Feld `area` bleibt vorerst leer (eine Tour).

## Festlegungen Termine-Modul

- Liste zeigt standardmäßig **kommende** Termine aufsteigend (der nächste zuerst);
  vergangene Termine sind über einen Umschalter erreichbar (absteigend).
- Grenze zwischen kommend und vergangen ist **der Beginn des heutigen Tages in
  Europe/Berlin**, damit ein Termin von heute Vormittag nicht schon mittags verschwindet.
- Ganztägige Termine (`all_day = true`) werden als Mitternacht Europe/Berlin gespeichert;
  das Frontend zeigt dann nur das Datum, keine Uhrzeit.

## Bekannte Stolperstellen

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
