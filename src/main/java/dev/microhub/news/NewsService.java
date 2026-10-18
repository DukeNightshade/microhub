package dev.microhub.news;

import dev.microhub.common.NotFoundException;
import dev.microhub.user.AppUser;
import dev.microhub.user.AppUserRepository;
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

    public NewsService(NewsRepository newsRepository, AppUserRepository userRepository) {
        this.newsRepository = newsRepository;
        this.userRepository = userRepository;
    }

    public NewsPage list(int page) {
        Slice<News> slice = newsRepository.findAllByOrderByPublishedAtDesc(
                PageRequest.of(Math.max(page, 0), PAGE_SIZE));
        return new NewsPage(
                slice.map(NewsListItem::from).getContent(),
                slice.getNumber(),
                slice.hasNext());
    }

    public NewsResponse get(long id) {
        return NewsResponse.from(find(id));
    }

    @Transactional
    public NewsResponse create(NewsRequest request, String username) {
        AppUser author = userRepository.findByUsernameIgnoreCase(username).orElse(null);
        News news = new News(
                request.title().strip(),
                blankToNull(request.summary()),
                request.content().strip(),
                author);
        return NewsResponse.from(newsRepository.save(news));
    }

    @Transactional
    public NewsResponse update(long id, NewsRequest request) {
        News news = find(id);
        news.update(request.title().strip(), blankToNull(request.summary()), request.content().strip());
        return NewsResponse.from(news);
    }

    @Transactional
    public void delete(long id) {
        newsRepository.delete(find(id));
    }

    private News find(long id) {
        return newsRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("News " + id + " nicht gefunden"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
