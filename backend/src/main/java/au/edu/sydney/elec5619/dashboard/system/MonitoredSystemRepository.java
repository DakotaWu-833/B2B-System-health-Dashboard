package au.edu.sydney.elec5619.dashboard.system;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MonitoredSystemRepository extends JpaRepository<MonitoredSystem, Long> {

    List<MonitoredSystem> findByStatus(HealthStatus status);
}
