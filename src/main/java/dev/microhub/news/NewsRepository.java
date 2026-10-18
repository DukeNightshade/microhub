package dev.microhub.news;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NewsRepository extends JpaRepository<News, Long> {

    /** Neueste zuerst; der Autor wird gleich mitgeladen (vermeidet eine Abfrage pro Eintrag). */
    @EntityGraph(attributePaths = "author")
    Slice<News> findAllByOrderByPublishedAtDesc(Pageable pageable);
}
