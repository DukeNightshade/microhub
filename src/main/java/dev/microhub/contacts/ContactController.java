package dev.microhub.contacts;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Lesen: für alle, Gäste sehen aber nur öffentliche Kontakte. Anlegen, Ändern, Löschen: nur Admins.
 * Die Rechte stehen zentral in der SecurityConfig.
 */
@RestController
@RequestMapping("/api/contacts")
public class ContactController {

    private final ContactService contactService;

    public ContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    @GetMapping
    public List<ContactItem> list(Authentication authentication) {
        return contactService.list(isLoggedIn(authentication));
    }

    @GetMapping("/{id}")
    public ContactItem get(@PathVariable long id, Authentication authentication) {
        return contactService.get(id, isLoggedIn(authentication));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ContactItem create(@Valid @RequestBody ContactRequest request) {
        return contactService.create(request);
    }

    @PutMapping("/{id}")
    public ContactItem update(@PathVariable long id, @Valid @RequestBody ContactRequest request) {
        return contactService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        contactService.delete(id);
    }

    /**
     * Gäste haben in Spring Security ein AnonymousAuthenticationToken, das ebenfalls
     * „authenticated“ meldet. Deshalb muss der Typ mitgeprüft werden.
     */
    private static boolean isLoggedIn(Authentication authentication) {
        return authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
    }
}
