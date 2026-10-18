package au.edu.sydney.elec5619.dashboard.metric;
import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/admin/metrics-retention")
public class MetricRetentionController {
    private final MetricRetentionService service;
    public MetricRetentionController(MetricRetentionService service) { this.service = service; }
    @GetMapping("/preview") public ApiResponse<MetricRetentionService.Result> preview() {
        return ApiResponse.success(service.preview(), "Retention preview retrieved");
    }
    @PostMapping("/run") public ApiResponse<MetricRetentionService.Result> run() {
        return ApiResponse.success(service.runBatch(), "Retention batch archived successfully");
    }
}
