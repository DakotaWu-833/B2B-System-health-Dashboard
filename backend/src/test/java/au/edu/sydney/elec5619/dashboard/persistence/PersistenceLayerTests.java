package au.edu.sydney.elec5619.dashboard.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import au.edu.sydney.elec5619.dashboard.alert.Alert;
import au.edu.sydney.elec5619.dashboard.alert.AlertRepository;
import au.edu.sydney.elec5619.dashboard.alert.AlertSeverity;
import au.edu.sydney.elec5619.dashboard.alert.AlertStatus;
import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import au.edu.sydney.elec5619.dashboard.system.HealthStatus;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystem;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import au.edu.sydney.elec5619.dashboard.user.Role;
import au.edu.sydney.elec5619.dashboard.user.User;
import au.edu.sydney.elec5619.dashboard.user.UserRepository;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
class PersistenceLayerTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MonitoredSystemRepository monitoredSystemRepository;

    @Autowired
    private MetricRepository metricRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Test
    void persistsUserAndFindsItByUsername() {
        User user = new User("operator", "encoded-password", Role.OPERATIONS);

        userRepository.saveAndFlush(user);

        assertThat(user.getId()).isNotNull();
        assertThat(userRepository.findByUsername("operator"))
                .get()
                .extracting(User::getRole)
                .isEqualTo(Role.OPERATIONS);
    }

    @Test
    void rejectsDuplicateUsernames() {
        userRepository.saveAndFlush(new User("manager", "first-hash", Role.MANAGEMENT));

        assertThatThrownBy(() -> userRepository.saveAndFlush(
                new User("manager", "second-hash", Role.MANAGEMENT)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void persistsMetricsAndAlertsForMonitoredSystem() {
        MonitoredSystem monitoredSystem = monitoredSystemRepository.saveAndFlush(
                new MonitoredSystem(
                        "Customer API",
                        "SERVICE",
                        "api.internal.example",
                        HealthStatus.WARNING,
                        "Main customer-facing API"));

        Instant olderReadingTime = Instant.parse("2026-08-26T01:00:00Z");
        Instant newerReadingTime = Instant.parse("2026-08-26T01:05:00Z");

        metricRepository.save(new Metric(
                monitoredSystem,
                new BigDecimal("72.50"),
                new BigDecimal("68.25"),
                240L,
                true,
                olderReadingTime));
        metricRepository.saveAndFlush(new Metric(
                monitoredSystem,
                new BigDecimal("86.00"),
                new BigDecimal("70.10"),
                410L,
                true,
                newerReadingTime));

        Alert alert = alertRepository.saveAndFlush(new Alert(
                monitoredSystem,
                "HIGH_CPU",
                AlertSeverity.WARNING,
                "CPU usage exceeded the warning threshold",
                AlertStatus.ACTIVE,
                newerReadingTime));

        List<Metric> metrics = metricRepository
                .findTop100ByMonitoredSystemIdOrderByRecordedAtDesc(monitoredSystem.getId());
        List<Alert> activeAlerts = alertRepository
                .findByStatusOrderByCreatedTimeDesc(AlertStatus.ACTIVE);

        assertThat(metrics)
                .extracting(Metric::getRecordedAt)
                .containsExactly(newerReadingTime, olderReadingTime);
        assertThat(activeAlerts).containsExactly(alert);
        assertThat(alert.getMonitoredSystem().getId()).isEqualTo(monitoredSystem.getId());
    }

    @Test
    void rejectsMetricPercentagesOutsideValidRange() {
        MonitoredSystem monitoredSystem = monitoredSystemRepository.saveAndFlush(
                new MonitoredSystem(
                        "Database Server",
                        "SERVER",
                        "db.internal.example",
                        HealthStatus.HEALTHY,
                        null));

        Metric invalidMetric = new Metric(
                monitoredSystem,
                new BigDecimal("101.00"),
                new BigDecimal("50.00"),
                25L,
                true,
                Instant.parse("2026-08-26T02:00:00Z"));

        assertThatThrownBy(() -> metricRepository.saveAndFlush(invalidMetric))
                .isInstanceOf(ConstraintViolationException.class);
    }
}
