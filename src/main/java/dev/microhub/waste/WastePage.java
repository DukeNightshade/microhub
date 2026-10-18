package dev.microhub.waste;

import java.util.List;

/** Eine Seite der Abfuhrliste; hasMore sagt dem Frontend, ob es „Weitere laden“ anbieten soll. */
public record WastePage(List<WasteItem> items, int page, boolean hasMore) {
}
