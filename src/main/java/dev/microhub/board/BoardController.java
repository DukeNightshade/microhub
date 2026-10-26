package dev.microhub.board;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Nur für eingeloggte Benutzer (SecurityConfig). Ändern und Löschen dürfen Autor und Admins –
 * das prüft der BoardService, weil es vom einzelnen Aushang abhängt.
 */
@RestController
@RequestMapping("/api/board")
public class BoardController {

    private final BoardService boardService;

    public BoardController(BoardService boardService) {
        this.boardService = boardService;
    }

    @GetMapping
    public List<BoardItem> list(Authentication authentication) {
        return boardService.list(authentication.getName());
    }

    /** Arten und Laufzeiten für die Auswahl im Formular. */
    @GetMapping("/options")
    public BoardOptions options() {
        return boardService.options();
    }

    @GetMapping("/{id}")
    public BoardItem get(@PathVariable long id, Authentication authentication) {
        return boardService.get(id, authentication.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BoardItem create(@Valid @RequestBody BoardRequest request, Authentication authentication) {
        return boardService.create(request, authentication.getName());
    }

    @PutMapping("/{id}")
    public BoardItem update(@PathVariable long id, @Valid @RequestBody BoardRequest request,
                            Authentication authentication) {
        return boardService.update(id, request, authentication.getName());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id, Authentication authentication) {
        boardService.delete(id, authentication.getName());
    }
}
