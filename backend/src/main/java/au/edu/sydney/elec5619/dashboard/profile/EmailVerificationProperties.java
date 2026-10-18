package au.edu.sydney.elec5619.dashboard.profile;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
@ConfigurationProperties(prefix = "app.email")
public record EmailVerificationProperties(boolean enabled, String from, Duration ttl, Duration resendAfter, int maxAttempts) {
    public EmailVerificationProperties {
        if (ttl == null || ttl.isZero() || ttl.isNegative() || resendAfter == null || resendAfter.isNegative()
                || resendAfter.isZero() || maxAttempts < 1 || maxAttempts > 10)
            throw new IllegalArgumentException("Email verification requires positive durations and 1..10 attempts");
    }
}
