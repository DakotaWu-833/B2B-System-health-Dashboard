package au.edu.sydney.elec5619.dashboard.metric;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MetricRepository extends JpaRepository<Metric, Long> {

    @Query("""
            select m from Metric m where not exists (
                select newer.id from Metric newer
                where newer.monitoredSystem = m.monitoredSystem
                and (newer.recordedAt > m.recordedAt
                    or (newer.recordedAt = m.recordedAt and newer.id > m.id)))
            """)
    List<Metric> findLatestForAllSystems();

    Optional<Metric> findFirstByMonitoredSystemIdOrderByRecordedAtDescIdDesc(Long systemId);

    List<Metric> findTop100ByMonitoredSystemIdOrderByRecordedAtDesc(Long systemId);

    Optional<Metric> findFirstByMonitoredSystemIdOrderByRecordedAtDesc(Long systemId);
}
