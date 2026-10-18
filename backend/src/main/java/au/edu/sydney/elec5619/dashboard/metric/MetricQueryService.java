package au.edu.sydney.elec5619.dashboard.metric;

import java.util.List;

import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemNotFoundException;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MetricQueryService {

    private final MetricRepository metricRepository;
    private final MonitoredSystemRepository monitoredSystemRepository;

    public MetricQueryService(
            MetricRepository metricRepository,
            MonitoredSystemRepository monitoredSystemRepository) {
        this.metricRepository = metricRepository;
        this.monitoredSystemRepository = monitoredSystemRepository;
    }

    private record Cursor(java.time.Instant time, long id, java.time.Instant from, java.time.Instant to) {
        String encode() {
            return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                    (time + "|" + id + "|" + from + "|" + to).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        static Cursor decode(String raw) {
            try {
                if (raw.length() > 512) throw new IllegalArgumentException();
                String[] parts = new String(java.util.Base64.getUrlDecoder().decode(raw), java.nio.charset.StandardCharsets.UTF_8).split("\\|", -1);
                if (parts.length != 4) throw new IllegalArgumentException();
                Cursor cursor = new Cursor(java.time.Instant.parse(parts[0]), Long.parseLong(parts[1]), java.time.Instant.parse(parts[2]), java.time.Instant.parse(parts[3]));
                if (cursor.id <= 0 || cursor.time.isBefore(cursor.from) || cursor.time.isAfter(cursor.to)) throw new IllegalArgumentException();
                return cursor;
            } catch (RuntimeException invalid) { throw new au.edu.sydney.elec5619.dashboard.common.InvalidPageRequestException("Invalid history cursor"); }
        }
    }

    @Transactional(readOnly = true)
    public MetricHistoryResponse history(Long systemId, java.time.Instant from, java.time.Instant to, int size, String rawCursor) {
        if (!monitoredSystemRepository.existsById(systemId)) throw new MonitoredSystemNotFoundException(systemId);
        if (size < 1 || size > 100) throw new au.edu.sydney.elec5619.dashboard.common.InvalidPageRequestException("size must be between 1 and 100");
        Cursor cursor = rawCursor == null ? null : Cursor.decode(rawCursor);
        java.time.Instant end = to != null ? to : cursor != null ? cursor.to : java.time.Instant.now();
        java.time.Instant start = from != null ? from : cursor != null ? cursor.from : end.minus(java.time.Duration.ofDays(7));
        if (start.isAfter(end) || java.time.Duration.between(start, end).compareTo(java.time.Duration.ofDays(31)) > 0
                || end.isAfter(java.time.Instant.now().plusSeconds(60)))
            throw new au.edu.sydney.elec5619.dashboard.common.InvalidPageRequestException("History range must be ordered, no more than 31 days, and not in the future");
        if (cursor != null && (!start.equals(cursor.from) || !end.equals(cursor.to)))
            throw new au.edu.sydney.elec5619.dashboard.common.InvalidPageRequestException("History cursor does not match the time range");
        var readings = metricRepository.history(systemId, start, end, cursor == null ? end : cursor.time,
                cursor == null ? Long.MAX_VALUE : cursor.id, org.springframework.data.domain.PageRequest.of(0, size + 1));
        boolean more = readings.size() > size;
        var selected = readings.stream().limit(size).toList();
        Metric last = selected.isEmpty() ? null : selected.getLast();
        String next = more ? new Cursor(last.getRecordedAt(), last.getId(), start, end).encode() : null;
        return new MetricHistoryResponse(selected.stream().map(MetricReadingResponse::from).toList(), next, more, start, end);
    }

    @Transactional(readOnly = true)
    public List<MetricReadingResponse> getRecentMetrics(Long systemId) {
        if (!monitoredSystemRepository.existsById(systemId)) {
            throw new MonitoredSystemNotFoundException(systemId);
        }

        return metricRepository.findTop100ByMonitoredSystemIdOrderByRecordedAtDescIdDesc(systemId)
                .stream()
                .map(MetricReadingResponse::from)
                .toList();
    }
}
