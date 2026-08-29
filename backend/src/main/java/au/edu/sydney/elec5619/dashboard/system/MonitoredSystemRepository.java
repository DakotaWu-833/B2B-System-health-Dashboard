package au.edu.sydney.elec5619.dashboard.system;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MonitoredSystemRepository extends JpaRepository<MonitoredSystem, Long> {

    List<MonitoredSystem> findByStatus(HealthStatus status);

    long countByStatus(HealthStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select monitoredSystem from MonitoredSystem monitoredSystem where monitoredSystem.id = :systemId")
    Optional<MonitoredSystem> findByIdForUpdate(@Param("systemId") Long systemId);
}
