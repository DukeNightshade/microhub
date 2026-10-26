package dev.microhub.news;

import dev.microhub.events.EventInfo;
import java.time.Instant;

/** Eine News mit vollem Text, für die Detailansicht; event ist der Termin im Kalender, falls vorhanden. */
public record NewsResponse(
        Long id,
        String title,
        String summary,
        String content,
        String author,
        Instant publishedAt,
        Instant updatedAt,
        EventInfo event) {

    static NewsResponse from(News news, EventInfo event) {
        return new NewsResponse(
                news.getId(),
                news.getTitle(),
                news.getSummary(),
                news.getContent(),
                news.getAuthor() == null ? null : news.getAuthor().getDisplayName(),
                news.getPublishedAt(),
                news.getUpdatedAt(),
                event);
    }
}
