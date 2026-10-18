package au.edu.sydney.elec5619.dashboard.common;

import org.springframework.http.HttpStatus;
public class ApiProblemException extends RuntimeException {
    private final HttpStatus status;
    private final long retryAfter;
    public ApiProblemException(HttpStatus status, String message) { this(status, message, 0); }
    public ApiProblemException(HttpStatus status, String message, long retryAfter) {
        super(message); this.status = status; this.retryAfter = retryAfter;
    }
    public HttpStatus status() { return status; }
    public long retryAfter() { return retryAfter; }
}
