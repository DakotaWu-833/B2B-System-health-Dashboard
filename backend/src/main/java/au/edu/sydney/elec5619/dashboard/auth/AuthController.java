package au.edu.sydney.elec5619.dashboard.auth;

import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.CompositeLogoutHandler;
import org.springframework.security.web.authentication.logout.CookieClearingLogoutHandler;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final LogoutHandler logoutHandler;

    public AuthController(
            AuthenticationManager authenticationManager,
            SecurityContextRepository securityContextRepository) {
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
        this.logoutHandler = new CompositeLogoutHandler(
                new SecurityContextLogoutHandler(),
                new CookieClearingLogoutHandler("JSESSIONID"));
    }

    @GetMapping("/csrf")
    public ApiResponse<CsrfTokenResponse> csrf(CsrfToken csrfToken) {
        return ApiResponse.success(CsrfTokenResponse.from(csrfToken), "CSRF token issued");
    }

    @PostMapping("/login")
    public ApiResponse<AuthenticatedUserResponse> login(
            @Valid @RequestBody LoginRequest loginRequest,
            HttpServletRequest request,
            HttpServletResponse response) {
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(
                        loginRequest.username(), loginRequest.password()));

        HttpSession existingSession = request.getSession(false);
        if (existingSession != null) {
            existingSession.invalidate();
        }

        SecurityContext securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(authentication);
        SecurityContextHolder.setContext(securityContext);
        securityContextRepository.saveContext(securityContext, request, response);

        DashboardUserPrincipal principal = (DashboardUserPrincipal) authentication.getPrincipal();
        return ApiResponse.success(AuthenticatedUserResponse.from(principal), "Login successful");
    }

    @GetMapping("/me")
    public ApiResponse<AuthenticatedUserResponse> currentUser(Authentication authentication) {
        DashboardUserPrincipal principal = (DashboardUserPrincipal) authentication.getPrincipal();
        return ApiResponse.success(AuthenticatedUserResponse.from(principal), "Authenticated user retrieved");
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(
            Authentication authentication,
            HttpServletRequest request,
            HttpServletResponse response) {
        logoutHandler.logout(request, response, authentication);
        return ApiResponse.success(null, "Logout successful");
    }
}
