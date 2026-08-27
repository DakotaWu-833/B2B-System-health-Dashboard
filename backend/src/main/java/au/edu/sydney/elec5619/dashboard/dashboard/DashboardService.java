package au.edu.sydney.elec5619.dashboard.dashboard;

import au.edu.sydney.elec5619.dashboard.system.HealthStatus;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {

    private final MonitoredSystemRepository monitoredSystemRepository;

    public DashboardService(MonitoredSystemRepository monitoredSystemRepository) {
        this.monitoredSystemRepository = monitoredSystemRepository;
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary() {
        return new DashboardSummaryResponse(
                monitoredSystemRepository.count(),
                monitoredSystemRepository.countByStatus(HealthStatus.HEALTHY),
                monitoredSystemRepository.countByStatus(HealthStatus.WARNING),
                monitoredSystemRepository.countByStatus(HealthStatus.CRITICAL),
                monitoredSystemRepository.countByStatus(HealthStatus.OFFLINE));
    }
}
