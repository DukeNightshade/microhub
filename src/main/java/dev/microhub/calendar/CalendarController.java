package dev.microhub.calendar;

import dev.microhub.common.BadRequestException;
import dev.microhub.events.EventService;
import dev.microhub.waste.WasteService;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Termine und Müllabfuhr in einem Zeitraum, für alle lesbar (SecurityConfig).
 * Gefiltert wird im Frontend – ein Zeitraum hat nur wenige Dutzend Einträge.
 */
@RestController
@RequestMapping("/api/calendar")
public class CalendarController {

    /** Schützt vor Anfragen über Jahrzehnte; ein Jahr reicht für jede Ansicht. */
    private static final long MAX_DAYS = 400;

    /** Termine vor Müll am selben Tag – ein Fest ist wichtiger als die Tonne. */
    private static final Comparator<CalendarEntry> ORDER = Comparator
            .comparing(CalendarEntry::date)
            .thenComparing(entry -> entry.type().equals("WASTE"))
            .thenComparing(entry -> entry.startsAt() == null ? "" : entry.startsAt().toString());

    private final EventService eventService;
    private final WasteService wasteService;

    public CalendarController(EventService eventService, WasteService wasteService) {
        this.eventService = eventService;
        this.wasteService = wasteService;
    }

    @GetMapping
    public List<CalendarEntry> entries(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                       @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > MAX_DAYS) {
            throw new BadRequestException("Ungültiger Zeitraum");
        }
        return Stream.concat(
                        eventService.between(from, to).stream().map(CalendarEntry::from),
                        wasteService.between(from, to).stream().map(CalendarEntry::from))
                .sorted(ORDER)
                .toList();
    }
}
