package dev.microhub.news;

import dev.microhub.common.ConflictException;
import dev.microhub.common.NotFoundException;
import dev.microhub.events.EventInfo;
import dev.microhub.events.EventService;
import dev.microhub.photos.PhotoStorage;
import dev.microhub.user.AppUser;
import dev.microhub.user.AppUserRepository;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class NewsService {

    private static final int PAGE_SIZE = 20;
    static final int MAX_PHOTOS = 5;

    private final NewsRepository newsRepository;
    private final NewsPhotoRepository photoRepository;
    private final AppUserRepository userRepository;
    private final EventService eventService;
    private final PhotoStorage photoStorage;

    public NewsService(NewsRepository newsRepository, NewsPhotoRepository photoRepository,
                       AppUserRepository userRepository, EventService eventService, PhotoStorage photoStorage) {
        this.newsRepository = newsRepository;
        this.photoRepository = photoRepository;
        this.userRepository = userRepository;
        this.eventService = eventService;
        this.photoStorage = photoStorage;
    }

    public NewsPage list(int page) {
        Slice<News> slice = newsRepository.findAllByOrderByPublishedAtDesc(
                PageRequest.of(Math.max(page, 0), PAGE_SIZE));
        List<Long> ids = slice.map(News::getId).getContent();
        // Termine und Titelbilder einer Seite mit je einer Abfrage holen statt einer pro Beitrag.
        Map<Long, EventInfo> events = eventService.forNews(ids);
        Map<Long, NewsPhotoItem> covers = new LinkedHashMap<>();
        if (!ids.isEmpty()) {
            for (NewsPhoto photo : photoRepository.findByNewsIdInOrderByPositionAsc(ids)) {
                covers.putIfAbsent(photo.getNewsId(), NewsPhotoItem.from(photo));
            }
        }
        return new NewsPage(
                slice.map(news -> NewsListItem.from(news, events.get(news.getId()), covers.get(news.getId())))
                        .getContent(),
                slice.getNumber(),
                slice.hasNext());
    }

    public NewsResponse get(long id) {
        return response(find(id));
    }

    @Transactional
    public NewsResponse create(NewsRequest request, String username) {
        AppUser author = userRepository.findByUsernameIgnoreCase(username).orElse(null);
        News news = newsRepository.save(new News(
                request.title().strip(),
                blankToNull(request.summary()),
                request.content().strip(),
                author));
        syncEvent(news, request, author);
        return response(news);
    }

    @Transactional
    public NewsResponse update(long id, NewsRequest request) {
        News news = find(id);
        news.update(request.title().strip(), blankToNull(request.summary()), request.content().strip());
        syncEvent(news, request, news.getAuthor());
        return response(news);
    }

    /**
     * Termin und Bild-Zeilen verschwinden per ON DELETE CASCADE in der Datenbank mit;
     * die Bilddateien im Upload-Ordner löschen wir selbst, sobald die Löschung gespeichert ist.
     */
    @Transactional
    public void delete(long id) {
        News news = find(id);
        photoStorage.deleteAfterCommit(photoRepository.findByNewsIdOrderByPositionAsc(id).stream()
                .map(NewsPhoto::getFileKey).toList());
        newsRepository.delete(news);
    }

    @Transactional
    public NewsResponse addPhoto(long id, InputStream image) throws IOException {
        News news = find(id);
        List<NewsPhoto> photos = photoRepository.findByNewsIdOrderByPositionAsc(id);
        if (photos.size() >= MAX_PHOTOS) {
            throw new ConflictException("Ein Beitrag kann höchstens " + MAX_PHOTOS + " Bilder haben.");
        }
        int position = photos.isEmpty() ? 0 : photos.getLast().getPosition() + 1;
        PhotoStorage.StoredPhoto stored = photoStorage.store(image);
        photoRepository.save(new NewsPhoto(id, stored.key(), position, stored.width(), stored.height()));
        return response(news);
    }

    @Transactional
    public void deletePhoto(long newsId, long photoId) {
        NewsPhoto photo = photoRepository.findById(photoId)
                .filter(p -> p.getNewsId().equals(newsId))
                .orElseThrow(() -> new NotFoundException("Bild " + photoId + " nicht gefunden"));
        photoRepository.delete(photo);
        photoStorage.deleteAfterCommit(List.of(photo.getFileKey()));
    }

    /** News sind öffentlich, ihre Bilder deshalb auch. */
    public Path photoFile(long photoId, boolean thumb) {
        NewsPhoto photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new NotFoundException("Bild " + photoId + " nicht gefunden"));
        return photoStorage.path(photo.getFileKey(), thumb);
    }

    private NewsResponse response(News news) {
        List<NewsPhotoItem> photos = photoRepository.findByNewsIdOrderByPositionAsc(news.getId()).stream()
                .map(NewsPhotoItem::from).toList();
        return NewsResponse.from(news, eventService.forNews(news.getId()).orElse(null), photos);
    }

    /** Termin anlegen, anpassen (auch den Titel) oder entfernen – je nachdem, was das Formular schickt. */
    private void syncEvent(News news, NewsRequest request, AppUser author) {
        if (request.event() == null) {
            eventService.removeForNews(news.getId());
        } else {
            eventService.saveForNews(news.getId(), news.getTitle(), request.event(), author);
        }
    }

    private News find(long id) {
        return newsRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("News " + id + " nicht gefunden"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
