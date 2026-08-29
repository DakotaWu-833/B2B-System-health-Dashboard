package au.edu.sydney.elec5619.dashboard.alert;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findAllByOrderByCreatedTimeDesc();

    List<Alert> findByStatusOrderByCreatedTimeDesc(AlertStatus status);

    List<Alert> findByMonitoredSystemIdOrderByCreatedTimeDesc(Long systemId);

    List<Alert> findByMonitoredSystemIdAndStatusOrderByCreatedTimeDesc(
            Long systemId,
            AlertStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Alert> findFirstByMonitoredSystemIdAndAlertTypeAndStatusInOrderByCreatedTimeDesc(
            Long systemId,
            String alertType,
            Collection<AlertStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select alert from Alert alert where alert.id = :alertId")
    Optional<Alert> findByIdForUpdate(@Param("alertId") Long alertId);
}
