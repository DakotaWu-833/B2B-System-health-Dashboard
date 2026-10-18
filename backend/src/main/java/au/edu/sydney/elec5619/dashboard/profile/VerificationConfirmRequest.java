package au.edu.sydney.elec5619.dashboard.profile;
import jakarta.validation.constraints.*;
public record VerificationConfirmRequest(@NotBlank @Pattern(regexp = "[0-9]{6}") String code) {}
