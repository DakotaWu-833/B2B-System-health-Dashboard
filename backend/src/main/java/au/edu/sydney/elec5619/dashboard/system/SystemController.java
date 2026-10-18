package au.edu.sydney.elec5619.dashboard.system;

import java.util.List;

import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    @GetMapping("/page")
    public ApiResponse<au.edu.sydney.elec5619.dashboard.common.PagedResponse<SystemListItemResponse>> systemsPage(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(systemService.getSystemsPage(page, size), "Systems retrieved successfully");
    }

    @GetMapping("/{systemId}")
    public ApiResponse<SystemDetailResponse> system(@PathVariable Long systemId) {
        return ApiResponse.success(
                systemService.getSystem(systemId),
                "System details retrieved successfully");
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SystemListItemResponse>> createSystem(
            @Valid @RequestBody SystemMutationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(
                systemService.createSystem(request),
                "System created successfully"));
    }

    @PutMapping("/{systemId}")
    public ApiResponse<SystemListItemResponse> updateSystem(
            @PathVariable Long systemId,
            @Valid @RequestBody SystemMutationRequest request) {
        return ApiResponse.success(
                systemService.updateSystem(systemId, request),
                "System updated successfully");
    }
}
