package dev.microhub.events;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/** Daten, die das Frontend beim Anlegen oder Bearbeiten eines Termins schickt. */
public record EventRequest(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 20000) String description,
        @Size(max = 200) String location,
        @NotNull Instant startsAt,
        Instant endsAt,
        boolean allDay) {

    /** Fängt „Ende vor Beginn“ schon hier ab – sonst käme ein Datenbankfehler statt einer 400. */
    @AssertTrue(message = "Das Ende darf nicht vor dem Beginn liegen.")
    public boolean isEndeNichtVorBeginn() {
        return startsAt == null || endsAt == null || !endsAt.isBefore(startsAt);
    }
}
