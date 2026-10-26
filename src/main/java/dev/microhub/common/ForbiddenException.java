package dev.microhub.common;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Wird geworfen, wenn jemand einen Datensatz ändern will, der ihm nicht gehört. Spring antwortet mit 403.
 * Erbt wie ConflictException von ResponseStatusException, damit der Text im Feld „detail“ ankommt.
 */
public class ForbiddenException extends ResponseStatusException {

    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, message);
    }
}
