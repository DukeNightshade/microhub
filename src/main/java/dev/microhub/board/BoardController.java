package dev.microhub.board;

import dev.microhub.common.BadRequestException;
import jakarta.validation.Valid;
import java.io.IOException;
import java.time.Duration;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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
    public BoardList list(Authentication authentication) {
        return boardService.list(authentication.getName());
    }

    /** Arten, Laufzeiten und Fotoanzahl für das Formular. */
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

    /** Ein Foto pro Anfrage; das Frontend verkleinert es vorher schon im Browser. */
    @PostMapping("/{id}/photos")
    @ResponseStatus(HttpStatus.CREATED)
    public BoardItem addPhoto(@PathVariable long id, @RequestParam("file") MultipartFile file,
                              Authentication authentication) throws IOException {
        if (file.isEmpty()) {
            throw new BadRequestException("Die Datei ist leer.");
        }
        return boardService.addPhoto(id, file.getInputStream(), authentication.getName());
    }

    @DeleteMapping("/{id}/photos/{photoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePhoto(@PathVariable long id, @PathVariable long photoId, Authentication authentication) {
        boardService.deletePhoto(id, photoId, authentication.getName());
    }

    /**
     * Liefert das Foto aus. Ein Foto ändert sich nie (neues Foto = neue ID), deshalb darf der
     * Browser es lange zwischenspeichern – „private“, weil es nur für Eingeloggte bestimmt ist.
     */
    @GetMapping("/photos/{photoId}")
    public ResponseEntity<Resource> photo(@PathVariable long photoId,
                                          @RequestParam(defaultValue = "false") boolean thumb,
                                          Authentication authentication) {
        Resource file = new FileSystemResource(boardService.photoFile(photoId, thumb, authentication.getName()));
        if (!file.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate())
                .body(file);
    }
}
