package dev.microhub.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Die Daten, die das Frontend für Registrierung und „Mein Konto“ schickt. */
public final class AccountRequests {

    private AccountRequests() {
    }

    public record Register(
            @NotBlank String code,
            @NotBlank @Size(min = 2, max = 100) String displayName,
            // Nur einfache Zeichen: der Name wird beim Anmelden getippt, oft auf dem Handy.
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9._-]{3,30}$") String username,
            @NotBlank @Size(min = PasswordRules.MIN_LENGTH, max = PasswordRules.MAX_LENGTH) String password) {
    }

    public record ChangePassword(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = PasswordRules.MIN_LENGTH, max = PasswordRules.MAX_LENGTH) String newPassword) {
    }

    public record ChangeDisplayName(@NotBlank @Size(min = 2, max = 100) String displayName) {
    }

    /** Löschen nur mit Passwort – schützt vor einem Klick am fremden, entsperrten Handy. */
    public record DeleteAccount(@NotBlank String password) {
    }
}
