package dev.microhub.waste;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WasteRepository extends JpaRepository<WasteCollection, Long> {

    /** Kommende Abfuhren: die nächste zuerst. */
    Slice<WasteCollection> findByCollectionDateGreaterThanEqualOrderByCollectionDateAsc(
            LocalDate from, Pageable pageable);

    /** Vergangene Abfuhren: die zuletzt gewesene zuerst. */
    Slice<WasteCollection> findByCollectionDateLessThanOrderByCollectionDateDesc(
            LocalDate from, Pageable pageable);

    /**
     * Die Tabelle hat zwar UNIQUE (waste_type, collection_date, area), das greift aber nicht,
     * solange area leer ist – in PostgreSQL gilt NULL nie als gleich. Deshalb hier prüfen.
     */
    boolean existsByWasteTypeAndCollectionDate(WasteType wasteType, LocalDate collectionDate);

    boolean existsByWasteTypeAndCollectionDateAndIdNot(WasteType wasteType, LocalDate collectionDate, Long id);

    /** Für den ICS-Import: alles im Zeitraum der Datei auf einmal holen. */
    List<WasteCollection> findByCollectionDateBetween(LocalDate from, LocalDate to);
}
