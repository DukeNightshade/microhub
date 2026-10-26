package dev.microhub.user;

/**
 * Wird kurz vor dem Löschen eines Kontos veröffentlicht, noch in derselben Transaktion.
 * So können andere Module (z. B. das Brett mit seinen Fotodateien) aufräumen, ohne dass
 * das Benutzer-Modul sie kennen muss.
 */
public record AccountDeletedEvent(Long userId) {
}
