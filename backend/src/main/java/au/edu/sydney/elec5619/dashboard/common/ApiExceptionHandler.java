package au.edu.sydney.elec5619.dashboard.common;

import java.util.stream.Collectors;

import au.edu.sydney.elec5619.dashboard.alert.AlertNotFoundException;
import au.edu.sydney.elec5619.dashboard.alert.InvalidAlertStatusTransitionException;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(AlertNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleAlertNotFound(
            AlertNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.failure(exception.getMessage()));
    }

    @ExceptionHandler(InvalidAlertStatusTransitionException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidAlertStatusTransition(
            InvalidAlertStatusTransitionException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.failure(exception.getMessage()));
    }

    @ExceptionHandler(MonitoredSystemNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleMonitoredSystemNotFound(
            MonitoredSystemNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.failure(exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationFailure(
            MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .distinct()
                .sorted()
                .collect(Collectors.joining("; "));

        return ResponseEntity.badRequest().body(ApiResponse.failure(message));
    }
}
