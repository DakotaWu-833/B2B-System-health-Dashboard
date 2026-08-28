package au.edu.sydney.elec5619.dashboard.alert;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findAllByOrderByCreatedTimeDesc();

    List<Alert> findByStatusOrderByCreatedTimeDesc(AlertStatus status);

    List<Alert> findByMonitoredSystemIdOrderByCreatedTimeDesc(Long systemId);

    List<Alert> findByMonitoredSystemIdAndStatusOrderByCreatedTimeDesc(
            Long systemId,
            AlertStatus status);

    Optional<Alert> findFirstByMonitoredSystemIdAndAlertTypeAndStatusInOrderByCreatedTimeDesc(
            Long systemId,
            String alertType,
            Collection<AlertStatus> statuses);
}
