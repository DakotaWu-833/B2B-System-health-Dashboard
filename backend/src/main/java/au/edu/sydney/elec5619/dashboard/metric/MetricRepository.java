package au.edu.sydney.elec5619.dashboard.metric;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MetricRepository extends JpaRepository<Metric, Long> {

    List<Metric> findTop100ByMonitoredSystemIdOrderByRecordedAtDesc(Long systemId);
}
