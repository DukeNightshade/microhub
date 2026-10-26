package dev.microhub.board;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Daten, die das Frontend beim Schreiben oder Bearbeiten eines Aushangs schickt.
 * Der Autor fehlt bewusst: Er ist immer der angemeldete Benutzer, sonst könnte jemand
 * im Namen anderer posten.
 *
 * Kontakt ist Pflicht (freie Eingabe), damit jeder Aushang erreichbar ist. Einen Preis gibt es
 * nur bei „Biete“: Betrag in Cent (0 = zu verschenken) und bei Beträgen über 0 Festpreis oder VB.
 */
public record BoardRequest(
        @NotNull BoardKind kind,
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 5000) String content,
        @NotBlank @Size(max = 200) String contact,
        @Min(0) @Max(100_000_000) Integer priceCents,
        PriceType priceType,
        int durationDays) {

    @AssertTrue(message = "Die Laufzeit muss 7, 14, 30, 60 oder 90 Tage betragen.")
    public boolean isDurationAllowed() {
        return BoardService.DURATIONS.contains(durationDays);
    }

    @AssertTrue(message = "Bei „Biete“ braucht es einen Preis und bei mehr als 0 € Festpreis oder VB.")
    public boolean isPriceComplete() {
        if (kind != BoardKind.BIETE) return true; // bei Suche und Tausche wird ein Preis einfach ignoriert
        return priceCents != null && (priceCents == 0 || priceType != null);
    }
}
