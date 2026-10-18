package dev.microhub.events;

import java.time.Instant;

/** Ein Termin mit Beschreibung, für die Detailansicht. */
public record EventResponse(
        Long id,
        String title,
        String description,
        String location,
        Instant startsAt,
        Instant endsAt,
        boolean allDay,
        String createdBy) {

    static EventResponse from(CalendarEvent event) {
        return new EventResponse(
                event.getId(),
                event.getTitle(),
                event.getDescription(),
                event.getLocation(),
                event.getStartsAt(),
                event.getEndsAt(),
                event.isAllDay(),
                event.getCreatedBy() == null ? null : event.getCreatedBy().getDisplayName());
    }
}
