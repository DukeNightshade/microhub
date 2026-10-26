package dev.microhub.news;

import dev.microhub.events.EventInfo;
import java.time.Instant;

/**
 * Eine News ohne vollen Text, für den Feed; event zeigt dort einen Termin-Hinweis,
 * cover ist das Titelbild (oder leer).
 */
public record NewsListItem(
        Long id,
        String title,
        String summary,
        String author,
        Instant publishedAt,
        EventInfo event,
        NewsPhotoItem cover) {

    static NewsListItem from(News news, EventInfo event, NewsPhotoItem cover) {
        return new NewsListItem(
                news.getId(),
                news.getTitle(),
                news.getSummary(),
                news.getAuthor() == null ? null : news.getAuthor().getDisplayName(),
                news.getPublishedAt(),
                event,
                cover);
    }
}
