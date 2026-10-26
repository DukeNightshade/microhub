package dev.microhub.user;

import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

/**
 * Meldet einen Benutzer auf allen Geräten ab. Nötig, weil Rolle und Sperre nur beim Anmelden
 * gelesen werden: Ohne das könnte ein gesperrtes Mitglied mit seiner alten Sitzung weitermachen.
 */
@Component
public class SessionTerminator {

    private final SessionRegistry sessionRegistry;

    public SessionTerminator(SessionRegistry sessionRegistry) {
        this.sessionRegistry = sessionRegistry;
    }

    public void logoutEverywhere(String username) {
        sessionRegistry.getAllPrincipals().stream()
                .filter(principal -> principal instanceof UserDetails details
                        && details.getUsername().equalsIgnoreCase(username))
                .flatMap(principal -> sessionRegistry.getAllSessions(principal, false).stream())
                .forEach(session -> session.expireNow());
    }
}
