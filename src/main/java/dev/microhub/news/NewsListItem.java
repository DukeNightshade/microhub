package dev.microhub.news;

import dev.microhub.events.EventInfo;
import java.time.Instant;

/** Eine News ohne vollen Text, für die Liste; event zeigt dort einen Termin-Hinweis an. */
public record NewsListItem(
        Long id,
        String title,
        String summary,
        String author,
        Instant publishedAt,
        EventInfo event) {

    static NewsListItem from(News news, EventInfo event) {
        return new NewsListItem(
                news.getId(),
                news.getTitle(),
                news.getSummary(),
                news.getAuthor() == null ? null : news.getAuthor().getDisplayName(),
                news.getPublishedAt(),
                event);
    }
}
