package dev.microhub.waste;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Liest die wenigen Felder aus einer ICS-Datei, die für Abfuhrtermine nötig sind:
 * je VEVENT das Datum aus DTSTART und die Beschriftung aus SUMMARY.
 *
 * Bewusst klein gehalten statt eine Kalender-Bibliothek einzubinden – Abfuhrtermine sind
 * immer ganztägig, und die Dateien der Entsorger enthalten nichts Exotisches.
 */
final class IcsParser {

    /** Schutz vor versehentlich hochgeladenen Riesen-Kalendern. */
    private static final int MAX_EVENTS = 5000;

    private IcsParser() {
    }

    static List<IcsEvent> parse(InputStream input) throws IOException {
        List<IcsEvent> events = new ArrayList<>();
        LocalDate date = null;
        String summary = null;
        boolean inEvent = false;

        for (String line : unfold(input)) {
            String name = propertyName(line);
            String value = propertyValue(line);

            switch (name) {
                case "BEGIN" -> {
                    if ("VEVENT".equals(value)) {
                        inEvent = true;
                        date = null;
                        summary = null;
                    }
                }
                case "END" -> {
                    if ("VEVENT".equals(value) && inEvent) {
                        if (date != null && summary != null && !summary.isBlank()) {
                            events.add(new IcsEvent(date, summary.strip()));
                            if (events.size() >= MAX_EVENTS) return events;
                        }
                        inEvent = false;
                    }
                }
                case "DTSTART" -> {
                    if (inEvent) date = toDate(value);
                }
                case "SUMMARY" -> {
                    if (inEvent) summary = unescape(value);
                }
                default -> {
                    // alles andere ist für Abfuhrtermine ohne Bedeutung
                }
            }
        }
        return events;
    }

    /**
     * Setzt Fortsetzungszeilen wieder zusammen: Eine Zeile, die mit Leerzeichen oder Tabulator
     * beginnt, gehört laut RFC 5545 an die vorige angehängt.
     */
    private static List<String> unfold(InputStream input) throws IOException {
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!lines.isEmpty() && (line.startsWith(" ") || line.startsWith("\t"))) {
                    int last = lines.size() - 1;
                    lines.set(last, lines.get(last) + line.substring(1));
                } else if (!line.isBlank()) {
                    lines.add(line);
                }
            }
        }
        return lines;
    }

    /** Aus „DTSTART;VALUE=DATE:20260102“ wird „DTSTART“. */
    private static String propertyName(String line) {
        int end = line.length();
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == ':' || c == ';') {
                end = i;
                break;
            }
        }
        return line.substring(0, end).toUpperCase();
    }

    private static String propertyValue(String line) {
        int colon = line.indexOf(':');
        return colon < 0 ? "" : line.substring(colon + 1);
    }

    /** Akzeptiert „20260102“ und „20260102T100000Z“ – uns interessiert nur der Tag. */
    private static LocalDate toDate(String value) {
        if (value.length() < 8) return null;
        String digits = value.substring(0, 8);
        if (!digits.chars().allMatch(Character::isDigit)) return null;
        try {
            return LocalDate.of(
                    Integer.parseInt(digits.substring(0, 4)),
                    Integer.parseInt(digits.substring(4, 6)),
                    Integer.parseInt(digits.substring(6, 8)));
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** ICS maskiert Komma, Semikolon, Backslash und Zeilenumbruch. */
    private static String unescape(String value) {
        return value.replace("\\n", " ")
                .replace("\\N", " ")
                .replace("\\,", ",")
                .replace("\\;", ";")
                .replace("\\\\", "\\");
    }
}
