package dev.microhub.board;

import dev.microhub.photos.PhotoStorage;
import dev.microhub.user.AccountDeletedEvent;
import java.util.List;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Löscht beim Löschen eines Kontos dessen Aushänge samt Fotodateien. Die Datenbank würde die
 * Zeilen per ON DELETE CASCADE zwar selbst entfernen – die Dateien im Upload-Ordner aber nicht.
 * Läuft in der Transaktion des Kontolöschens; die Dateien verschwinden erst nach dem Commit.
 */
@Component
public class BoardAccountListener {

    private final BoardPostRepository boardPostRepository;
    private final PhotoStorage photoStorage;

    public BoardAccountListener(BoardPostRepository boardPostRepository, PhotoStorage photoStorage) {
        this.boardPostRepository = boardPostRepository;
        this.photoStorage = photoStorage;
    }

    @EventListener
    public void onAccountDeleted(AccountDeletedEvent event) {
        List<BoardPost> posts = boardPostRepository.findByAuthorId(event.userId());
        photoStorage.deleteAfterCommit(posts.stream()
                .flatMap(post -> post.getPhotos().stream())
                .map(BoardPhoto::getFileKey)
                .toList());
        boardPostRepository.deleteAll(posts);
    }
}
