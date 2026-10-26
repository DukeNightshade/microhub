package dev.microhub.events;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * Wann und wo ein Termin stattfindet – ohne Titel und Beschreibung. So schickt der News-Editor
 * den Termin zu einem Beitrag mit; Titel und Text kommen dann aus der News selbst.
 */
public record EventTiming(
        @NotNull Instant startsAt,
        Instant endsAt,
        boolean allDay,
        @Size(max = 200) String location) {

    /** Fängt „Ende vor Beginn“ schon hier ab – sonst käme ein Datenbankfehler statt einer 400. */
    @AssertTrue(message = "Das Ende darf nicht vor dem Beginn liegen.")
    public boolean isEndNotBeforeStart() {
        return startsAt == null || endsAt == null || !endsAt.isBefore(startsAt);
    }
}
