package au.edu.sydney.elec5619.dashboard.metric;
import java.time.Instant;
import java.util.List;
public record MetricHistoryResponse(List<MetricReadingResponse> items, String nextCursor, boolean hasMore, Instant from, Instant to) {
    public MetricHistoryResponse { items = List.copyOf(items); }
}
