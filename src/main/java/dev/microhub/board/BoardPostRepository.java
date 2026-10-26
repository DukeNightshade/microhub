package dev.microhub.board;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BoardPostRepository extends JpaRepository<BoardPost, Long> {

    /**
     * Nur noch nicht abgelaufene Aushänge, neueste zuerst. Ohne Seiten, weil Aushänge nach
     * spätestens 90 Tagen ablaufen. Der Autor wird gleich mitgeladen (vermeidet eine Abfrage pro Eintrag).
     */
    @EntityGraph(attributePaths = "author")
    List<BoardPost> findByExpiresAtAfterOrderByCreatedAtDesc(Instant now);
}
