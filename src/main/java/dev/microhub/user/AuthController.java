package dev.microhub.user;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

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
        return Map.of(
                "authenticated", true,
                "username", authentication.getName(),
                "roles", roles);
    }
}
