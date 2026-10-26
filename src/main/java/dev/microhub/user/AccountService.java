package dev.microhub.user;

import dev.microhub.common.ConflictException;
import dev.microhub.common.ForbiddenException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Registrierung mit Freischaltcode und alles unter „Mein Konto“. */
@Service
@Transactional
public class AccountService {

    private final AppUserRepository userRepository;
    private final InviteCodeRepository inviteCodeRepository;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationEventPublisher events;

    public AccountService(AppUserRepository userRepository, InviteCodeRepository inviteCodeRepository,
                          PasswordEncoder passwordEncoder, ApplicationEventPublisher events) {
        this.userRepository = userRepository;
        this.inviteCodeRepository = inviteCodeRepository;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
    }

    public void register(AccountRequests.Register request) {
        PasswordRules.check(request.password());

        // Absichtlich dieselbe Meldung für „gibt es nicht“, „gesperrt“ und „verbraucht“:
        // Wer Codes errät, soll nicht erfahren, welche es gibt.
        InviteCode code = inviteCodeRepository.findByCode(Secrets.normalizeCode(request.code()))
                .filter(InviteCode::isUsable)
                .orElseThrow(() -> new ConflictException(
                        "Dieser Freischaltcode stimmt nicht oder wurde schon zweimal benutzt."));

        String username = request.username().strip();
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new ConflictException("Den Benutzernamen „" + username + "“ gibt es schon. Bitte wähle einen anderen.");
        }

        AppUser user = new AppUser(username, null, passwordEncoder.encode(request.password()),
                request.displayName().strip(), Role.USER);
        user.setInviteCode(code);
        code.redeem();
        userRepository.save(user);
    }

    public void changePassword(String username, AccountRequests.ChangePassword request) {
        AppUser user = find(username);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ConflictException("Das bisherige Passwort stimmt nicht.");
        }
        if (request.currentPassword().equals(request.newPassword())) {
            throw new ConflictException("Das neue Passwort muss sich vom bisherigen unterscheiden.");
        }
        PasswordRules.check(request.newPassword());
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setMustChangePassword(false);
    }

    public void changeDisplayName(String username, AccountRequests.ChangeDisplayName request) {
        find(username).setDisplayName(request.displayName().strip());
    }

    public void delete(String username, AccountRequests.DeleteAccount request) {
        AppUser user = find(username);
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ConflictException("Das Passwort stimmt nicht.");
        }
        if (user.getRole() == Role.ADMIN && userRepository.countByRoleAndEnabledTrue(Role.ADMIN) <= 1) {
            throw new ConflictException("Du bist der einzige Admin. Mach vorher jemand anderen zum Admin.");
        }
        events.publishEvent(new AccountDeletedEvent(user.getId()));
        userRepository.delete(user);
    }

    private AppUser find(String username) {
        return userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ForbiddenException("Benutzer nicht gefunden."));
    }
}
