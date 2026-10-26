package dev.microhub.user;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByRole(Role role);

    /** Für die Regel „es muss immer mindestens ein aktiver Admin bleiben“. */
    long countByRoleAndEnabledTrue(Role role);

    List<AppUser> findAllByOrderByDisplayNameAsc();

    /** Für den nächtlichen Aufräum-Job: lange genug gesperrte Konten. */
    List<AppUser> findByEnabledFalseAndBlockedAtBefore(Instant blockedBefore);
}
