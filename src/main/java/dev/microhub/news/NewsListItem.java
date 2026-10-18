package dev.microhub.news;

import java.time.Instant;

/** Eine News ohne vollen Text, für die Liste. */
public record NewsListItem(
        Long id,
        String title,
        String summary,
        String author,
        Instant publishedAt) {

    static NewsListItem from(News news) {
        return new NewsListItem(
                news.getId(),
                news.getTitle(),
                news.getSummary(),
                news.getAuthor() == null ? null : news.getAuthor().getDisplayName(),
                news.getPublishedAt());
    }
}
