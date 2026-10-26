package dev.microhub.board;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Daten, die das Frontend beim Schreiben oder Bearbeiten eines Aushangs schickt.
 * Der Autor fehlt bewusst: Er ist immer der angemeldete Benutzer, sonst könnte jemand
 * im Namen anderer posten.
 */
public record BoardRequest(
        @NotNull BoardKind kind,
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 5000) String content,
        int durationDays) {

    @AssertTrue(message = "Die Laufzeit muss 7, 14, 30, 60 oder 90 Tage betragen.")
    public boolean isDurationAllowed() {
        return BoardService.DURATIONS.contains(durationDays);
    }
}
