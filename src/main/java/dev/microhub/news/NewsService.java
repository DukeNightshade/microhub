package dev.microhub.news;

import dev.microhub.common.NotFoundException;
import dev.microhub.events.EventInfo;
import dev.microhub.events.EventService;
import dev.microhub.user.AppUser;
import dev.microhub.user.AppUserRepository;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class NewsService {

    private static final int PAGE_SIZE = 20;

    private final NewsRepository newsRepository;
    private final AppUserRepository userRepository;
    private final EventService eventService;

    public NewsService(NewsRepository newsRepository, AppUserRepository userRepository, EventService eventService) {
        this.newsRepository = newsRepository;
        this.userRepository = userRepository;
        this.eventService = eventService;
    }

    public NewsPage list(int page) {
        Slice<News> slice = newsRepository.findAllByOrderByPublishedAtDesc(
                PageRequest.of(Math.max(page, 0), PAGE_SIZE));
        // Die Termine einer Seite mit einer einzigen Abfrage holen statt einer pro Beitrag.
        Map<Long, EventInfo> events = eventService.forNews(slice.map(News::getId).getContent());
        return new NewsPage(
                slice.map(news -> NewsListItem.from(news, events.get(news.getId()))).getContent(),
                slice.getNumber(),
                slice.hasNext());
    }

    public NewsResponse get(long id) {
        News news = find(id);
        return NewsResponse.from(news, eventService.forNews(id).orElse(null));
    }

    @Transactional
    public NewsResponse create(NewsRequest request, String username) {
        AppUser author = userRepository.findByUsernameIgnoreCase(username).orElse(null);
        News news = newsRepository.save(new News(
                request.title().strip(),
                blankToNull(request.summary()),
                request.content().strip(),
                author));
        return NewsResponse.from(news, syncEvent(news, request, author));
    }

    @Transactional
    public NewsResponse update(long id, NewsRequest request) {
        News news = find(id);
        news.update(request.title().strip(), blankToNull(request.summary()), request.content().strip());
        return NewsResponse.from(news, syncEvent(news, request, news.getAuthor()));
    }

    /** Der zugehörige Termin verschwindet per ON DELETE CASCADE in der Datenbank mit. */
    @Transactional
    public void delete(long id) {
        newsRepository.delete(find(id));
    }

    /** Termin anlegen, anpassen (auch den Titel) oder entfernen – je nachdem, was das Formular schickt. */
    private EventInfo syncEvent(News news, NewsRequest request, AppUser author) {
        if (request.event() == null) {
            eventService.removeForNews(news.getId());
            return null;
        }
        return eventService.saveForNews(news.getId(), news.getTitle(), request.event(), author);
    }

    private News find(long id) {
        return newsRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("News " + id + " nicht gefunden"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
