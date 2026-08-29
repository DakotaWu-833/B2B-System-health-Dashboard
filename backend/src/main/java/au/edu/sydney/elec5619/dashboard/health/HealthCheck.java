package au.edu.sydney.elec5619.dashboard.health;

import java.time.Instant;

public record HealthCheck(String service, String status, Instant timestamp) {
}
