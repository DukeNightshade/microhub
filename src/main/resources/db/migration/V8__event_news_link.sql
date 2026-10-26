-- Ein Termin kann zu einem News-Beitrag gehören (höchstens einer pro Beitrag).
-- Wird der Beitrag gelöscht, verschwindet der Termin mit (Entscheidung vom 26.10.2026).
ALTER TABLE calendar_event ADD COLUMN news_id BIGINT UNIQUE REFERENCES news (id) ON DELETE CASCADE;
