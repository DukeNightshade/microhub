package dev.microhub.waste;

import dev.microhub.common.ConflictException;
import dev.microhub.common.NotFoundException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WasteService {

    private static final int PAGE_SIZE = 30;
    private static final ZoneId BERLIN = ZoneId.of("Europe/Berlin");

    private final WasteRepository wasteRepository;

    public WasteService(WasteRepository wasteRepository) {
        this.wasteRepository = wasteRepository;
    }

    public WastePage list(int page, boolean past) {
        LocalDate today = LocalDate.now(BERLIN);
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), PAGE_SIZE);

        Slice<WasteCollection> slice = past
                ? wasteRepository.findByCollectionDateLessThanOrderByCollectionDateDesc(today, pageRequest)
                : wasteRepository.findByCollectionDateGreaterThanEqualOrderByCollectionDateAsc(today, pageRequest);

        return new WastePage(
                slice.map(WasteItem::from).getContent(),
                slice.getNumber(),
                slice.hasNext());
    }

    public List<WasteTypeOption> types() {
        return Arrays.stream(WasteType.values()).map(WasteTypeOption::from).toList();
    }

    public WasteItem get(long id) {
        return WasteItem.from(find(id));
    }

    @Transactional
    public WasteItem create(WasteRequest request) {
        if (wasteRepository.existsByWasteTypeAndCollectionDate(request.wasteType(), request.collectionDate())) {
            throw new ConflictException("Für diesen Tag ist " + request.wasteType().getLabel() + " schon eingetragen.");
        }
        WasteCollection collection = new WasteCollection(
                request.wasteType(),
                request.collectionDate(),
                blankToNull(request.note()));
        return WasteItem.from(wasteRepository.save(collection));
    }

    @Transactional
    public WasteItem update(long id, WasteRequest request) {
        WasteCollection collection = find(id);
        if (wasteRepository.existsByWasteTypeAndCollectionDateAndIdNot(
                request.wasteType(), request.collectionDate(), id)) {
            throw new ConflictException("Für diesen Tag ist " + request.wasteType().getLabel() + " schon eingetragen.");
        }
        collection.update(request.wasteType(), request.collectionDate(), blankToNull(request.note()));
        return WasteItem.from(collection);
    }

    @Transactional
    public void delete(long id) {
        wasteRepository.delete(find(id));
    }

    private WasteCollection find(long id) {
        return wasteRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Abfuhr " + id + " nicht gefunden"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
