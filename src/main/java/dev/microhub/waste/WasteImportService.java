package dev.microhub.waste;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Liest eine ICS-Datei des Entsorgers ein und legt daraus Abfuhrtermine an.
 * Schon vorhandene Termine werden übersprungen, die Datei kann also gefahrlos
 * ein zweites Mal hochgeladen werden.
 */
@Service
public class WasteImportService {

    private final WasteRepository wasteRepository;

    public WasteImportService(WasteRepository wasteRepository) {
        this.wasteRepository = wasteRepository;
    }

    @Transactional
    public WasteImportResult importIcs(InputStream input) throws IOException {
        List<IcsEvent> events = IcsParser.parse(input);
        if (events.isEmpty()) {
            return new WasteImportResult(0, 0, 0, List.of());
        }

        LocalDate from = events.stream().map(IcsEvent::date).min(Comparator.naturalOrder()).orElseThrow();
        LocalDate to = events.stream().map(IcsEvent::date).max(Comparator.naturalOrder()).orElseThrow();

        // Was im Zeitraum schon in der Datenbank steht, einmal holen statt je Termin zu fragen.
        Set<String> known = new HashSet<>();
        wasteRepository.findByCollectionDateBetween(from, to)
                .forEach(existing -> known.add(key(existing.getWasteType(), existing.getCollectionDate())));

        List<WasteCollection> neu = new ArrayList<>();
        Set<String> unknownTypes = new TreeSet<>();
        int skipped = 0;

        for (IcsEvent event : events) {
            WasteType type = toWasteType(event.summary());
            if (type == WasteType.SONSTIGES) {
                unknownTypes.add(event.summary());
            }
            // Dubletten in der Datei selbst und gegen die Datenbank zugleich abfangen.
            if (!known.add(key(type, event.date()))) {
                skipped++;
                continue;
            }
            String note = type == WasteType.SONSTIGES ? event.summary() : null;
            neu.add(new WasteCollection(type, event.date(), note));
        }

        wasteRepository.saveAll(neu);
        return new WasteImportResult(events.size(), neu.size(), skipped, List.copyOf(unknownTypes));
    }

    /**
     * Ordnet die Beschriftung aus der ICS-Datei einer Abfallart zu.
     * Die Entsorger schreiben unterschiedlich („Restabfallbehälter“, „Hausmüll“), deshalb
     * wird auf Stichwörter geprüft statt auf exakte Gleichheit.
     */
    static WasteType toWasteType(String summary) {
        String text = summary.toLowerCase(Locale.GERMAN);
        if (text.contains("bio")) return WasteType.BIO;
        if (text.contains("papier") || text.contains("pappe")) return WasteType.PAPIER;
        if (text.contains("gelb") || text.contains("verpackung") || text.contains("wertstoff")) {
            return WasteType.GELBER_SACK;
        }
        if (text.contains("sperrmüll") || text.contains("sperrmuell")) return WasteType.SPERRMUELL;
        if (text.contains("restabfall") || text.contains("restmüll")
                || text.contains("restmuell") || text.contains("hausmüll") || text.contains("hausmuell")) {
            return WasteType.RESTMUELL;
        }
        return WasteType.SONSTIGES;
    }

    private static String key(WasteType type, LocalDate date) {
        return type.name() + "@" + date;
    }
}
