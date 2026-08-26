package au.edu.sydney.elec5619.dashboard.system;

import java.util.List;

import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/systems")
public class SystemController {

    private final SystemService systemService;

    public SystemController(SystemService systemService) {
        this.systemService = systemService;
    }

    @GetMapping
    public ApiResponse<List<SystemListItemResponse>> systems() {
        return ApiResponse.success(
                systemService.getSystems(),
                "Systems retrieved successfully");
    }

    @GetMapping("/{systemId}")
    public ApiResponse<SystemDetailResponse> system(@PathVariable Long systemId) {
        return ApiResponse.success(
                systemService.getSystem(systemId),
                "System details retrieved successfully");
    }
}
