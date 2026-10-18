package dev.microhub.news;

import java.util.List;

/** Eine Seite der News-Liste; hasMore sagt dem Frontend, ob es „Ältere laden“ anbieten soll. */
public record NewsPage(List<NewsListItem> items, int page, boolean hasMore) {
}
