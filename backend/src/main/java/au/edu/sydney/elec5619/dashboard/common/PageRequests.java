package au.edu.sydney.elec5619.dashboard.common;
import org.springframework.data.domain.*;
public final class PageRequests {
    private PageRequests() {}
    public static Pageable bounded(int page, int size, Sort sort) {
        if (page < 0 || page > 1000000) throw new InvalidPageRequestException("page must be between 0 and 1000000");
        if (size < 1 || size > 100) throw new InvalidPageRequestException("size must be between 1 and 100");
        return PageRequest.of(page, size, sort);
    }
}
