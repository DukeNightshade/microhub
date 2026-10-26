package dev.microhub.user;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppUserRepository userRepository;
    private final AccountService accountService;

    public AuthController(AppUserRepository userRepository, AccountService accountService) {
        this.userRepository = userRepository;
        this.accountService = accountService;
    }

    /**
     * Liefert den aktuellen Login-Status. Das Frontend ruft diesen Endpunkt beim Start auf.
     * Nebeneffekt: Das CSRF-Cookie (XSRF-TOKEN) wird gesetzt, das JS für POST-Anfragen braucht.
     */
    @GetMapping("/me")
    public Map<String, Object> me(Authentication authentication, CsrfToken csrfToken) {
        csrfToken.getToken(); // erzwingt das Setzen des CSRF-Cookies

        if (authentication == null || !authentication.isAuthenticated()) {
            return Map.of("authenticated", false);
        }
        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
        AppUser user = userRepository.findByUsernameIgnoreCase(authentication.getName()).orElse(null);
        if (user == null) {
            return Map.of("authenticated", false);
        }
        return Map.of(
                "authenticated", true,
                "username", user.getUsername(),
                "displayName", user.getDisplayName(),
                "mustChangePassword", user.isMustChangePassword(),
                "roles", roles);
    }

    /** Selbstregistrierung mit Freischaltcode. Angemeldet wird danach ganz normal über /login. */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public void register(@Valid @RequestBody AccountRequests.Register request) {
        accountService.register(request);
    }
}
