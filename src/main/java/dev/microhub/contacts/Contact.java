package dev.microhub.contacts;

import jakarta.persistence.*;

@Entity
@Table(name = "contact")
public class Contact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 150)
    private String organization;

    /** Freitext wie „Notfall“ oder „Verwaltung“; das Frontend gruppiert danach. */
    @Column(length = 50)
    private String category;

    @Column(length = 50)
    private String phone;

    @Column(length = 255)
    private String email;

    @Column(length = 300)
    private String address;

    @Column(length = 300)
    private String website;

    @Column(length = 500)
    private String note;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    /** „public“ ist in Java ein Schlüsselwort, deshalb heißt das Feld anders als die Spalte. */
    @Column(name = "public", nullable = false)
    private boolean publicContact;

    protected Contact() {
        // für JPA
    }

    public Contact(ContactRequest request) {
        update(request);
    }

    public void update(ContactRequest request) {
        this.name = request.name().strip();
        this.organization = blankToNull(request.organization());
        this.category = blankToNull(request.category());
        this.phone = blankToNull(request.phone());
        this.email = blankToNull(request.email());
        this.address = blankToNull(request.address());
        this.website = blankToNull(request.website());
        this.note = blankToNull(request.note());
        this.sortOrder = request.sortOrder();
        this.publicContact = request.publicContact();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getOrganization() { return organization; }
    public String getCategory() { return category; }
    public String getPhone() { return phone; }
    public String getEmail() { return email; }
    public String getAddress() { return address; }
    public String getWebsite() { return website; }
    public String getNote() { return note; }
    public int getSortOrder() { return sortOrder; }
    public boolean isPublicContact() { return publicContact; }
}
