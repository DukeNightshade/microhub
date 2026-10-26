-- Bis zu fünf Bilder pro News-Beitrag; das erste (kleinste position) ist das Titelbild.
-- Die Dateien liegen im Upload-Ordner, file_key ist ihr zufälliger Dateiname (wie board_photo).
CREATE TABLE news_photo (
    id         BIGSERIAL   PRIMARY KEY,
    news_id    BIGINT      NOT NULL REFERENCES news (id) ON DELETE CASCADE,
    file_key   VARCHAR(40) NOT NULL UNIQUE,
    position   INT         NOT NULL,
    width      INT         NOT NULL,
    height     INT         NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_news_photo_news ON news_photo (news_id);
