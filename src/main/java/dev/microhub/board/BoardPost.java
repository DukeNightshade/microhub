package dev.microhub.board;

import dev.microhub.user.AppUser;
import dev.microhub.user.Role;
import jakarta.persistence.*;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "board_post")
public class BoardPost {

    /** So lange kann der Autor einen abgelaufenen Aushang noch einmal aufhängen, danach wird er gelöscht. */
    static final Duration REVIVE_PERIOD = Duration.ofDays(30);

    static final int MAX_PHOTOS = 3;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BoardKind kind;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    /** Wie Interessierte den Autor erreichen; optional, vom Autor selbst eingetragen. */
    @Column(length = 200)
    private String contact;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id")
    private AppUser author;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    /** Danach sehen nur noch Autor und Admins den Aushang. Beim Bearbeiten neu wählbar, also verlängerbar. */
    @Column(name = "expires_at")
    private Instant expiresAt;

    /** Wurde der Aushang nach dem Ablaufen schon einmal neu aufgehängt? Dann gibt es kein zweites Mal. */
    @Column(nullable = false)
    private boolean revived;

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<BoardPhoto> photos = new ArrayList<>();

    protected BoardPost() {
        // für JPA
    }

    public BoardPost(BoardKind kind, String title, String content, String contact, AppUser author,
                     Instant expiresAt) {
        this.kind = kind;
        this.title = title;
        this.content = content;
        this.contact = contact;
        this.author = author;
        this.expiresAt = expiresAt;
    }

    /** Ist der Aushang schon abgelaufen, zählt das Speichern als das eine erlaubte Neu-Aufhängen. */
    public void update(BoardKind kind, String title, String content, String contact, Instant expiresAt,
                       Instant now) {
        if (isExpired(now)) {
            if (!canBeRevived(now)) {
                throw new IllegalStateException("Aushang " + id + " kann nicht mehr neu aufgehängt werden");
            }
            this.revived = true;
        }
        this.kind = kind;
        this.title = title;
        this.content = content;
        this.contact = contact;
        this.expiresAt = expiresAt;
    }

    /**
     * Ändern und Löschen dürfen der Autor und Admins.
     * author.getId() lädt den Benutzer nicht nach – die ID kennt Hibernate schon aus author_id.
     */
    public boolean canBeEditedBy(AppUser user) {
        return user.getRole() == Role.ADMIN || author.getId().equals(user.getId());
    }

    public boolean isExpired(Instant now) {
        return !expiresAt.isAfter(now);
    }

    public boolean canBeRevived(Instant now) {
        return isExpired(now) && !revived && expiresAt.plus(REVIVE_PERIOD).isAfter(now);
    }

    /** Abgelaufene Aushänge sehen nur noch Autor und Admins – und nur, solange sie sich neu aufhängen lassen. */
    public boolean isVisibleTo(AppUser user, Instant now) {
        return !isExpired(now) || (canBeEditedBy(user) && canBeRevived(now));
    }

    /** Ab hier löscht der nächtliche Aufräum-Job den Aushang samt Fotos. */
    public Instant getDeletionDate() {
        return revived ? expiresAt : expiresAt.plus(REVIVE_PERIOD);
    }

    BoardPhoto addPhoto(String fileKey, int width, int height) {
        int position = photos.isEmpty() ? 0 : photos.getLast().getPosition() + 1;
        BoardPhoto photo = new BoardPhoto(this, fileKey, position, width, height);
        photos.add(photo);
        return photo;
    }

    void removePhoto(BoardPhoto photo) {
        photos.remove(photo);
    }

    public Long getId() { return id; }
    public BoardKind getKind() { return kind; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public String getContact() { return contact; }
    public AppUser getAuthor() { return author; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public boolean isRevived() { return revived; }
    public List<BoardPhoto> getPhotos() { return photos; }
}
