package dev.microhub.events;

import java.time.Instant;

/** Ein Termin ohne Beschreibung, für die Liste. */
public record EventListItem(
        Long id,
        String title,
        String location,
        Instant startsAt,
        Instant endsAt,
        boolean allDay) {

    static EventListItem from(CalendarEvent event) {
        return new EventListItem(
                event.getId(),
                event.getTitle(),
                event.getLocation(),
                event.getStartsAt(),
                event.getEndsAt(),
                event.isAllDay());
    }
}
