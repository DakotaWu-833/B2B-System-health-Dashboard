package au.edu.sydney.elec5619.dashboard.profile;
import jakarta.validation.constraints.*;
public record ProfileUpdateRequest(
        @NotBlank @Email @Size(max = 254) @Pattern(regexp = "[\\x21-\\x7E]+", message = "must contain an ASCII email address") String email) {
    public ProfileUpdateRequest { if (email != null) email = email.trim().toLowerCase(java.util.Locale.ROOT); }
}
