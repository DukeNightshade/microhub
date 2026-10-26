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

**Wichtig:** Der Entwickler ist **Mieter**, nicht die Hausverwaltung. MicroHub ist ein privates
Projekt aus eigener Initiative. Texte nie so formulieren, als käme etwas von der Hausverwaltung
oder dem Vermieter – neutral „wer MicroHub betreut“ bzw. „Admin“. Die Druckzettel sagen
ausdrücklich, dass MicroHub kein Angebot der Hausverwaltung ist.

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
│                BadRequestException (→ 400), ForbiddenException (→ 403)
├── config/      SecurityConfig, WebConfig (registriert den MustChangePasswordInterceptor)
├── user/        AppUser, Role, AppUserRepository, AppUserDetailsService,
│                AdminInitializer, AuthController (me, register),
│                InviteCode, InviteCodeRepository, Secrets, PasswordRules,
│                AccountService/-Controller/-Requests („Mein Konto“),
│                AdminService/-Controller/-Dtos (Codes, Mitglieder),
│                SessionTerminator, MustChangePasswordInterceptor, AccountDeletedEvent,
│                AccountCleanupJob
├── news/        News, NewsRepository, NewsService, NewsController,
│                NewsRequest, NewsResponse, NewsListItem, NewsPage
├── events/      CalendarEvent, EventRepository, EventService, EventController,
│                EventRequest, EventResponse, EventListItem, EventPage
├── waste/       WasteCollection, WasteType, WasteRepository, WasteService,
│                WasteController, WasteImportService, IcsParser, IcsEvent,
│                WasteRequest, WasteItem, WastePage, WasteTypeOption, WasteImportResult
├── contacts/    Contact, ContactRepository, ContactService, ContactController,
│                ContactRequest, ContactItem
├── board/       BoardPost, BoardKind, BoardPostRepository, BoardService, BoardController,
│                BoardRequest, BoardItem, BoardList, BoardOptions, BoardPhoto,
│                BoardPhotoRepository, PhotoStorage, BoardCleanupJob
└── push/        (geplant) Web Push, Abos, Scheduler
src/main/resources/
├── application.yaml
├── db/migration/V1__init.sql … V7__cleanup_blocked_and_used.sql
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
  Ausgeführt sind `V1` bis `V6` (`V2` `contact.public`, `V3` `board_post.kind`,
  `V4` `board_post.contact`, `V5` `board_post.revived` + Tabelle `board_photo`,
  `V6` Tabelle `invite_code` + `app_user.invite_code_id`/`must_change_password`,
  `V7` `app_user.apartment`/`blocked_at`, `invite_code.revoked_at`, `invite_code_id` entfernt);
  die nächste Migration heißt `V8__…`.
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
  news/events/waste/contacts nur `ROLE_ADMIN`. Beim Brett prüft der `BoardService` je Aushang
  „Autor oder Admin“ (`BoardPost.canBeEditedBy`), sonst 403 (`ForbiddenException`).
  `/api/account/**` nur eingeloggt, `/api/admin/**` nur `ROLE_ADMIN`,
  `POST /api/auth/register` öffentlich.
- Login-Fehler antworten immer 401 – bewusst ohne Unterschied zwischen falschem Passwort und
  gesperrtem Konto (sonst ließe sich ohne Passwort prüfen, welche Benutzernamen es gibt).
- `SessionRegistry` (+ `HttpSessionEventPublisher`) kennt alle Sitzungen. `SessionTerminator`
  meldet ein Mitglied bei Sperre, Rollenwechsel und Passwort-Reset überall ab, weil Rolle und
  Sperre sonst erst beim nächsten Anmelden greifen würden.
- Einmal-Passwort: Der Login-Success-Handler setzt bei `must_change_password` ein
  Sitzungsmerkmal; `MustChangePasswordInterceptor` sperrt dann alle `/api/**` außer
  `/api/auth/**` und `PUT /api/account/password` (403).
- Passwort-Hashing: `DelegatingPasswordEncoder` (bcrypt). Passwörter 10–64 Zeichen und höchstens
  72 Byte (bcrypt-Grenze, `PasswordRules`).
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
  - Brett: `#/brett`, `#/brett/neu`, `#/brett/:id/bearbeiten` (nur eingeloggt, keine Detailseite)
  - Konto: `#/registrieren`, `#/konto` (bei Einmal-Passwort leitet der Router jede Route hierher)
  - Verwaltung (Admins, Link in der Kopfzeile): `#/verwaltung` (Mitglieder),
    `#/verwaltung/codes`, `#/verwaltung/drucken/:id,:id,…` (Zettel, `@media print`)
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
- [x] Schwarzes Brett (API + Frontend, Zettel-Karten mit Filter, bis zu 3 Fotos,
      einmal Neu-Aufhängen nach Ablauf, nächtlicher Aufräum-Job)
