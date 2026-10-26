package dev.microhub.user;

import dev.microhub.common.ConflictException;
import java.nio.charset.StandardCharsets;

/**
 * Mindestens 10 Zeichen, keine Pflicht zu Sonderzeichen (Entscheidung vom 26.10.2026).
 * Die Länge prüfen schon die Request-Records per @Size; hier kommt die bcrypt-Grenze dazu.
 */
final class PasswordRules {

    static final int MIN_LENGTH = 10;
    static final int MAX_LENGTH = 64;

    /** bcrypt verarbeitet höchstens 72 Byte – Umlaute zählen in UTF-8 doppelt. */
    private static final int MAX_BYTES = 72;

    private PasswordRules() {
    }

    static void check(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            throw new ConflictException("Das Passwort ist zu lang. Bitte nimm ein etwas kürzeres.");
        }
    }
}
