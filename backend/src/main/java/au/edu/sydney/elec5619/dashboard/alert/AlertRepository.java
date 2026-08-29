package au.edu.sydney.elec5619.dashboard.alert;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
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

    @Override
    @EntityGraph(attributePaths = "monitoredSystem")
    Page<Alert> findAll(Pageable pageable);

    @EntityGraph(attributePaths = "monitoredSystem")
    Page<Alert> findByStatus(AlertStatus status, Pageable pageable);

    @EntityGraph(attributePaths = "monitoredSystem")
    Page<Alert> findByMonitoredSystemId(Long systemId, Pageable pageable);

    @EntityGraph(attributePaths = "monitoredSystem")
    Page<Alert> findByMonitoredSystemIdAndStatus(
            Long systemId,
            AlertStatus status,
            Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Alert> findFirstByMonitoredSystemIdAndAlertTypeAndStatusInOrderByCreatedTimeDesc(
            Long systemId,
            String alertType,
            Collection<AlertStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select alert from Alert alert where alert.id = :alertId")
    Optional<Alert> findByIdForUpdate(@Param("alertId") Long alertId);
}
