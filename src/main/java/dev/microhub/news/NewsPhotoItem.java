package dev.microhub.news;

/** Ein Bild, wie es das Frontend braucht: URLs statt Dateinamen, Größe für das Seitenverhältnis. */
public record NewsPhotoItem(Long id, String url, String thumbUrl, int width, int height) {

    static NewsPhotoItem from(NewsPhoto photo) {
        String base = "/api/news/photos/" + photo.getId();
        return new NewsPhotoItem(photo.getId(), base, base + "?thumb=true", photo.getWidth(), photo.getHeight());
    }
}
