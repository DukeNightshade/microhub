package dev.microhub.board;

/**
 * Die Arten eines Aushangs aus der Prüfbedingung von board_post (Migration V3).
 * Die Beschriftung steht hier, damit Frontend und API dieselben Begriffe benutzen.
 */
public enum BoardKind {

    SUCHE("Suche"),
    BIETE("Biete"),
    TAUSCHE("Tausche");

    private final String label;

    BoardKind(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
