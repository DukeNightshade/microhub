package dev.microhub.board;

import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BoardPhotoRepository extends JpaRepository<BoardPhoto, Long> {

    /** Der Aushang samt Autor wird für die Sichtbarkeitsprüfung gebraucht. */
    @Override
    @EntityGraph(attributePaths = {"post", "post.author"})
    Optional<BoardPhoto> findById(Long id);
}
