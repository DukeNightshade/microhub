package dev.microhub.events;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Lesen: für alle (auch Gäste). Anlegen, Ändern, Löschen: nur Admins.
 * Die Rechte stehen zentral in der SecurityConfig.
 */
@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    @GetMapping
    public EventPage list(@RequestParam(defaultValue = "0") int page,
                          @RequestParam(defaultValue = "false") boolean vergangen) {
        return eventService.list(page, vergangen);
    }

    @GetMapping("/{id}")
    public EventResponse get(@PathVariable long id) {
        return eventService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse create(@Valid @RequestBody EventRequest request, Authentication authentication) {
        return eventService.create(request, authentication.getName());
    }

    @PutMapping("/{id}")
    public EventResponse update(@PathVariable long id, @Valid @RequestBody EventRequest request) {
        return eventService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        eventService.delete(id);
    }
}
