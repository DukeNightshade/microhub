package dev.microhub.events;

import dev.microhub.common.ConflictException;
import dev.microhub.common.NotFoundException;
import dev.microhub.user.AppUser;
import dev.microhub.user.AppUserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class EventService {

    private static final ZoneId BERLIN = ZoneId.of("Europe/Berlin");

    private final EventRepository eventRepository;
    private final AppUserRepository userRepository;

    public EventService(EventRepository eventRepository, AppUserRepository userRepository) {
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
    }

    /** Alle Termine, die an einem der Tage (Europe/Berlin) beginnen; für den Kalender. */
    public List<EventResponse> between(LocalDate from, LocalDate toInclusive) {
        Instant start = from.atStartOfDay(BERLIN).toInstant();
        Instant end = toInclusive.plusDays(1).atStartOfDay(BERLIN).toInstant();
        return eventRepository.findByStartsAtGreaterThanEqualAndStartsAtLessThanOrderByStartsAtAsc(start, end)
                .stream().map(EventResponse::from).toList();
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
        CalendarEvent event = findStandalone(id);
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
        eventRepository.delete(findStandalone(id));
    }

    // ---------- Termine zu News-Beiträgen (aufgerufen vom NewsService) ----------

    public Optional<EventInfo> forNews(long newsId) {
        return eventRepository.findByNewsId(newsId).map(EventInfo::from);
    }

    public Map<Long, EventInfo> forNews(Collection<Long> newsIds) {
        if (newsIds.isEmpty()) return Map.of();
        return eventRepository.findByNewsIdIn(newsIds).stream()
                .collect(Collectors.toMap(CalendarEvent::getNewsId, EventInfo::from));
    }

    /** Legt den Termin eines Beitrags an oder passt ihn an; der Titel kommt immer aus der News. */
    @Transactional
    public EventInfo saveForNews(long newsId, String title, EventTiming timing, AppUser createdBy) {
        EventTiming cleaned = new EventTiming(timing.startsAt(), timing.endsAt(), timing.allDay(),
                blankToNull(timing.location()));
        CalendarEvent event = eventRepository.findByNewsId(newsId)
                .map(existing -> {
                    existing.updateFromNews(title, cleaned);
                    return existing;
                })
                .orElseGet(() -> eventRepository.save(CalendarEvent.forNews(newsId, title, cleaned, createdBy)));
        return EventInfo.from(event);
    }

    @Transactional
    public void removeForNews(long newsId) {
        eventRepository.findByNewsId(newsId).ifPresent(eventRepository::delete);
    }

    // ---------- intern ----------

    /** Termine eines News-Beitrags werden nur über den Beitrag gepflegt – sonst liefen beide auseinander. */
    private CalendarEvent findStandalone(long id) {
        CalendarEvent event = find(id);
        if (event.getNewsId() != null) {
            throw new ConflictException("Dieser Termin gehört zu einem News-Beitrag. Ändere ihn bitte dort.");
        }
        return event;
    }

    private CalendarEvent find(long id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Termin " + id + " nicht gefunden"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
