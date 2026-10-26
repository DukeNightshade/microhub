package dev.microhub.contacts;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContactRepository extends JpaRepository<Contact, Long> {

    List<Contact> findAllByOrderBySortOrderAscNameAsc();

    /** Für Gäste: nur die öffentlichen Einträge. */
    List<Contact> findByPublicContactTrueOrderBySortOrderAscNameAsc();
}
