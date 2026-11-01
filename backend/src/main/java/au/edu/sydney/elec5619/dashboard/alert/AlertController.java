package au.edu.sydney.elec5619.dashboard.alert;

import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import au.edu.sydney.elec5619.dashboard.common.PagedResponse;
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
    public ApiResponse<PagedResponse<AlertResponse>> alerts(
            @RequestParam(required = false) AlertStatus status,
            @RequestParam(required = false) Long systemId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "false") boolean archived) {
        return ApiResponse.success(
                alertService.getAlerts(status, systemId, page, size, archived),
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

    @PatchMapping("/{alertId}/archive")
    public ApiResponse<AlertResponse> archive(@PathVariable Long alertId) {
        return ApiResponse.success(alertService.archive(alertId), "Alert archived successfully");
    }

    @PatchMapping("/{alertId}/unarchive")
    public ApiResponse<AlertResponse> unarchive(@PathVariable Long alertId) {
        return ApiResponse.success(alertService.unarchive(alertId), "Alert restored successfully");
    }
}
