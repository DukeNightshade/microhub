-- Öffentliche Kontakte (z. B. Notfallnummern) sehen auch Gäste, alle übrigen nur Eingeloggte.
ALTER TABLE contact ADD COLUMN public BOOLEAN NOT NULL DEFAULT FALSE;
