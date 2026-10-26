package dev.microhub.news;

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
 * Lesen: für alle (auch Gäste), auch die Bilder. Anlegen, Ändern, Löschen: nur Admins.
 * Die Rechte stehen zentral in der SecurityConfig.
 */
@RestController
@RequestMapping("/api/news")
public class NewsController {

    private final NewsService newsService;

    public NewsController(NewsService newsService) {
        this.newsService = newsService;
    }

    @GetMapping
    public NewsPage list(@RequestParam(defaultValue = "0") int page) {
        return newsService.list(page);
    }

    @GetMapping("/{id}")
    public NewsResponse get(@PathVariable long id) {
        return newsService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NewsResponse create(@Valid @RequestBody NewsRequest request, Authentication authentication) {
        return newsService.create(request, authentication.getName());
    }

    @PutMapping("/{id}")
    public NewsResponse update(@PathVariable long id, @Valid @RequestBody NewsRequest request) {
        return newsService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        newsService.delete(id);
    }

    /** Ein Bild pro Anfrage; das Frontend verkleinert es vorher schon im Browser. */
    @PostMapping("/{id}/photos")
    @ResponseStatus(HttpStatus.CREATED)
    public NewsResponse addPhoto(@PathVariable long id, @RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new BadRequestException("Die Datei ist leer.");
        }
        return newsService.addPhoto(id, file.getInputStream());
    }

    @DeleteMapping("/{id}/photos/{photoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePhoto(@PathVariable long id, @PathVariable long photoId) {
        newsService.deletePhoto(id, photoId);
    }

    /** Ein Bild ändert sich nie (neues Bild = neue ID); News sind öffentlich, also „public“ cachebar. */
    @GetMapping("/photos/{photoId}")
    public ResponseEntity<Resource> photo(@PathVariable long photoId,
                                          @RequestParam(defaultValue = "false") boolean thumb) {
        Resource file = new FileSystemResource(newsService.photoFile(photoId, thumb));
        if (!file.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic())
                .body(file);
    }
}
