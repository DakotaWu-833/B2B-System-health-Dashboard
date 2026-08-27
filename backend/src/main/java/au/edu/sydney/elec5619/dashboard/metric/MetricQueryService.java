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

    @Transactional(readOnly = true)
    public List<MetricReadingResponse> getRecentMetrics(Long systemId) {
        if (!monitoredSystemRepository.existsById(systemId)) {
            throw new MonitoredSystemNotFoundException(systemId);
        }

        return metricRepository.findTop100ByMonitoredSystemIdOrderByRecordedAtDesc(systemId)
                .stream()
                .map(MetricReadingResponse::from)
                .toList();
    }
}
