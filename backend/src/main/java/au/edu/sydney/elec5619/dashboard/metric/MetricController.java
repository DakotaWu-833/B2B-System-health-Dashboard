package au.edu.sydney.elec5619.dashboard.metric;

import java.util.List;

import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/systems/{systemId}/metrics")
public class MetricController {

    private final MetricService metricService;
    private final MetricQueryService metricQueryService;

    public MetricController(MetricService metricService, MetricQueryService metricQueryService) {
        this.metricService = metricService;
        this.metricQueryService = metricQueryService;
    }

    @GetMapping
    public ApiResponse<List<MetricReadingResponse>> recentMetrics(
            @PathVariable Long systemId) {
        return ApiResponse.success(
                metricQueryService.getRecentMetrics(systemId),
                "Recent metrics retrieved successfully");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<MetricResponse> submitMetric(
            @PathVariable Long systemId,
            @Valid @RequestBody MetricSubmissionRequest request) {
        MetricResponse response = metricService.submitMetric(systemId, request);
        return ApiResponse.success(response, "Metric submitted successfully");
    }
}
