package au.edu.sydney.elec5619.dashboard.demo;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import au.edu.sydney.elec5619.dashboard.alert.Alert;
import au.edu.sydney.elec5619.dashboard.alert.AlertRepository;
import au.edu.sydney.elec5619.dashboard.alert.AlertSeverity;
import au.edu.sydney.elec5619.dashboard.alert.AlertStatus;
import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import au.edu.sydney.elec5619.dashboard.system.HealthStatus;
import au.edu.sydney.elec5619.dashboard.system.HealthStatusCalculator;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystem;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(
        prefix = "app.demo-data",
        name = "enabled",
        havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger LOGGER = LoggerFactory.getLogger(DemoDataSeeder.class);

    private final MonitoredSystemRepository monitoredSystemRepository;
    private final MetricRepository metricRepository;
    private final AlertRepository alertRepository;
    private final HealthStatusCalculator healthStatusCalculator;

    public DemoDataSeeder(
            MonitoredSystemRepository monitoredSystemRepository,
            MetricRepository metricRepository,
            AlertRepository alertRepository,
            HealthStatusCalculator healthStatusCalculator) {
        this.monitoredSystemRepository = monitoredSystemRepository;
        this.metricRepository = metricRepository;
        this.alertRepository = alertRepository;
        this.healthStatusCalculator = healthStatusCalculator;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (monitoredSystemRepository.count() > 0) {
            LOGGER.info("Skipped demo business data because monitored systems already exist");
            return;
        }

        Instant now = Instant.now();
        MonitoredSystem customerApi = new MonitoredSystem(
                "Customer API",
                "SERVICE",
                "customer-api.internal.example",
                HealthStatus.HEALTHY,
                "Customer-facing REST API");
        MonitoredSystem orderDatabase = new MonitoredSystem(
                "Order Database",
                "SERVER",
                "orders-db.internal.example",
                HealthStatus.HEALTHY,
                "Primary database for order processing");
        MonitoredSystem legacyCrm = new MonitoredSystem(
                "Legacy CRM",
                "SERVICE",
                "legacy-crm.internal.example",
                HealthStatus.HEALTHY,
                "Legacy customer relationship management service");

        monitoredSystemRepository.saveAll(List.of(customerApi, orderDatabase, legacyCrm));

        List<Metric> customerMetrics = metrics(
                customerApi,
                now,
                List.of("38.00", "42.00", "45.00", "47.00", "44.00"),
                List.of("52.00", "53.00", "55.00", "56.00", "54.00"),
                List.of(120L, 135L, 150L, 140L, 130L),
                List.of(true, true, true, true, true));
        List<Metric> databaseMetrics = metrics(
                orderDatabase,
                now,
                List.of("68.00", "72.00", "76.00", "81.00", "82.00"),
                List.of("66.00", "68.00", "72.00", "77.00", "79.00"),
                List.of(310L, 360L, 420L, 540L, 610L),
                List.of(true, true, true, true, true));
        List<Metric> crmMetrics = metrics(
                legacyCrm,
                now,
                List.of("55.00", "58.00", "60.00", "62.00", "0.00"),
                List.of("70.00", "72.00", "74.00", "75.00", "0.00"),
                List.of(320L, 350L, 400L, 450L, 0L),
                List.of(true, true, true, true, false));

        List<Metric> allMetrics = new ArrayList<>();
        allMetrics.addAll(customerMetrics);
        allMetrics.addAll(databaseMetrics);
        allMetrics.addAll(crmMetrics);
        metricRepository.saveAll(allMetrics);

        customerApi.changeStatus(healthStatusCalculator.calculate(customerMetrics.getLast()));
        orderDatabase.changeStatus(healthStatusCalculator.calculate(databaseMetrics.getLast()));
        legacyCrm.changeStatus(healthStatusCalculator.calculate(crmMetrics.getLast()));
        monitoredSystemRepository.saveAll(List.of(customerApi, orderDatabase, legacyCrm));

        alertRepository.saveAll(List.of(
                new Alert(
                        orderDatabase,
                        "HIGH_CPU",
                        AlertSeverity.WARNING,
                        "CPU usage exceeded the warning threshold",
                        AlertStatus.ACTIVE,
                        now.minus(2, ChronoUnit.MINUTES)),
                new Alert(
                        orderDatabase,
                        "SLOW_RESPONSE",
                        AlertSeverity.WARNING,
                        "Database response time exceeded the warning threshold",
                        AlertStatus.ACKNOWLEDGED,
                        now.minus(1, ChronoUnit.MINUTES)),
                new Alert(
                        legacyCrm,
                        "SERVICE_UNAVAILABLE",
                        AlertSeverity.CRITICAL,
                        "Legacy CRM is unavailable",
                        AlertStatus.ACTIVE,
                        now),
                new Alert(
                        customerApi,
                        "SLOW_RESPONSE",
                        AlertSeverity.WARNING,
                        "A previous response-time warning has been resolved",
                        AlertStatus.RESOLVED,
                        now.minus(3, ChronoUnit.HOURS))));

        LOGGER.info("Created demo business data: 3 systems, 15 metrics and 4 alerts");
    }

    private List<Metric> metrics(
            MonitoredSystem system,
            Instant now,
            List<String> cpuUsage,
            List<String> memoryUsage,
            List<Long> responseTimes,
            List<Boolean> availability) {
        List<Metric> metrics = new ArrayList<>();
        for (int index = 0; index < cpuUsage.size(); index++) {
            metrics.add(new Metric(
                    system,
                    new BigDecimal(cpuUsage.get(index)),
                    new BigDecimal(memoryUsage.get(index)),
                    responseTimes.get(index),
                    availability.get(index),
                    now.minus(cpuUsage.size() - 1L - index, ChronoUnit.MINUTES)));
        }
        return List.copyOf(metrics);
    }
}
