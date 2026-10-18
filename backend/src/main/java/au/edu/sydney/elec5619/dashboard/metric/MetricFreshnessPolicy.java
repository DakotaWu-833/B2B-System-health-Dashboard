package au.edu.sydney.elec5619.dashboard.metric;

import java.time.Duration;
import java.time.Instant;

import au.edu.sydney.elec5619.dashboard.system.MetricDataStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class MetricFreshnessPolicy {

    private final Duration staleAfter;

    public MetricFreshnessPolicy(@Value("${app.metrics.stale-after:PT5M}") Duration staleAfter) {
        this.staleAfter = staleAfter;
    }

    public MetricDataStatus dataStatus(Metric metric, Instant evaluatedAt) {
        if (metric == null) {
            return MetricDataStatus.NO_DATA;
        }
        return metric.getRecordedAt().isBefore(evaluatedAt.minus(staleAfter))
                ? MetricDataStatus.STALE
                : MetricDataStatus.FRESH;
    }
}
