package dev.microhub.news;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Ein Bild zu einem News-Beitrag. Bewusst nur die newsId statt einer Sammlung an News:
 * so lassen sich die Bilder einer ganzen Feed-Seite mit einer Abfrage laden, ohne dass
 * Hibernate beim Blättern alle Beiträge in den Speicher holen muss.
 */
@Entity
@Table(name = "news_photo")
public class NewsPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "news_id", nullable = false, updatable = false)
    private Long newsId;

    /** Zufälliger Dateiname im Upload-Ordner, siehe PhotoStorage. */
    @Column(name = "file_key", nullable = false, length = 40, unique = true)
    private String fileKey;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected NewsPhoto() {
        // für JPA
    }

    NewsPhoto(Long newsId, String fileKey, int position, int width, int height) {
        this.newsId = newsId;
        this.fileKey = fileKey;
        this.position = position;
        this.width = width;
        this.height = height;
    }

    public Long getId() { return id; }
    public Long getNewsId() { return newsId; }
    public String getFileKey() { return fileKey; }
    public int getPosition() { return position; }
    public int getWidth() { return width; }
    public int getHeight() { return height; }
}
