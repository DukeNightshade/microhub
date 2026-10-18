package dev.microhub.news;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Daten, die das Frontend beim Anlegen oder Bearbeiten schickt. */
public record NewsRequest(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 500) String summary,
        @NotBlank @Size(max = 20000) String content) {
}
