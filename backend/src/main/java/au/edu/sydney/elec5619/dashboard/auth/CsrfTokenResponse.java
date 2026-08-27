package au.edu.sydney.elec5619.dashboard.auth;

import org.springframework.security.web.csrf.CsrfToken;

public record CsrfTokenResponse(String token, String headerName, String parameterName) {

    public static CsrfTokenResponse from(CsrfToken csrfToken) {
        return new CsrfTokenResponse(
                csrfToken.getToken(),
                csrfToken.getHeaderName(),
                csrfToken.getParameterName());
    }
}
