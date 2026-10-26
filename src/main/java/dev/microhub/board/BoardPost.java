package dev.microhub.board;

import dev.microhub.user.AppUser;
import dev.microhub.user.Role;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "board_post")
public class BoardPost {

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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id")
    private AppUser author;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    /** Danach wird der Aushang nicht mehr angezeigt. Beim Bearbeiten neu wählbar, also verlängerbar. */
    @Column(name = "expires_at")
    private Instant expiresAt;

    protected BoardPost() {
        // für JPA
    }

    public BoardPost(BoardKind kind, String title, String content, AppUser author, Instant expiresAt) {
        this.kind = kind;
        this.title = title;
        this.content = content;
        this.author = author;
        this.expiresAt = expiresAt;
    }

    public void update(BoardKind kind, String title, String content, Instant expiresAt) {
        this.kind = kind;
        this.title = title;
        this.content = content;
        this.expiresAt = expiresAt;
    }

    /**
     * Ändern und Löschen dürfen der Autor und Admins.
     * author.getId() lädt den Benutzer nicht nach – die ID kennt Hibernate schon aus author_id.
     */
    public boolean canBeEditedBy(AppUser user) {
        return user.getRole() == Role.ADMIN || author.getId().equals(user.getId());
    }

    public Long getId() { return id; }
    public BoardKind getKind() { return kind; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public AppUser getAuthor() { return author; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
}
