package dev.microhub.user;

import dev.microhub.common.ConflictException;
import dev.microhub.common.NotFoundException;
import java.time.Duration;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Freischaltcodes erzeugen und sperren, Mitglieder verwalten. Nur für Admins (SecurityConfig). */
@Service
@Transactional
public class AdminService {

    /** So lange bleiben gesperrte Konten und Codes erhalten, dann löscht sie der AccountCleanupJob. */
    static final Duration BLOCKED_RETENTION = Duration.ofDays(14);

    private final InviteCodeRepository inviteCodeRepository;
    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SessionTerminator sessionTerminator;
    private final AccountService accountService;

    public AdminService(InviteCodeRepository inviteCodeRepository, AppUserRepository userRepository,
                        PasswordEncoder passwordEncoder, SessionTerminator sessionTerminator,
                        AccountService accountService) {
        this.inviteCodeRepository = inviteCodeRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.sessionTerminator = sessionTerminator;
        this.accountService = accountService;
    }

    @Transactional(readOnly = true)
    public List<AdminDtos.CodeItem> codes() {
        return inviteCodeRepository.findAllByOrderByLabelAscIdAsc().stream().map(AdminDtos.CodeItem::from).toList();
    }

    public List<AdminDtos.CodeItem> createCodes(AdminDtos.CreateCodes request) {
        return request.labels().stream()
                .map(String::strip)
                .map(label -> inviteCodeRepository.save(new InviteCode(uniqueCode(), label)))
                .map(AdminDtos.CodeItem::from)
                .toList();
    }

    public AdminDtos.CodeItem updateCode(long id, AdminDtos.UpdateCode request) {
        InviteCode code = inviteCodeRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Code " + id + " nicht gefunden"));
        code.setRevoked(request.revoked());
        return AdminDtos.CodeItem.from(code);
    }

    /** Nur gesperrte Codes – ein freier Code soll nicht aus Versehen verschwinden. */
    public void deleteCode(long id) {
        InviteCode code = inviteCodeRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Code " + id + " nicht gefunden"));
        if (!code.isRevoked()) {
            throw new ConflictException("Nur gesperrte Codes lassen sich löschen. Sperre den Code zuerst.");
        }
        inviteCodeRepository.delete(code);
    }

    /** Nur gesperrte Mitglieder – löscht das Konto samt Aushängen und Fotos. */
    public void deleteMember(long id) {
        AppUser user = findUser(id);
        if (user.isEnabled()) {
            throw new ConflictException("Nur gesperrte Mitglieder lassen sich löschen. Sperre das Konto zuerst.");
        }
        accountService.deleteWithContent(user);
    }

    @Transactional(readOnly = true)
    public List<AdminDtos.MemberItem> members(String currentUsername) {
        return userRepository.findAllByOrderByDisplayNameAsc().stream()
                .map(user -> AdminDtos.MemberItem.from(user, currentUsername))
                .toList();
    }

    public AdminDtos.MemberItem updateMember(long id, AdminDtos.UpdateMember request, String currentUsername) {
        AppUser user = findUser(id);
        boolean self = user.getUsername().equalsIgnoreCase(currentUsername);
        boolean losesAdmin = user.getRole() == Role.ADMIN && user.isEnabled()
                && (Boolean.FALSE.equals(request.enabled()) || request.role() == Role.USER);

        if (self && losesAdmin) {
            throw new ConflictException("Dich selbst kannst du nicht sperren oder herabstufen.");
        }
        if (losesAdmin && userRepository.countByRoleAndEnabledTrue(Role.ADMIN) <= 1) {
            throw new ConflictException("Es muss immer mindestens einen aktiven Admin geben.");
        }

        if (request.enabled() != null) user.setEnabled(request.enabled());
        if (request.role() != null) user.setRole(request.role());
        // Rolle und Sperre stehen in der Sitzung; erst nach neuem Anmelden gelten sie.
        if (!self) sessionTerminator.logoutEverywhere(user.getUsername());
        return AdminDtos.MemberItem.from(user, currentUsername);
    }

    public AdminDtos.PasswordReset resetPassword(long id) {
        AppUser user = findUser(id);
        String temporary = Secrets.newTemporaryPassword();
        user.setPasswordHash(passwordEncoder.encode(temporary));
        user.setMustChangePassword(true);
        sessionTerminator.logoutEverywhere(user.getUsername());
        return new AdminDtos.PasswordReset(temporary);
    }

    private AppUser findUser(long id) {
        return userRepository.findById(id).orElseThrow(() -> new NotFoundException("Mitglied " + id + " nicht gefunden"));
    }

    private String uniqueCode() {
        String code;
        do {
            code = Secrets.newCode();
        } while (inviteCodeRepository.existsByCode(code));
        return code;
    }
}
