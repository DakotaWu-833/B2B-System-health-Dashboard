package au.edu.sydney.elec5619.dashboard.system;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.time.Duration;
import au.edu.sydney.elec5619.dashboard.metric.MetricFreshnessPolicy;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class SystemDuplicateRaceTests {
    @Mock MonitoredSystemRepository systems;
    @Mock MetricRepository metrics;
    @Mock HealthThresholdProperties thresholds;

    @Test
    void uniqueConstraintRaceBecomesDomainConflict() {
        when(systems.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException(
                "Duplicate entry for key 'uk_monitored_systems_identity'"));
        var service = new SystemService(
                systems, metrics, thresholds, new MetricFreshnessPolicy(Duration.ofMinutes(5)));
        assertThatThrownBy(() -> service.createSystem(new SystemMutationRequest("A", "SERVICE", "host", null)))
                .isInstanceOf(DuplicateMonitoredSystemException.class);
    }

    @Test
    void unrelatedDatabaseFailureIsNotMisreportedAsDuplicateSystem() {
        when(systems.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("other constraint"));
        var service = new SystemService(
                systems, metrics, thresholds, new MetricFreshnessPolicy(Duration.ofMinutes(5)));
        assertThatThrownBy(() -> service.createSystem(new SystemMutationRequest("A", "SERVICE", "host", null)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
