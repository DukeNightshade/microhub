package dev.microhub.board;

import dev.microhub.photos.PhotoStorage;
import dev.microhub.common.ConflictException;
import dev.microhub.common.ForbiddenException;
import dev.microhub.common.NotFoundException;
import dev.microhub.user.AppUser;
import dev.microhub.user.AppUserRepository;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BoardService {

    static final List<Integer> DURATIONS = List.of(7, 14, 30, 60, 90);
    static final int DEFAULT_DURATION = 30;

    private final BoardPostRepository boardPostRepository;
    private final BoardPhotoRepository boardPhotoRepository;
    private final AppUserRepository userRepository;
    private final PhotoStorage photoStorage;

    public BoardService(BoardPostRepository boardPostRepository, BoardPhotoRepository boardPhotoRepository,
                        AppUserRepository userRepository, PhotoStorage photoStorage) {
        this.boardPostRepository = boardPostRepository;
        this.boardPhotoRepository = boardPhotoRepository;
        this.userRepository = userRepository;
        this.photoStorage = photoStorage;
    }

    /** Die hängenden Aushänge für alle, dazu die eigenen abgelaufenen, die sich noch retten lassen. */
    public BoardList list(String username) {
        AppUser user = currentUser(username);
        Instant now = Instant.now();
        List<BoardItem> active = boardPostRepository.findByExpiresAtAfterOrderByCreatedAtDesc(now).stream()
                .map(post -> BoardItem.from(post, post.canBeEditedBy(user), now))
                .toList();
        List<BoardItem> expired = boardPostRepository
                .findByAuthorIdAndRevivedFalseAndExpiresAtBetweenOrderByExpiresAtDesc(
                        user.getId(), now.minus(BoardPost.REVIVE_PERIOD), now).stream()
                .map(post -> BoardItem.from(post, true, now))
                .toList();
        return new BoardList(active, expired);
    }

    public BoardOptions options() {
        return new BoardOptions(
                Arrays.stream(BoardKind.values()).map(BoardOptions.KindOption::from).toList(),
                DURATIONS,
                DEFAULT_DURATION,
                BoardPost.MAX_PHOTOS);
    }

    public BoardItem get(long id, String username) {
        AppUser user = currentUser(username);
        BoardPost post = findVisible(id, user);
        return BoardItem.from(post, post.canBeEditedBy(user), Instant.now());
    }

    @Transactional
    public BoardItem create(BoardRequest request, String username) {
        BoardPost post = new BoardPost(
                request.kind(),
                request.title().strip(),
                request.content().strip(),
                blankToNull(request.contact()),
                currentUser(username),
                expiresAt(request));
        post.setPrice(request.priceCents(), request.priceType());
        return BoardItem.from(boardPostRepository.save(post), true, Instant.now());
    }

    /**
     * Die Laufzeit wird ab jetzt neu gerechnet – so lässt sich ein Aushang verlängern.
     * Bei einem abgelaufenen Aushang ist das das eine erlaubte Neu-Aufhängen; einer, der sich
     * nicht mehr retten lässt, gilt schon in findEditable als nicht vorhanden (404).
     */
    @Transactional
    public BoardItem update(long id, BoardRequest request, String username) {
        BoardPost post = findEditable(id, username);
        Instant now = Instant.now();
        post.update(request.kind(), request.title().strip(), request.content().strip(),
                blankToNull(request.contact()), expiresAt(request), now);
        post.setPrice(request.priceCents(), request.priceType());
        return BoardItem.from(post, true, now);
    }

    @Transactional
    public void delete(long id, String username) {
        BoardPost post = findEditable(id, username);
        photoStorage.deleteAfterCommit(post.getPhotos().stream().map(BoardPhoto::getFileKey).toList());
        boardPostRepository.delete(post);
    }

    @Transactional
    public BoardItem addPhoto(long id, InputStream image, String username) throws IOException {
        BoardPost post = findEditable(id, username);
        if (post.getPhotos().size() >= BoardPost.MAX_PHOTOS) {
            throw new ConflictException("Ein Aushang kann höchstens " + BoardPost.MAX_PHOTOS + " Fotos haben.");
        }
        PhotoStorage.StoredPhoto stored = photoStorage.store(image);
        post.addPhoto(stored.key(), stored.width(), stored.height());
        boardPostRepository.flush();
        return BoardItem.from(post, true, Instant.now());
    }

    @Transactional
    public void deletePhoto(long postId, long photoId, String username) {
        BoardPost post = findEditable(postId, username);
        BoardPhoto photo = post.getPhotos().stream()
                .filter(p -> p.getId().equals(photoId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Foto " + photoId + " nicht gefunden"));
        post.removePhoto(photo);
        photoStorage.deleteAfterCommit(List.of(photo.getFileKey()));
    }

    /** Fotos sieht nur, wer auch den Aushang sehen darf. */
    public Path photoFile(long photoId, boolean thumb, String username) {
        BoardPhoto photo = boardPhotoRepository.findById(photoId)
                .orElseThrow(() -> new NotFoundException("Foto " + photoId + " nicht gefunden"));
        AppUser user = currentUser(username);
        if (!photo.getPost().isVisibleTo(user, Instant.now())) {
            throw new NotFoundException("Foto " + photoId + " nicht gefunden");
        }
        return photoStorage.path(photo.getFileKey(), thumb);
    }

    private BoardPost findVisible(long id, AppUser user) {
        BoardPost post = find(id);
        // Abgelaufene fremde Aushänge gibt es für andere nicht mehr – auch nicht über die Adresse.
        if (!post.isVisibleTo(user, Instant.now())) {
            throw notFound(id);
        }
        return post;
    }

    private BoardPost findEditable(long id, String username) {
        AppUser user = currentUser(username);
        BoardPost post = findVisible(id, user);
        if (!post.canBeEditedBy(user)) {
            throw new ForbiddenException("Diesen Aushang dürfen nur der Autor und Admins ändern.");
        }
        return post;
    }

    private BoardPost find(long id) {
        return boardPostRepository.findById(id).orElseThrow(() -> notFound(id));
    }

    private static NotFoundException notFound(long id) {
        return new NotFoundException("Aushang " + id + " nicht gefunden");
    }

    private AppUser currentUser(String username) {
        // Die Route ist nur für Eingeloggte; fehlt der Benutzer trotzdem, wurde er gerade gelöscht.
        return userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ForbiddenException("Benutzer nicht gefunden."));
    }

    private static Instant expiresAt(BoardRequest request) {
        return Instant.now().plus(Duration.ofDays(request.durationDays()));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
