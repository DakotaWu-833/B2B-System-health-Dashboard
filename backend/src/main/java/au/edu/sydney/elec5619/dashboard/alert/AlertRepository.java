package au.edu.sydney.elec5619.dashboard.alert;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findByStatusOrderByCreatedTimeDesc(AlertStatus status);

    List<Alert> findByMonitoredSystemIdOrderByCreatedTimeDesc(Long systemId);
}
