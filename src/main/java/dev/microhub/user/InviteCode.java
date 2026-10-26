package dev.microhub.user;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "invite_code")
public class InviteCode {

    /** Zwei Personen pro Wohnung. */
    static final int DEFAULT_MAX_USES = 2;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20, unique = true)
    private String code;

    /** Für wen der Code ist, z. B. „Whg. 3“. */
    @Column(nullable = false, length = 100)
    private String label;

    @Column(name = "max_uses", nullable = false)
    private int maxUses = DEFAULT_MAX_USES;

    @Column(name = "used_count", nullable = false)
    private int usedCount;

    @Column(nullable = false)
    private boolean revoked;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected InviteCode() {
        // für JPA
    }

    InviteCode(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public boolean isUsable() {
        return !revoked && usedCount < maxUses;
    }

    void redeem() {
        if (!isUsable()) {
            throw new IllegalStateException("Code " + id + " ist nicht mehr einlösbar");
        }
        usedCount++;
    }

    void setRevoked(boolean revoked) {
        this.revoked = revoked;
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getLabel() { return label; }
    public int getMaxUses() { return maxUses; }
    public int getUsedCount() { return usedCount; }
    public boolean isRevoked() { return revoked; }
    public Instant getCreatedAt() { return createdAt; }
}
