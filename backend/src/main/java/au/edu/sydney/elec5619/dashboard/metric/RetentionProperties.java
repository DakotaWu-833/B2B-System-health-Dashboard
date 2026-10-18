package au.edu.sydney.elec5619.dashboard.metric;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
@ConfigurationProperties(prefix = "app.metrics.retention")
public record RetentionProperties(boolean enabled, Duration retainFor, int batchSize) {
    public RetentionProperties {
        if (retainFor == null || retainFor.isNegative() || retainFor.isZero() || batchSize < 1 || batchSize > 1000)
            throw new IllegalArgumentException("Metric retention needs a positive duration and batch size 1..1000");
    }
}
