package dev.microhub.contacts;

/** Ein Kontakt, wie ihn das Frontend anzeigt. */
public record ContactItem(
        Long id,
        String name,
        String organization,
        String category,
        String phone,
        String email,
        String address,
        String website,
        String note,
        int sortOrder,
        boolean publicContact) {

    static ContactItem from(Contact contact) {
        return new ContactItem(
                contact.getId(),
                contact.getName(),
                contact.getOrganization(),
                contact.getCategory(),
                contact.getPhone(),
                contact.getEmail(),
                contact.getAddress(),
                contact.getWebsite(),
                contact.getNote(),
                contact.getSortOrder(),
                contact.isPublicContact());
    }
}
