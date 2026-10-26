package dev.microhub.board;

import dev.microhub.common.ForbiddenException;
import dev.microhub.common.NotFoundException;
import dev.microhub.user.AppUser;
import dev.microhub.user.AppUserRepository;
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
    private final AppUserRepository userRepository;

    public BoardService(BoardPostRepository boardPostRepository, AppUserRepository userRepository) {
        this.boardPostRepository = boardPostRepository;
        this.userRepository = userRepository;
    }

    public List<BoardItem> list(String username) {
        AppUser user = currentUser(username);
        return boardPostRepository.findByExpiresAtAfterOrderByCreatedAtDesc(Instant.now()).stream()
                .map(post -> BoardItem.from(post, post.canBeEditedBy(user)))
                .toList();
    }

    public BoardOptions options() {
        return new BoardOptions(
                Arrays.stream(BoardKind.values()).map(BoardOptions.KindOption::from).toList(),
                DURATIONS,
                DEFAULT_DURATION);
    }

    public BoardItem get(long id, String username) {
        BoardPost post = find(id);
        return BoardItem.from(post, post.canBeEditedBy(currentUser(username)));
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
        return BoardItem.from(boardPostRepository.save(post), true);
    }

    /** Die Laufzeit wird ab jetzt neu gerechnet – so lässt sich ein Aushang verlängern. */
    @Transactional
    public BoardItem update(long id, BoardRequest request, String username) {
        BoardPost post = findEditable(id, username);
        post.update(request.kind(), request.title().strip(), request.content().strip(),
                blankToNull(request.contact()), expiresAt(request));
        return BoardItem.from(post, true);
    }

    @Transactional
    public void delete(long id, String username) {
        boardPostRepository.delete(findEditable(id, username));
    }

    private BoardPost findEditable(long id, String username) {
        BoardPost post = find(id);
        if (!post.canBeEditedBy(currentUser(username))) {
            throw new ForbiddenException("Diesen Aushang dürfen nur der Autor und Admins ändern.");
        }
        return post;
    }

    private BoardPost find(long id) {
        return boardPostRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Aushang " + id + " nicht gefunden"));
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
