package dev.microhub.events;

import java.time.Instant;

/** Der Termin eines News-Beitrags, wie ihn News-Liste und -Detail anzeigen. */
public record EventInfo(Long id, Instant startsAt, Instant endsAt, boolean allDay, String location) {

    static EventInfo from(CalendarEvent event) {
        return new EventInfo(event.getId(), event.getStartsAt(), event.getEndsAt(), event.isAllDay(),
                event.getLocation());
    }
}
