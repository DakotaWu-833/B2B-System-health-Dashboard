package au.edu.sydney.elec5619.dashboard.demo;
import java.math.BigDecimal;
import java.util.List;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import au.edu.sydney.elec5619.dashboard.metric.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component
public class DemoMetricFeeder {
    private final boolean enabled;
    private final MonitoredSystemRepository systems;
    private final MetricService metrics;
    public DemoMetricFeeder(@Value("${app.demo-data.live-enabled:false}") boolean enabled, MonitoredSystemRepository systems, MetricService metrics) {
        this.enabled = enabled; this.systems = systems; this.metrics = metrics;
    }
    @Scheduled(fixedDelayString = "${app.demo-data.interval-ms:30000}")
    public void submitFreshReadings() {
        if (!enabled) return;
        for (var system : systems.findByHostIn(List.of("customer-api.internal.example", "orders-db.internal.example", "legacy-crm.internal.example"))) {
            boolean database = system.getHost().equals("orders-db.internal.example") && system.getName().equals("Order Database");
            boolean customer = system.getHost().equals("customer-api.internal.example") && system.getName().equals("Customer API");
            boolean crm = system.getHost().equals("legacy-crm.internal.example") && system.getName().equals("Legacy CRM");
            if (!database && !customer && !crm) continue;
            metrics.submitMetric(system.getId(), new MetricSubmissionRequest(new BigDecimal(database ? "82.00" : "44.00"),
                    new BigDecimal(database ? "79.00" : "54.00"), database ? 610L : 130L, !crm));
        }
    }
}
