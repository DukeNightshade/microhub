package dev.microhub.waste;

import java.util.List;

/**
 * Was der ICS-Import gemacht hat.
 *
 * @param found        Termine in der Datei
 * @param imported     neu angelegte Abfuhren
 * @param skipped      übersprungen, weil es den Tag mit dieser Abfallart schon gab
 * @param unknownTypes Beschriftungen, die keiner bekannten Abfallart entsprachen
 */
public record WasteImportResult(int found, int imported, int skipped, List<String> unknownTypes) {
}
