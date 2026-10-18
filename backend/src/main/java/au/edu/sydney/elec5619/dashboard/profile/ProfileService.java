package au.edu.sydney.elec5619.dashboard.profile;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.Duration;
import java.util.Locale;
import au.edu.sydney.elec5619.dashboard.common.*;
import au.edu.sydney.elec5619.dashboard.user.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {
    private final UserRepository users;
    private final EmailVerificationRepository verifications;
    private final VerificationMailSender mail;
    private final PasswordEncoder encoder;
    private final EmailVerificationProperties properties;
    private final RetryingTransaction transaction;
    private final SecureRandom random = new SecureRandom();
    public ProfileService(UserRepository users, EmailVerificationRepository verifications, VerificationMailSender mail,
                          PasswordEncoder encoder, EmailVerificationProperties properties, RetryingTransaction transaction) {
        this.users = users; this.verifications = verifications; this.mail = mail;
        this.encoder = encoder; this.properties = properties; this.transaction = transaction;
    }
    @Transactional(readOnly = true)
    public ProfileResponse current(String username) {
        return ProfileResponse.from(users.findByUsername(username).orElseThrow(this::notAuthenticated));
    }
    public ProfileResponse update(String username, String email) {
        try {
            return transaction.execute(() -> {
                User user = lockedUser(username);
                String normalized = email.trim().toLowerCase(Locale.ROOT);
                if (normalized.equals(user.getEmail())) return ProfileResponse.from(user);
                if (users.existsByEmailAndIdNot(normalized, user.getId())) throw duplicateEmail();
                verifications.findById(user.getId()).ifPresent(challenge -> challenge.consume(Instant.now()));
                user.changeEmail(normalized);
                users.saveAndFlush(user);
                return ProfileResponse.from(user);
            });
        } catch (DataIntegrityViolationException failure) { throw duplicateEmail(); }
    }
    public record SendResult(Instant expiresAt, Instant resendAt) {}
    public SendResult send(String username) {
        return transaction.execute(() -> {
            User user = lockedUser(username);
            if (user.getEmail() == null) throw new ApiProblemException(HttpStatus.BAD_REQUEST, "Add an email address first");
            if (user.isEmailVerified()) throw new ApiProblemException(HttpStatus.CONFLICT, "This email address is already verified");
            Instant now = Instant.now();
            EmailVerification challenge = verifications.findById(user.getId()).orElseGet(() -> new EmailVerification(user));
            if (challenge.getSentAt() != null && now.isBefore(challenge.getSentAt().plus(properties.resendAfter()))) {
                long seconds = Math.max(1, Duration.between(now, challenge.getSentAt().plus(properties.resendAfter())).toSeconds() + 1);
                throw new ApiProblemException(HttpStatus.TOO_MANY_REQUESTS, "Please wait before requesting another code", seconds);
            }
            String code = String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
            challenge.renew(user.getEmail(), encoder.encode(code), now, now.plus(properties.ttl()));
            verifications.saveAndFlush(challenge);
            // A delivery failure rolls back the challenge and never marks the address verified.
            mail.send(user.getEmail(), code);
            return new SendResult(challenge.getExpiresAt(), now.plus(properties.resendAfter()));
        });
    }
    private record Outcome(ProfileResponse profile, ApiProblemException failure) {}
    public ProfileResponse confirm(String username, String code) {
        Outcome outcome = transaction.execute(() -> {
            User user = lockedUser(username);
            EmailVerification challenge = verifications.findById(user.getId()).orElse(null);
            Instant now = Instant.now();
            if (challenge == null || !challenge.getEmail().equals(user.getEmail()))
                return failure(HttpStatus.BAD_REQUEST, "Request a new verification code");
            if (challenge.getConsumedAt() != null) return failure(HttpStatus.CONFLICT, "This code has already been used");
            if (!now.isBefore(challenge.getExpiresAt())) return failure(HttpStatus.GONE, "This code has expired; request a new one");
            if (challenge.getAttempts() >= properties.maxAttempts()) return failure(HttpStatus.TOO_MANY_REQUESTS, "Too many incorrect attempts; request a new code");
            if (!encoder.matches(code, challenge.getCodeHash())) {
                challenge.failAttempt();
                verifications.saveAndFlush(challenge);
                return failure(challenge.getAttempts() >= properties.maxAttempts() ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_REQUEST,
                        "Incorrect verification code");
            }
            challenge.consume(now); user.verifyEmail(now);
            verifications.saveAndFlush(challenge); users.saveAndFlush(user);
            return new Outcome(ProfileResponse.from(user), null);
        });
        // Failed-attempt counters must commit even when the HTTP response is an error.
        if (outcome.failure() != null) throw outcome.failure();
        return outcome.profile();
    }
    private Outcome failure(HttpStatus status, String message) { return new Outcome(null, new ApiProblemException(status, message)); }
    private User lockedUser(String username) { return users.findByUsernameForUpdate(username).orElseThrow(this::notAuthenticated); }
    private ApiProblemException notAuthenticated() { return new ApiProblemException(HttpStatus.UNAUTHORIZED, "Authentication required"); }
    private ApiProblemException duplicateEmail() { return new ApiProblemException(HttpStatus.CONFLICT, "This email address is already in use"); }
}
