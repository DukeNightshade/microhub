package dev.microhub.board;

import java.time.Instant;
import java.util.List;

/**
 * Ein Aushang, wie ihn das Frontend anzeigt.
 * editable sagt, ob der angemeldete Benutzer ihn ändern darf – das Frontend zeigt danach „Bearbeiten“.
 * expired/revivable/deletionDate braucht nur der Autor für seine abgelaufenen Aushänge.
 */
public record BoardItem(
        Long id,
        BoardKind kind,
        String label,
        String title,
        String content,
        String contact,
        Integer priceCents,
        PriceType priceType,
        String authorName,
        Instant createdAt,
        Instant expiresAt,
        boolean editable,
        boolean expired,
        boolean revivable,
        Instant deletionDate,
        List<Photo> photos) {

    /** URLs statt Dateinamen: Das Frontend muss nicht wissen, wo die Dateien liegen. */
    public record Photo(Long id, String url, String thumbUrl, int width, int height) {

        static Photo from(BoardPhoto photo) {
            String base = "/api/board/photos/" + photo.getId();
            return new Photo(photo.getId(), base, base + "?thumb=true", photo.getWidth(), photo.getHeight());
        }
    }

    static BoardItem from(BoardPost post, boolean editable, Instant now) {
        return new BoardItem(
                post.getId(),
                post.getKind(),
                post.getKind().getLabel(),
                post.getTitle(),
                post.getContent(),
                post.getContact(),
                post.getPriceCents(),
                post.getPriceType(),
                post.getAuthor().getDisplayName(),
                post.getCreatedAt(),
                post.getExpiresAt(),
                editable,
                post.isExpired(now),
                editable && post.canBeRevived(now),
                post.getDeletionDate(),
                post.getPhotos().stream().map(Photo::from).toList());
    }
}
