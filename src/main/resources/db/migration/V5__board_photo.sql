-- Ein abgelaufener Aushang darf vom Autor genau einmal neu aufgehängt werden.
ALTER TABLE board_post ADD COLUMN revived BOOLEAN NOT NULL DEFAULT FALSE;

-- Bis zu drei Fotos pro Aushang. Die Bilddateien liegen im Upload-Ordner (nicht in der Datenbank);
-- file_key ist ihr zufälliger Dateiname. Wird der Aushang gelöscht, verschwinden die Zeilen mit.
CREATE TABLE board_photo (
    id         BIGSERIAL   PRIMARY KEY,
    post_id    BIGINT      NOT NULL REFERENCES board_post (id) ON DELETE CASCADE,
    file_key   VARCHAR(40) NOT NULL UNIQUE,
    position   INT         NOT NULL,
    width      INT         NOT NULL,
    height     INT         NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_board_photo_post ON board_photo (post_id);
