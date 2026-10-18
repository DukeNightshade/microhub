package dev.microhub.events;

import dev.microhub.common.NotFoundException;
import dev.microhub.user.AppUser;
import dev.microhub.user.AppUserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class EventService {

    private static final int PAGE_SIZE = 20;
    private static final ZoneId BERLIN = ZoneId.of("Europe/Berlin");

    private final EventRepository eventRepository;
    private final AppUserRepository userRepository;

    public EventService(EventRepository eventRepository, AppUserRepository userRepository) {
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
    }

    public EventPage list(int page, boolean past) {
        Instant heuteFrueh = heutigerTagesbeginn();
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), PAGE_SIZE);

        Slice<CalendarEvent> slice = past
                ? eventRepository.findByStartsAtLessThanOrderByStartsAtDesc(heuteFrueh, pageRequest)
                : eventRepository.findByStartsAtGreaterThanEqualOrderByStartsAtAsc(heuteFrueh, pageRequest);

        return new EventPage(
                slice.map(EventListItem::from).getContent(),
                slice.getNumber(),
                slice.hasNext());
    }

    public EventResponse get(long id) {
        return EventResponse.from(find(id));
    }

    @Transactional
    public EventResponse create(EventRequest request, String username) {
        AppUser creator = userRepository.findByUsernameIgnoreCase(username).orElse(null);
        CalendarEvent event = new CalendarEvent(
                request.title().strip(),
                blankToNull(request.description()),
                blankToNull(request.location()),
                request.startsAt(),
                request.endsAt(),
                request.allDay(),
                creator);
        return EventResponse.from(eventRepository.save(event));
    }

    @Transactional
    public EventResponse update(long id, EventRequest request) {
        CalendarEvent event = find(id);
        event.update(
                request.title().strip(),
                blankToNull(request.description()),
                blankToNull(request.location()),
                request.startsAt(),
                request.endsAt(),
                request.allDay());
        return EventResponse.from(event);
    }

    @Transactional
    public void delete(long id) {
        eventRepository.delete(find(id));
    }

    /**
     * Grenze zwischen kommend und vergangen: der Beginn des heutigen Tages in Europe/Berlin.
     * So verschwindet ein Termin von heute Vormittag nicht schon mittags aus der Liste.
     */
    private static Instant heutigerTagesbeginn() {
        return LocalDate.now(BERLIN).atStartOfDay(BERLIN).toInstant();
    }

    private CalendarEvent find(long id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Termin " + id + " nicht gefunden"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
