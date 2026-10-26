package dev.microhub.board;

import dev.microhub.photos.PhotoStorage;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Löscht jede Nacht abgelaufene Aushänge samt Fotos, sobald sie sich nicht mehr retten lassen
 * (siehe BoardPost.getDeletionDate). Hält Speicher und gespeicherte Daten klein (DSGVO: Datensparsamkeit).
 */
@Component
public class BoardCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(BoardCleanupJob.class);

    private final BoardPostRepository boardPostRepository;
    private final PhotoStorage photoStorage;

    public BoardCleanupJob(BoardPostRepository boardPostRepository, PhotoStorage photoStorage) {
        this.boardPostRepository = boardPostRepository;
        this.photoStorage = photoStorage;
    }

    @Scheduled(cron = "${microhub.board.cleanup-cron}", zone = "Europe/Berlin")
    @Transactional
    public void deleteExpiredPosts() {
        Instant now = Instant.now();
        List<BoardPost> due = boardPostRepository.findDueForDeletion(now, now.minus(BoardPost.REVIVE_PERIOD));
        if (due.isEmpty()) return;

        photoStorage.deleteAfterCommit(due.stream()
                .flatMap(post -> post.getPhotos().stream())
                .map(BoardPhoto::getFileKey)
                .toList());
        boardPostRepository.deleteAll(due);
        log.info("{} abgelaufene Aushänge gelöscht", due.size());
    }
}
