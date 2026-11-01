package au.edu.sydney.elec5619.dashboard.assistant;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Model working buffers and idle residency, independent of the request deadline. */
@ConfigurationProperties("app.ai.runtime")
public record AiRuntimeProperties(
        @DefaultValue("8192") int contextTokens,
        @DefaultValue("256") int batchSize,
        @DefaultValue("4096") int embeddingContextTokens,
        @DefaultValue("PT1M") Duration keepAlive,
        @DefaultValue("PT15S") Duration embeddingKeepAlive) {
    public AiRuntimeProperties {
        if (contextTokens < 1024 || contextTokens > 32768
                || embeddingContextTokens < 512 || embeddingContextTokens > 8192
                || batchSize < 32 || batchSize > 2048 || batchSize > Math.min(contextTokens, embeddingContextTokens)) {
            throw new IllegalArgumentException("AI context or batch size is outside its supported memory budget");
        }
        if (keepAlive == null || embeddingKeepAlive == null || keepAlive.isNegative() || embeddingKeepAlive.isNegative()
                || keepAlive.compareTo(Duration.ofMinutes(10)) > 0 || embeddingKeepAlive.compareTo(Duration.ofMinutes(10)) > 0) {
            throw new IllegalArgumentException("AI idle residency must be between zero and ten minutes");
        }
    }
}
