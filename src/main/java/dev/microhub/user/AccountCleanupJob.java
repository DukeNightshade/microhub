package dev.microhub.user;

import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Löscht jede Nacht Konten und Freischaltcodes, die seit mindestens 14 Tagen gesperrt sind
 * (Entscheidung vom 26.10.2026). Konten verschwinden samt Aushängen und Fotos.
 */
@Component
public class AccountCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(AccountCleanupJob.class);

    private final AppUserRepository userRepository;
    private final InviteCodeRepository inviteCodeRepository;
    private final AccountService accountService;

    public AccountCleanupJob(AppUserRepository userRepository, InviteCodeRepository inviteCodeRepository,
                             AccountService accountService) {
        this.userRepository = userRepository;
        this.inviteCodeRepository = inviteCodeRepository;
        this.accountService = accountService;
    }

    @Scheduled(cron = "${microhub.users.cleanup-cron}", zone = "Europe/Berlin")
    @Transactional
    public void deleteLongBlocked() {
        Instant limit = Instant.now().minus(AdminService.BLOCKED_RETENTION);

        List<AppUser> users = userRepository.findByEnabledFalseAndBlockedAtBefore(limit);
        users.forEach(accountService::deleteWithContent);

        List<InviteCode> codes = inviteCodeRepository.findByRevokedTrueAndRevokedAtBefore(limit);
        inviteCodeRepository.deleteAll(codes);

        if (!users.isEmpty() || !codes.isEmpty()) {
            log.info("{} gesperrte Konten und {} gesperrte Codes gelöscht", users.size(), codes.size());
        }
    }
}
