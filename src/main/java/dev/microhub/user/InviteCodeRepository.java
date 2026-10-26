package dev.microhub.user;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface InviteCodeRepository extends JpaRepository<InviteCode, Long> {

    /**
     * Sperrt die Zeile bis zum Ende der Transaktion. Sonst könnten sich zwei Personen
     * gleichzeitig mit dem letzten freien Platz eines Codes registrieren.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<InviteCode> findByCode(String code);

    boolean existsByCode(String code);

    List<InviteCode> findAllByOrderByLabelAscIdAsc();
}
