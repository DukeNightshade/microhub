package dev.microhub.news;

import java.time.Instant;

/** Eine News mit vollem Text, für die Detailansicht. */
public record NewsResponse(
        Long id,
        String title,
        String summary,
        String content,
        String author,
        Instant publishedAt,
        Instant updatedAt) {

    static NewsResponse from(News news) {
        return new NewsResponse(
                news.getId(),
                news.getTitle(),
                news.getSummary(),
                news.getContent(),
                news.getAuthor() == null ? null : news.getAuthor().getDisplayName(),
                news.getPublishedAt(),
                news.getUpdatedAt());
    }
}
