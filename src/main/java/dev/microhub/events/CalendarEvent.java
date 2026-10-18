package dev.microhub.events;

import dev.microhub.user.AppUser;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "calendar_event")
public class CalendarEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(length = 200)
    private String location;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    /** Darf leer sein: dann hat der Termin nur einen Beginn. */
    @Column(name = "ends_at")
    private Instant endsAt;

    /** Ganztägig: gespeichert wird Mitternacht Europe/Berlin, angezeigt nur das Datum. */
    @Column(name = "all_day", nullable = false)
    private boolean allDay;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private AppUser createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected CalendarEvent() {
        // für JPA
    }

    public CalendarEvent(String title, String description, String location,
                         Instant startsAt, Instant endsAt, boolean allDay, AppUser createdBy) {
        this.title = title;
        this.description = description;
        this.location = location;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.allDay = allDay;
        this.createdBy = createdBy;
    }

    public void update(String title, String description, String location,
                       Instant startsAt, Instant endsAt, boolean allDay) {
        this.title = title;
        this.description = description;
        this.location = location;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.allDay = allDay;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getLocation() { return location; }
    public Instant getStartsAt() { return startsAt; }
    public Instant getEndsAt() { return endsAt; }
    public boolean isAllDay() { return allDay; }
    public AppUser getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
