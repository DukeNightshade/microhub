package dev.microhub.contacts;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Daten, die das Frontend beim Anlegen oder Bearbeiten eines Kontakts schickt. */
public record ContactRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 150) String organization,
        @Size(max = 50) String category,
        @Size(max = 50) String phone,
        @Email @Size(max = 255) String email,
        @Size(max = 300) String address,
        // Nur http(s) zulassen: ein Link wie „javascript:…“ würde beim Anklicken Code ausführen.
        @Pattern(regexp = "^$|^https?://.+", message = "Die Webseite muss mit http:// oder https:// beginnen.")
        @Size(max = 300) String website,
        @Size(max = 500) String note,
        int sortOrder,
        boolean publicContact) {
}
