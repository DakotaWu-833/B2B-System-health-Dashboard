package au.edu.sydney.elec5619.dashboard.profile;
import java.time.Instant;
import au.edu.sydney.elec5619.dashboard.user.*;
public record ProfileResponse(Long id, String username, Role role, String email, boolean emailVerified, Instant emailVerifiedAt) {
    public static ProfileResponse from(User user) {
        return new ProfileResponse(user.getId(), user.getUsername(), user.getRole(), user.getEmail(), user.isEmailVerified(), user.getEmailVerifiedAt());
    }
}
