package dev.microhub.board;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "board_photo")
public class BoardPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id")
    private BoardPost post;

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

    protected BoardPhoto() {
        // für JPA
    }

    BoardPhoto(BoardPost post, String fileKey, int position, int width, int height) {
        this.post = post;
        this.fileKey = fileKey;
        this.position = position;
        this.width = width;
        this.height = height;
    }

    public Long getId() { return id; }
    public BoardPost getPost() { return post; }
    public String getFileKey() { return fileKey; }
    public int getPosition() { return position; }
    public int getWidth() { return width; }
    public int getHeight() { return height; }
}
