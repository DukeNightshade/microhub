package dev.microhub.board;

import java.time.Instant;

/**
 * Ein Aushang, wie ihn das Frontend anzeigt.
 * editable sagt, ob der angemeldete Benutzer ihn ändern darf – das Frontend zeigt danach „Bearbeiten“.
 */
public record BoardItem(
        Long id,
        BoardKind kind,
        String label,
        String title,
        String content,
        String authorName,
        Instant createdAt,
        Instant expiresAt,
        boolean editable) {

    static BoardItem from(BoardPost post, boolean editable) {
        return new BoardItem(
                post.getId(),
                post.getKind(),
                post.getKind().getLabel(),
                post.getTitle(),
                post.getContent(),
                post.getAuthor().getDisplayName(),
                post.getCreatedAt(),
                post.getExpiresAt(),
                editable);
    }
}
