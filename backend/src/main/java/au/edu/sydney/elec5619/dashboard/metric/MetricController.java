package au.edu.sydney.elec5619.dashboard.metric;

import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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

    public MetricController(MetricService metricService) {
        this.metricService = metricService;
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
