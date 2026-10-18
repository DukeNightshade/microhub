package dev.microhub.common;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** Wird geworfen, wenn die Anfrage inhaltlich nicht benutzbar ist. Spring antwortet mit 400. */
@ResponseStatus(HttpStatus.BAD_REQUEST)
public class BadRequestException extends RuntimeException {

    public BadRequestException(String message) {
        super(message);
    }
}
