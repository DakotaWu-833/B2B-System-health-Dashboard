package au.edu.sydney.elec5619.dashboard.auth;

public record AuthenticatedUserResponse(Long id, String username, Role role) {

    public static AuthenticatedUserResponse from(DashboardUserPrincipal principal) {
        return new AuthenticatedUserResponse(
                principal.getId(),
                principal.getUsername(),
                principal.getRole());
    }
}
