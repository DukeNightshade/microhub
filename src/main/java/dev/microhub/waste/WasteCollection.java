package dev.microhub.waste;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "waste_collection")
public class WasteCollection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "waste_type", nullable = false, length = 30)
    private WasteType wasteType;

    @Column(name = "collection_date", nullable = false)
    private LocalDate collectionDate;

    /** Straße oder Bezirk, falls es mehrere Touren gibt. Vorerst immer leer: eine Tour. */
    @Column(length = 100)
    private String area;

    @Column(length = 300)
    private String note;

    /** Verhindert später, dass dieselbe Erinnerung zweimal verschickt wird. */
    @Column(name = "reminder_sent", nullable = false)
    private boolean reminderSent;

    protected WasteCollection() {
        // für JPA
    }

    public WasteCollection(WasteType wasteType, LocalDate collectionDate, String note) {
        this.wasteType = wasteType;
        this.collectionDate = collectionDate;
        this.note = note;
    }

    public void update(WasteType wasteType, LocalDate collectionDate, String note) {
        // Verschiebt sich der Termin, darf die Erinnerung erneut verschickt werden.
        if (!collectionDate.equals(this.collectionDate)) {
            this.reminderSent = false;
        }
        this.wasteType = wasteType;
        this.collectionDate = collectionDate;
        this.note = note;
    }

    public void markReminderSent() {
        this.reminderSent = true;
    }

    public Long getId() { return id; }
    public WasteType getWasteType() { return wasteType; }
    public LocalDate getCollectionDate() { return collectionDate; }
    public String getArea() { return area; }
    public String getNote() { return note; }
    public boolean isReminderSent() { return reminderSent; }
}
