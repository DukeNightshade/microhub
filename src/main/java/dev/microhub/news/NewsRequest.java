package dev.microhub.news;

import dev.microhub.events.EventTiming;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Daten, die das Frontend beim Anlegen oder Bearbeiten schickt.
 * event ist gesetzt, wenn der Beitrag einen Termin im Kalender hat; fehlt es, wird ein
 * vorhandener Termin entfernt.
 */
public record NewsRequest(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 500) String summary,
        @NotBlank @Size(max = 20000) String content,
        @Valid EventTiming event) {
}
