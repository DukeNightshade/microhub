package dev.microhub.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/** Daten der Verwaltungsansicht: Freischaltcodes und Mitglieder. */
public final class AdminDtos {

    private AdminDtos() {
    }

    /** Mehrere Wohnungen auf einmal, eine pro Zeile im Formular. */
    public record CreateCodes(@NotEmpty @Size(max = 100) List<@NotBlank @Size(max = 100) String> labels) {
    }

    public record UpdateCode(boolean revoked) {
    }

    /** deletionDate: wann ein gesperrter Code automatisch verschwindet (sonst leer). */
    public record CodeItem(Long id, String code, String label, int maxUses, int usedCount, boolean revoked,
                           boolean usable, Instant createdAt, Instant deletionDate) {

        static CodeItem from(InviteCode code) {
            return new CodeItem(code.getId(), Secrets.formatCode(code.getCode()), code.getLabel(),
                    code.getMaxUses(), code.getUsedCount(), code.isRevoked(), code.isUsable(), code.getCreatedAt(),
                    code.getRevokedAt() == null ? null : code.getRevokedAt().plus(AdminService.BLOCKED_RETENTION));
        }
    }

    /** Fehlende Felder bleiben unverändert – so kann das Frontend nur sperren oder nur die Rolle ändern. */
    public record UpdateMember(Boolean enabled, Role role) {
    }

    /** deletionDate: wann ein gesperrtes Konto automatisch gelöscht wird (sonst leer). */
    public record MemberItem(Long id, String username, String displayName, String apartment, Role role,
                             boolean enabled, boolean mustChangePassword, Instant createdAt, boolean self,
                             Instant deletionDate) {

        static MemberItem from(AppUser user, String currentUsername) {
            return new MemberItem(user.getId(), user.getUsername(), user.getDisplayName(), user.getApartment(),
                    user.getRole(), user.isEnabled(), user.isMustChangePassword(), user.getCreatedAt(),
                    user.getUsername().equalsIgnoreCase(currentUsername),
                    user.getBlockedAt() == null ? null : user.getBlockedAt().plus(AdminService.BLOCKED_RETENTION));
        }
    }

    /** Wird nur dieses eine Mal angezeigt; gespeichert ist nur der Hash. */
    public record PasswordReset(String temporaryPassword) {
    }
}
