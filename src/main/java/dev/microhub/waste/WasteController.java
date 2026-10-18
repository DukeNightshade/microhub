package dev.microhub.waste;

import dev.microhub.common.BadRequestException;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * Lesen: für alle (auch Gäste). Eintragen, Ändern, Löschen: nur Admins.
 * Die Rechte stehen zentral in der SecurityConfig.
 */
@RestController
@RequestMapping("/api/waste")
public class WasteController {

    private final WasteService wasteService;
    private final WasteImportService wasteImportService;

    public WasteController(WasteService wasteService, WasteImportService wasteImportService) {
        this.wasteService = wasteService;
        this.wasteImportService = wasteImportService;
    }

    /** Nimmt die ICS-Datei des Entsorgers entgegen und legt die Abfuhrtermine daraus an. */
    @PostMapping("/import")
    public WasteImportResult importIcs(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new BadRequestException("Die Datei ist leer.");
        }
        return wasteImportService.importIcs(file.getInputStream());
    }

    @GetMapping
    public WastePage list(@RequestParam(defaultValue = "0") int page,
                          @RequestParam(defaultValue = "false") boolean vergangen) {
        return wasteService.list(page, vergangen);
    }

    /** Die Abfallarten mit Beschriftung, für die Auswahlliste im Formular. */
    @GetMapping("/types")
    public List<WasteTypeOption> types() {
        return wasteService.types();
    }

    @GetMapping("/{id}")
    public WasteItem get(@PathVariable long id) {
        return wasteService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WasteItem create(@Valid @RequestBody WasteRequest request) {
        return wasteService.create(request);
    }

    @PutMapping("/{id}")
    public WasteItem update(@PathVariable long id, @Valid @RequestBody WasteRequest request) {
        return wasteService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        wasteService.delete(id);
    }
}
