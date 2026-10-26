package dev.microhub.user;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String username;

    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    /** Über welchen Freischaltcode (also welche Wohnung) jemand kam; leer beim ersten Admin. */
    /**
     * Wohnung aus dem Freischaltcode, z. B. „Whg. 3“; leer beim ersten Admin. Steht am Konto
     * selbst, weil aufgebrauchte Codes gelöscht werden.
     */
    @Column(length = 100)
    private String apartment;

    /** Seit wann gesperrt; 14 Tage danach löscht der AccountCleanupJob das Konto. */
    @Column(name = "blocked_at")
    private Instant blockedAt;

    /** Nach dem Zurücksetzen durch den Admin muss das Einmal-Passwort sofort ersetzt werden. */
    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword;

    protected AppUser() {
        // für JPA
    }

    public AppUser(String username, String email, String passwordHash, String displayName, Role role) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.role = role;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getDisplayName() { return displayName; }
    public Role getRole() { return role; }
    public boolean isEnabled() { return enabled; }
    public Instant getCreatedAt() { return createdAt; }
    public String getApartment() { return apartment; }
    public Instant getBlockedAt() { return blockedAt; }
    public boolean isMustChangePassword() { return mustChangePassword; }

    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public void setRole(Role role) { this.role = role; }
    public void setApartment(String apartment) { this.apartment = apartment; }

    /** Erneutes Sperren eines schon gesperrten Kontos verlängert die Löschfrist nicht. */
    public void setEnabled(boolean enabled) {
        if (enabled) {
            blockedAt = null;
        } else if (this.enabled) {
            blockedAt = Instant.now();
        }
        this.enabled = enabled;
    }
    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
}
