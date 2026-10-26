-- Wie Interessierte den Autor erreichen (Wohnung, Telefon, E-Mail …). Optional und vom Autor
-- selbst eingetragen – bewusst nicht automatisch aus dem Konto, damit niemand ungewollt Daten preisgibt.
ALTER TABLE board_post ADD COLUMN contact VARCHAR(200);
