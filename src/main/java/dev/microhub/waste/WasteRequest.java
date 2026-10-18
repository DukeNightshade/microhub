package dev.microhub.waste;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** Daten, die das Frontend beim Eintragen oder Ändern einer Abfuhr schickt. */
public record WasteRequest(
        @NotNull WasteType wasteType,
        @NotNull LocalDate collectionDate,
        @Size(max = 300) String note) {
}
