package dev.microhub.board;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface BoardPostRepository extends JpaRepository<BoardPost, Long> {

    /**
     * Noch hängende Aushänge, neueste zuerst. Ohne Seiten, weil Aushänge nach spätestens
     * 90 Tagen ablaufen. Autor und Fotos werden gleich mitgeladen (vermeidet Abfragen pro Eintrag).
     */
    @EntityGraph(attributePaths = {"author", "photos"})
    List<BoardPost> findByExpiresAtAfterOrderByCreatedAtDesc(Instant now);

    /** Eigene abgelaufene Aushänge, die sich noch einmal aufhängen lassen. */
    @EntityGraph(attributePaths = {"author", "photos"})
    List<BoardPost> findByAuthorIdAndRevivedFalseAndExpiresAtBetweenOrderByExpiresAtDesc(
            Long authorId, Instant revivableSince, Instant now);

    /**
     * Für den nächtlichen Aufräum-Job: neu aufgehängte Aushänge sind beim zweiten Ablauf fällig,
     * alle anderen 30 Tage nach dem Ablauf (siehe BoardPost.getDeletionDate).
     */
    @EntityGraph(attributePaths = "photos")
    @Query("""
            select p from BoardPost p
            where (p.revived = true and p.expiresAt <= :now)
               or (p.revived = false and p.expiresAt <= :revivableSince)
            """)
    List<BoardPost> findDueForDeletion(Instant now, Instant revivableSince);

    /** Alle Aushänge eines Mitglieds, z. B. wenn es sein Konto löscht. */
    @EntityGraph(attributePaths = "photos")
    List<BoardPost> findByAuthorId(Long authorId);
}
