package au.edu.sydney.elec5619.dashboard.demo;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import au.edu.sydney.elec5619.dashboard.alert.AlertRepository;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import au.edu.sydney.elec5619.dashboard.system.HealthStatus;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystem;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(properties = {
    "app.demo-data.enabled=true",
    "spring.datasource.url=jdbc:h2:mem:demo-data-seeder;MODE=MySQL;DB_CLOSE_DELAY=-1"
})
@ActiveProfiles("test")
class DemoDataSeederIntegrationTests {

    @Autowired
    private DemoDataSeeder demoDataSeeder;

    @Autowired
    private MonitoredSystemRepository monitoredSystemRepository;

    @Autowired
    private MetricRepository metricRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Test
    void createsDashboardReadyDemoData() {
        Map<String, MonitoredSystem> systems = monitoredSystemRepository.findAll().stream()
                .collect(Collectors.toMap(MonitoredSystem::getName, Function.identity()));

        assertThat(systems).hasSize(3);
        assertThat(systems.get("Customer API").getStatus()).isEqualTo(HealthStatus.HEALTHY);
        assertThat(systems.get("Order Database").getStatus()).isEqualTo(HealthStatus.WARNING);
        assertThat(systems.get("Legacy CRM").getStatus()).isEqualTo(HealthStatus.OFFLINE);
        assertThat(metricRepository.count()).isEqualTo(15);
        assertThat(alertRepository.count()).isEqualTo(4);
    }

    @Test
    void doesNotDuplicateDataWhenRunAgain() throws Exception {
        demoDataSeeder.run(null);

        assertThat(monitoredSystemRepository.count()).isEqualTo(3);
        assertThat(metricRepository.count()).isEqualTo(15);
        assertThat(alertRepository.count()).isEqualTo(4);
    }
}
