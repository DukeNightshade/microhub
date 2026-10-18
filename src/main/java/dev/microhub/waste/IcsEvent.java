package dev.microhub.waste;

import java.time.LocalDate;

/** Ein ganztägiger Termin aus einer ICS-Datei: mehr braucht die Müllabfuhr nicht. */
public record IcsEvent(LocalDate date, String summary) {
}
