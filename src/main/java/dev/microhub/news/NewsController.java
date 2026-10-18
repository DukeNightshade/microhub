package dev.microhub.news;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Lesen: für alle (auch Gäste). Anlegen, Ändern, Löschen: nur Admins.
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
}
