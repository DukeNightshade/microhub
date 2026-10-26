-- Art des Aushangs: Suche, Biete oder Tausche.
-- Der Standardwert füllt nur eventuell vorhandene Zeilen und wird danach entfernt,
-- damit die App die Art immer selbst angeben muss.
ALTER TABLE board_post
    ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'BIETE'
        CHECK (kind IN ('SUCHE', 'BIETE', 'TAUSCHE'));
ALTER TABLE board_post ALTER COLUMN kind DROP DEFAULT;
