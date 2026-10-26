package dev.microhub.calendar;

import dev.microhub.events.EventResponse;
import dev.microhub.waste.WasteItem;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Ein Eintrag im Kalender: entweder ein Termin oder eine Müllabfuhr. Ein gemeinsames Format,
 * damit das Frontend beides in einer Liste bzw. einem Monatsraster mischen und filtern kann.
 *
 * @param type     EVENT oder WASTE
 * @param date     Tag in Europe/Berlin, nach dem das Frontend gruppiert
 * @param category Filterschlüssel: „EVENT“ oder die Abfallart (RESTMUELL, BIO …)
 * @param newsId   bei Terminen eines News-Beitrags: dorthin führt ein Klick
 */
public record CalendarEntry(
        String type,
        Long id,
        LocalDate date,
        String category,
        String title,
        Instant startsAt,
        Instant endsAt,
        boolean allDay,
        String location,
        String note,
        Long newsId) {

    private static final ZoneId BERLIN = ZoneId.of("Europe/Berlin");

    static CalendarEntry from(EventResponse event) {
        return new CalendarEntry("EVENT", event.id(), LocalDate.ofInstant(event.startsAt(), BERLIN), "EVENT",
                event.title(), event.startsAt(), event.endsAt(), event.allDay(), event.location(), null, event.newsId());
    }

    static CalendarEntry from(WasteItem waste) {
        return new CalendarEntry("WASTE", waste.id(), waste.collectionDate(), waste.wasteType().name(),
                waste.label(), null, null, true, null, waste.note(), null);
    }
}