- [x] Benutzerverwaltung: Registrierung mit Freischaltcode, Mein Konto, Verwaltung von Codes
      (mit Druckzetteln) und Mitgliedern
- [ ] PWA (manifest.json, Service Worker, Icons, Offline-Fallback)
- [ ] Web Push (VAPID)
- [ ] Tests + GitHub Actions CI
- [ ] Deployment auf Oracle Cloud + DNS + HTTPS

## Handover – Stand 26.10.2026

**Zuletzt gemacht:** Kontakte, Schwarzes Brett (mit Fotos und Ablaufregeln) und die
Benutzerverwaltung mit Freischaltcodes. Alles mit Gast, Mitgliedern und Admin im Browser
getestet. Damit sind alle fünf Bereiche fertig.

**Zustand der lokalen Umgebung:**
- Datenbank enthält die **185 echten Abfuhrtermine** aus den ICS-Dateien des Landkreises
  (02.01.2026 bis 30.12.2027) – echte Daten, nicht wegwerfen. Flyway steht auf `V7`.
- Benutzer `admin` plus **Testdaten des Entwicklers** (Konto „Melonie“ gesperrt, Codes „Test“
  und „EG re“, ein Aushang mit Foto) – nicht ungefragt löschen.
- Der Entwickler startet die App oft selbst in IntelliJ (Port 8080, baut bei Änderungen
  automatisch neu). Eigene Testinstanzen auf **Port 8081** mit
  `--spring.docker.compose.lifecycle-management=start-only` starten und nur sie beenden.
- Fotos landen lokal in `data/uploads/` im Projektordner (per `.gitignore` ausgeschlossen).
- Der Container `microhub-postgres-1` läuft oder lässt sich mit dem App-Start neu hochziehen.

**Nächster Schritt: mit dem Entwickler festlegen.** Offen sind PWA, Web Push, Tests + CI und
das Deployment. Vorgeschlagen (26.10.2026): erst Tests (Testcontainers) + CI, dann Deployment,
damit echte Nutzer starten können; PWA und Push danach.

## Getroffene Entscheidungen

1. **Registrierung über Freischaltcodes** (18.10.2026): Es gibt eine Selbstregistrierung,
   aber nur mit gültigem Code. Ein Code ist **maximal 2× einlösbar** – zwei Personen pro
   Wohnung. Der Admin erzeugt und verteilt die Codes. **Umgesetzt (26.10.2026)** mit diesen
   Festlegungen des Entwicklers:
   - Registrierung fragt nur **Anzeigename, Benutzername, Passwort** ab – keine E-Mail
     (Datensparsamkeit). Danach wird automatisch angemeldet.
   - Codes **laufen nicht ab** (daher kein `expires_at`), der Admin kann sie sperren. Format
     `XXXX-XXXX-XXXX` ohne verwechselbare Zeichen; Eingabe in beliebiger Schreibweise.
   - **Aufräumen** (26.10.2026, nachgeschärft): Ein **aufgebrauchter Code** wird bei der zweiten
     Registrierung sofort gelöscht (die Wohnung steht deshalb in `app_user.apartment`).
     **Gesperrte Codes und gesperrte Mitglieder** kann der Admin sofort löschen; sonst löscht
     sie `AccountCleanupJob` **14 Tage nach dem Sperren** (nachts 3:45 Uhr). Entsperren stoppt
     die Frist. Ein gelöschtes Mitglied verliert auch seine Aushänge und Fotos.
   - Verteilung über **Zettel zum Ausdrucken** (einer pro Wohnung, mit Anleitung).
   - **Passwort vergessen:** Der Admin erzeugt ein Einmal-Passwort, das beim nächsten Anmelden
     sofort ersetzt werden muss. Kein Mailversand.
   - **Admin:** Mitgliederliste (mit Wohnung aus dem Code), Passwort zurücksetzen,
     sperren/entsperren, Admin-Rechte vergeben/entziehen. Sich selbst sperren/herabstufen geht
     nicht, und es bleibt immer mindestens ein aktiver Admin.
   - **Mein Konto:** Passwort und Anzeigenamen ändern, Konto löschen (mit Passwort; löscht auch
     Aushänge und Fotos). Ein gelöschtes Konto gibt seinen Platz im Code nicht wieder frei.
   - Passwortregel: **mindestens 10 Zeichen**, keine Komplexitätsregeln.
