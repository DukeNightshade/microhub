package dev.microhub.waste;

/** Eine Abfallart für die Auswahlliste im Formular. */
public record WasteTypeOption(WasteType value, String label) {

    static WasteTypeOption from(WasteType type) {
        return new WasteTypeOption(type, type.getLabel());
    }
}
