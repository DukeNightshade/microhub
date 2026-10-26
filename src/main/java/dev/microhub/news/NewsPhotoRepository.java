package dev.microhub.news;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NewsPhotoRepository extends JpaRepository<NewsPhoto, Long> {

    List<NewsPhoto> findByNewsIdOrderByPositionAsc(Long newsId);

    /** Für den Feed: die Bilder aller Beiträge einer Seite auf einmal. */
    List<NewsPhoto> findByNewsIdInOrderByPositionAsc(Collection<Long> newsIds);

    long countByNewsId(Long newsId);
}
