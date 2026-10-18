package dev.microhub.common;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Wird geworfen, wenn ein Datensatz mit einem vorhandenen kollidiert. Spring antwortet mit 409.
 *
 * Erbt bewusst von ResponseStatusException statt nur @ResponseStatus zu tragen: nur so landet
 * der Text in der JSON-Antwort (Feld „detail“) und das Frontend kann ihn direkt anzeigen.
 */
public class ConflictException extends ResponseStatusException {

    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, message);
    }
}
