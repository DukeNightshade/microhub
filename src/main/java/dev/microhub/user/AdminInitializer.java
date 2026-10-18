package dev.microhub.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Legt beim ersten Start einen Admin an, falls noch keiner existiert.
 * Zugangsdaten kommen aus Umgebungsvariablen (ADMIN_USERNAME, ADMIN_PASSWORD).
 */
@Component
public class AdminInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminInitializer.class);

    private final AppUserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final String username;
    private final String email;
    private final String password;

    public AdminInitializer(AppUserRepository repository,
                            PasswordEncoder passwordEncoder,
                            @Value("${microhub.admin.username}") String username,
                            @Value("${microhub.admin.email}") String email,
                            @Value("${microhub.admin.password}") String password) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.username = username;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (repository.existsByRole(Role.ADMIN)) {
            return;
        }
        if (password == null || password.isBlank()) {
            log.warn("Kein Admin vorhanden und ADMIN_PASSWORD nicht gesetzt – es wurde kein Admin angelegt.");
            return;
        }
        AppUser admin = new AppUser(
                username,
                email == null || email.isBlank() ? null : email,
                passwordEncoder.encode(password),
                "Administrator",
                Role.ADMIN);
        repository.save(admin);
        log.info("Admin-Benutzer '{}' wurde angelegt.", username);
    }
}
