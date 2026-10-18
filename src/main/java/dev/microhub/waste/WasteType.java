package dev.microhub.waste;

/**
 * Die Abfallarten aus der Prüfbedingung von waste_collection.
 * Die Beschriftung steht hier, damit Frontend und API dieselben Begriffe benutzen.
 */
public enum WasteType {

    RESTMUELL("Restmüll"),
    BIO("Biotonne"),
    PAPIER("Papier"),
    GELBER_SACK("Gelber Sack"),
    SPERRMUELL("Sperrmüll"),
    SONSTIGES("Sonstiges");

    private final String label;

    WasteType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
