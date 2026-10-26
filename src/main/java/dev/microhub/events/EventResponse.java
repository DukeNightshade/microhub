package dev.microhub.events;

import java.time.Instant;

/** Ein Termin mit Beschreibung. newsId ist gesetzt, wenn die Details in einem News-Beitrag stehen. */
public record EventResponse(
        Long id,
        String title,
        String description,
        String location,
        Instant startsAt,
        Instant endsAt,
        boolean allDay,
        String createdBy,
        Long newsId) {

    static EventResponse from(CalendarEvent event) {
        return new EventResponse(
                event.getId(),
                event.getTitle(),
                event.getDescription(),
                event.getLocation(),
                event.getStartsAt(),
                event.getEndsAt(),
                event.isAllDay(),
                event.getCreatedBy() == null ? null : event.getCreatedBy().getDisplayName(),
                event.getNewsId());
    }
}
