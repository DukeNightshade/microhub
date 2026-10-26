-- Preis bei „Biete“-Aushängen: Betrag in Cent (0 = zu verschenken) und Festpreis oder VB.
-- Bei „Suche“ und „Tausche“ bleiben beide Felder leer; das prüft der BoardService.
-- Bewusst keine strenge Datenbank-Regel „Biete braucht Preis“: ältere Aushänge haben noch keinen.
ALTER TABLE board_post ADD COLUMN price_cents INT CHECK (price_cents >= 0);
ALTER TABLE board_post ADD COLUMN price_type VARCHAR(10) CHECK (price_type IN ('FEST', 'VB'));
