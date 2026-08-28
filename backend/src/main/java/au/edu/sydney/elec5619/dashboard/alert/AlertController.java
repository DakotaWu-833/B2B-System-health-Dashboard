package au.edu.sydney.elec5619.dashboard.alert;

import java.util.List;

import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    public ApiResponse<List<AlertResponse>> alerts(
            @RequestParam(required = false) AlertStatus status,
            @RequestParam(required = false) Long systemId) {
        return ApiResponse.success(
                alertService.getAlerts(status, systemId),
                "Alerts retrieved successfully");
    }

    @PatchMapping("/{alertId}/acknowledge")
    public ApiResponse<AlertResponse> acknowledge(@PathVariable Long alertId) {
        return ApiResponse.success(
                alertService.acknowledge(alertId),
                "Alert acknowledged successfully");
    }

    @PatchMapping("/{alertId}/resolve")
    public ApiResponse<AlertResponse> resolve(@PathVariable Long alertId) {
        return ApiResponse.success(
                alertService.resolve(alertId),
                "Alert resolved successfully");
    }
}
