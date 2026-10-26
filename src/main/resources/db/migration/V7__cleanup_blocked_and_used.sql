-- Gesperrte Mitglieder und Codes werden 14 Tage nach dem Sperren gelöscht, aufgebrauchte Codes
-- sofort. Damit die Wohnung eines Mitglieds dabei nicht verloren geht, steht sie jetzt am Konto
-- selbst statt nur am Code.
ALTER TABLE app_user ADD COLUMN apartment VARCHAR(100);
UPDATE app_user u SET apartment = c.label FROM invite_code c WHERE u.invite_code_id = c.id;
ALTER TABLE app_user DROP COLUMN invite_code_id;

-- Seit wann gesperrt? Danach richtet sich das automatische Löschen.
ALTER TABLE app_user ADD COLUMN blocked_at TIMESTAMPTZ;
UPDATE app_user SET blocked_at = now() WHERE NOT enabled;

ALTER TABLE invite_code ADD COLUMN revoked_at TIMESTAMPTZ;
UPDATE invite_code SET revoked_at = now() WHERE revoked;

DELETE FROM invite_code WHERE used_count >= max_uses;
