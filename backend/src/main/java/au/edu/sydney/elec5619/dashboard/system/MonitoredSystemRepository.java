package au.edu.sydney.elec5619.dashboard.system;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MonitoredSystemRepository extends JpaRepository<MonitoredSystem, Long> {

    List<MonitoredSystem> findTop501ByOrderByIdAsc();

    List<MonitoredSystem> findByHostIn(java.util.Collection<String> hosts);

    boolean existsByNameAndTypeAndHost(String name, String type, String host);

    boolean existsByNameAndTypeAndHostAndIdNot(String name, String type, String host, Long id);

    List<MonitoredSystem> findByStatus(HealthStatus status);

    long countByStatus(HealthStatus status);

    interface MeasuredHealthCount {
        HealthStatus getStatus();
        long getSystemCount();
    }

    @Query("""
            select monitoredSystem.status as status, count(monitoredSystem) as systemCount
            from MonitoredSystem monitoredSystem
            where exists (select metric.id from Metric metric where metric.monitoredSystem = monitoredSystem)
            group by monitoredSystem.status
            """)
    List<MeasuredHealthCount> countMeasuredSystemsByStatus();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select monitoredSystem from MonitoredSystem monitoredSystem where monitoredSystem.id = :systemId")
    Optional<MonitoredSystem> findByIdForUpdate(@Param("systemId") Long systemId);
}