2. **Kontakte nach Kategorie trennen** (18.10.2026): Öffentliche Kontakte (z. B.
   Notfallnummern) sind auch für Gäste sichtbar, alle übrigen nur für Eingeloggte.
   → Braucht später die Spalte `public BOOLEAN NOT NULL DEFAULT FALSE` in `contact`
   (eigene Migration) und eine feinere Regel: GET `/api/contacts` wird öffentlich, liefert
   Gästen aber nur die öffentlichen Einträge.
3. **Müllabfuhr: ICS-Import** (18.10.2026, umgesetzt): Der Landkreis Vorpommern-Rügen bietet
   einen ICS-Export an. Der Admin lädt die Datei hoch, einzelne Termine kann er zusätzlich von
   Hand pflegen. Das Feld `area` bleibt vorerst leer (eine Tour).
   → Einzelheiten unter „Festlegungen Müllabfuhr-Modul“.

4. **Schwarzes Brett** (26.10.2026): Aushänge bearbeiten und löschen dürfen **der Autor und
   der Admin**. Jeder Aushang hat eine feste Art **Suche, Biete oder Tausche** (Spalte `kind`,
   Migration V3). Die Laufzeit wählt man beim Schreiben: **7, 14, 30, 60 oder 90 Tage**,
   Standard 30; daraus wird `expires_at` berechnet, abgelaufene Aushänge werden nicht mehr
   angezeigt. Unter dem Aushang steht der **Anzeigename** (`display_name`), nicht der
   Benutzername. Gestaltung: **Zettel-Karten auf Kork** mit Filter „Alle · Suche · Biete ·
   Tausche“ (filtert im Browser). Für Rückmeldungen gibt es ein **eigenes optionales Feld
   „Kontakt“** (Migration V4) – bewusst nicht automatisch die E-Mail des Kontos (DSGVO).
   Telefonnummern und E-Mail-Adressen darin werden antippbar.
5. **Fotos am Brett** (26.10.2026): **bis zu 3 Fotos** pro Aushang; das erste steht oben auf
   dem Zettel („+2 Fotos“), Antippen öffnet eine Großansicht. Fotos verkleinert schon der
   Browser (max. 1600 px, JPEG), der Server kodiert sie neu (entfernt GPS-Daten) und legt eine
   600-px-Vorschau an. Dateien liegen im Upload-Ordner, in der DB nur `board_photo`.
6. **Ablauf und Aufräumen** (26.10.2026): Ein abgelaufener Aushang ist für andere unsichtbar.
   Der Autor sieht ihn unter „Deine abgelaufenen Aushänge“ und kann ihn innerhalb von
   **30 Tagen genau einmal** neu aufhängen (`revived`). Ein neu aufgehängter Aushang wird beim
   zweiten Ablauf gelöscht, ein nicht geretteter 30 Tage nach Ablauf – jeweils samt Fotos,
   durch `BoardCleanupJob` jede Nacht um 3:30 Uhr (Europe/Berlin).

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

- Den Aufräum-Job testet man, indem man die App mit `BOARD_CLEANUP_CRON="*/15 * * * * *"`
  startet (alle 15 Sekunden) und `expires_at` in der DB zurückdatiert. Für Konten/Codes
  entsprechend `USER_CLEANUP_CRON` und `blocked_at`/`revoked_at`.
- Methoden eines `@Transactional`-Service, die andere Beans aufrufen, müssen `public` sein –
  sonst landet der Aufruf beim Spring-Proxy mit leeren Feldern (NullPointerException).
- Bilddateien werden über `TransactionSynchronization` erst nach dem Commit gelöscht bzw. bei
  einem Rollback wieder entfernt – Datenbank und Upload-Ordner bleiben so beieinander.

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
- Vor dem Livegang mit dem Entwickler klären: **Impressum und Datenschutzerklärung**. Die
  öffentlichen Seiten (News, Termine, Müll) sind für jeden erreichbar, und es werden Daten von
  Nachbarn verarbeitet – als Privatperson trotzdem Pflichten prüfen (keine Rechtsberatung).
- Regelmäßiges DB-Backup (`pg_dump` per Cron) einplanen – **und den Upload-Ordner mitsichern**,
  sonst fehlen nach einer Wiederherstellung die Fotos.
- Fotos: `UPLOAD_DIR` auf ein Docker-Volume zeigen lassen (z. B. `/data/uploads`), damit sie
  ein neues App-Image überleben.
