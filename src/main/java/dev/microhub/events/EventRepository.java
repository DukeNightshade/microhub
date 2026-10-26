package dev.microhub.events;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventRepository extends JpaRepository<CalendarEvent, Long> {

    /** Für den Kalender: alle Termine, die im Zeitraum beginnen, der früheste zuerst. Ersteller mitladen. */
    @EntityGraph(attributePaths = "createdBy")
    List<CalendarEvent> findByStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAsc(Instant from, Instant to);

    Optional<CalendarEvent> findByNewsId(Long newsId);

    /** Für die News-Liste: die Termine aller Beiträge einer Seite auf einmal. */
    List<CalendarEvent> findByNewsIdIn(Collection<Long> newsIds);
}
