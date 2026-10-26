package dev.microhub.contacts;

import dev.microhub.common.NotFoundException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ContactService {

    private final ContactRepository contactRepository;

    public ContactService(ContactRepository contactRepository) {
        this.contactRepository = contactRepository;
    }

    /**
     * Ein Telefonbuch hat nur wenige Dutzend Einträge, deshalb ohne Seiten.
     * Gäste bekommen nur die öffentlichen Kontakte.
     */
    public List<ContactItem> list(boolean loggedIn) {
        List<Contact> contacts = loggedIn
                ? contactRepository.findAllByOrderBySortOrderAscNameAsc()
                : contactRepository.findByPublicContactTrueOrderBySortOrderAscNameAsc();
        return contacts.stream().map(ContactItem::from).toList();
    }

    public ContactItem get(long id, boolean loggedIn) {
        Contact contact = find(id);
        // Gäste erfahren nicht einmal, dass es einen internen Kontakt mit dieser Nummer gibt.
        if (!loggedIn && !contact.isPublicContact()) {
            throw notFound(id);
        }
        return ContactItem.from(contact);
    }

    @Transactional
    public ContactItem create(ContactRequest request) {
        return ContactItem.from(contactRepository.save(new Contact(request)));
    }

    @Transactional
    public ContactItem update(long id, ContactRequest request) {
        Contact contact = find(id);
        contact.update(request);
        return ContactItem.from(contact);
    }

    @Transactional
    public void delete(long id) {
        contactRepository.delete(find(id));
    }

    private Contact find(long id) {
        return contactRepository.findById(id).orElseThrow(() -> notFound(id));
    }

    private static NotFoundException notFound(long id) {
        return new NotFoundException("Kontakt " + id + " nicht gefunden");
    }
}
