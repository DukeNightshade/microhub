package dev.microhub.events;

import java.time.Instant;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventRepository extends JpaRepository<CalendarEvent, Long> {

    /** Kommende Termine: der nächste zuerst. Wer ihn eingetragen hat, wird mitgeladen. */
    @EntityGraph(attributePaths = "createdBy")
    Slice<CalendarEvent> findByStartsAtGreaterThanEqualOrderByStartsAtAsc(Instant from, Pageable pageable);

    /** Vergangene Termine: der zuletzt gewesene zuerst. */
    @EntityGraph(attributePaths = "createdBy")
    Slice<CalendarEvent> findByStartsAtLessThanOrderByStartsAtDesc(Instant from, Pageable pageable);
}
