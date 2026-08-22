package au.edu.sydney.elec5619.dashboard.health;

import java.time.Instant;

import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public ApiResponse<HealthCheck> health() {
        HealthCheck healthCheck = new HealthCheck(
                "system-health-dashboard-backend",
                "UP",
                Instant.now());

        return ApiResponse.success(healthCheck, "Backend is running");
    }
}
