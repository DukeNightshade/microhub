package dev.microhub.events;

import java.util.List;

/** Eine Seite der Terminliste; hasMore sagt dem Frontend, ob es „Weitere laden“ anbieten soll. */
public record EventPage(List<EventListItem> items, int page, boolean hasMore) {
}
