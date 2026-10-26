package dev.microhub.user;

import java.security.SecureRandom;

/**
 * Erzeugt Freischaltcodes und Einmal-Passwörter. Ohne leicht verwechselbare Zeichen
 * (0/O, 1/I/L), weil beides von Papier abgetippt wird.
 */
final class Secrets {

    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final String PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    /** 12 Zeichen aus 31 → rund 10^17 Möglichkeiten; Durchprobieren ist aussichtslos. */
    static final int CODE_LENGTH = 12;

    private Secrets() {
    }

    /** Gespeichert wird der Code ohne Bindestriche, siehe {@link #formatCode}. */
    static String newCode() {
        return random(CODE_ALPHABET, CODE_LENGTH);
    }

    /** Für den Zettel: „K7QM3XPA9TRW“ → „K7QM-3XPA-9TRW“. */
    static String formatCode(String code) {
        return code.replaceAll("(.{4})(?!$)", "$1-");
    }

    /** Eingaben wie „k7qm 3xpa-9trw“ werden zu „K7QM3XPA9TRW“. */
    static String normalizeCode(String input) {
        return input == null ? "" : input.toUpperCase().replaceAll("[^A-Z0-9]", "");
    }

    /** Einmal-Passwort wie „kq7m-3xpa-9trw“: 14 Zeichen, erfüllt die Mindestlänge. */
    static String newTemporaryPassword() {
        return formatCode(random(PASSWORD_ALPHABET, 12)).toLowerCase();
    }

    private static String random(String alphabet, int length) {
        StringBuilder result = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            result.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
        }
        return result.toString();
    }
}
