-- Freischaltcodes: Der Admin erzeugt pro Wohnung einen Code, mit dem sich bis zu zwei Personen
-- registrieren können. Ein Code läuft nicht ab, kann aber gesperrt werden.
CREATE TABLE invite_code (
    id         BIGSERIAL    PRIMARY KEY,
    code       VARCHAR(20)  NOT NULL UNIQUE,
    label      VARCHAR(100) NOT NULL,            -- z. B. „Whg. 3“
    max_uses   INT          NOT NULL DEFAULT 2 CHECK (max_uses > 0),
    used_count INT          NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    revoked    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Über welchen Code jemand kam (zeigt dem Admin die Wohnung); bleibt leer beim ersten Admin.
ALTER TABLE app_user ADD COLUMN invite_code_id BIGINT REFERENCES invite_code (id) ON DELETE SET NULL;

-- Nach einem Zurücksetzen durch den Admin muss das Einmal-Passwort sofort geändert werden.
ALTER TABLE app_user ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
