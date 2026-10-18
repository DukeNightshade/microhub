package dev.microhub.waste;

import java.time.LocalDate;

/** Eine Abfuhr, wie sie das Frontend anzeigt. Das Label kommt mit, damit es nur eine Quelle gibt. */
public record WasteItem(
        Long id,
        WasteType wasteType,
        String label,
        LocalDate collectionDate,
        String note) {

    static WasteItem from(WasteCollection collection) {
        return new WasteItem(
                collection.getId(),
                collection.getWasteType(),
                collection.getWasteType().getLabel(),
                collection.getCollectionDate(),
                collection.getNote());
    }
}
