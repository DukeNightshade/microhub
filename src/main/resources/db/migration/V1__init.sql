-- =========================================================
-- MicroHub – Initiales Datenbankschema
-- =========================================================

-- Benutzer (Gäste haben kein Konto, sie sind einfach nicht eingeloggt)
CREATE TABLE app_user (
    id            BIGSERIAL    PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL,
    email         VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('USER', 'ADMIN')),
    enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_app_user_username ON app_user (lower(username));
CREATE UNIQUE INDEX ux_app_user_email    ON app_user (lower(email));

-- News
CREATE TABLE news (
    id           BIGSERIAL    PRIMARY KEY,
    title        VARCHAR(200) NOT NULL,
    summary      VARCHAR(500),
    content      TEXT         NOT NULL,
    author_id    BIGINT       REFERENCES app_user (id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_news_published_at ON news (published_at DESC);

-- Termine
CREATE TABLE calendar_event (
    id          BIGSERIAL    PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    location    VARCHAR(200),
    starts_at   TIMESTAMPTZ  NOT NULL,
    ends_at     TIMESTAMPTZ,
    all_day     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by  BIGINT       REFERENCES app_user (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX ix_calendar_event_starts_at ON calendar_event (starts_at);

-- Müllabfuhr
CREATE TABLE waste_collection (
    id              BIGSERIAL   PRIMARY KEY,
    waste_type      VARCHAR(30) NOT NULL CHECK (waste_type IN
                    ('RESTMUELL', 'BIO', 'PAPIER', 'GELBER_SACK', 'SPERRMUELL', 'SONSTIGES')),
    collection_date DATE        NOT NULL,
    area            VARCHAR(100),          -- optional: Straße/Bezirk, falls es mehrere Touren gibt
    note            VARCHAR(300),
    reminder_sent   BOOLEAN     NOT NULL DEFAULT FALSE,
    UNIQUE (waste_type, collection_date, area)
);
CREATE INDEX ix_waste_collection_date ON waste_collection (collection_date);

-- Kontakte
CREATE TABLE contact (
    id           BIGSERIAL    PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    organization VARCHAR(150),
    category     VARCHAR(50),               -- z. B. Notfall, Verwaltung, Handwerk
    phone        VARCHAR(50),
    email        VARCHAR(255),
    address      VARCHAR(300),
    website      VARCHAR(300),
    note         VARCHAR(500),
    sort_order   INT          NOT NULL DEFAULT 0
);

-- Schwarzes Brett (nur für eingeloggte Benutzer)
CREATE TABLE board_post (
    id         BIGSERIAL    PRIMARY KEY,
    title      VARCHAR(200) NOT NULL,
    content    TEXT         NOT NULL,
    author_id  BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ                  -- Aushänge können automatisch ablaufen
);
CREATE INDEX ix_board_post_created_at ON board_post (created_at DESC);

-- Push-Abonnements (ein Benutzer kann mehrere Geräte haben)
CREATE TABLE push_subscription (
    id            BIGSERIAL    PRIMARY KEY,
    user_id       BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    endpoint      TEXT         NOT NULL UNIQUE,
    p256dh        VARCHAR(255) NOT NULL,
    auth          VARCHAR(255) NOT NULL,
    user_agent    VARCHAR(300),
    notify_news   BOOLEAN      NOT NULL DEFAULT TRUE,
    notify_events BOOLEAN      NOT NULL DEFAULT TRUE,
    notify_waste  BOOLEAN      NOT NULL DEFAULT TRUE,
    notify_board  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
