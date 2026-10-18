package au.edu.sydney.elec5619.dashboard.profile;
import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/profile")
public class ProfileController {
    private final ProfileService service;
    public ProfileController(ProfileService service) { this.service = service; }
    @GetMapping public ApiResponse<ProfileResponse> current(Authentication authentication) {
        return ApiResponse.success(service.current(authentication.getName()), "Profile retrieved successfully");
    }
    @PutMapping public ApiResponse<ProfileResponse> update(Authentication authentication, @Valid @RequestBody ProfileUpdateRequest request) {
        return ApiResponse.success(service.update(authentication.getName(), request.email()), "Profile updated successfully");
    }
    @PostMapping("/email-verification") public ApiResponse<ProfileService.SendResult> send(Authentication authentication) {
        return ApiResponse.success(service.send(authentication.getName()), "Verification email sent");
    }
    @PostMapping("/email-verification/confirm") public ApiResponse<ProfileResponse> confirm(Authentication authentication, @Valid @RequestBody VerificationConfirmRequest request) {
        return ApiResponse.success(service.confirm(authentication.getName(), request.code()), "Email verified successfully");
    }
}
