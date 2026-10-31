package au.edu.sydney.elec5619.dashboard.assistant;

import java.time.Duration;
import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("app.ai")
public record AiProperties(@DefaultValue("false") boolean enabled,
                           @DefaultValue("http://127.0.0.1:11434") URI baseUrl,
                           @DefaultValue("qwen3.5:9b-q4_K_M") String model,
                           @DefaultValue("") String embeddingModel,
                           @DefaultValue("PT30S") Duration timeout,
                           @DefaultValue("6") int maxToolCalls) {
    public AiProperties {
        if (maxToolCalls < 1 || maxToolCalls > 12 || timeout.isNegative() || timeout.isZero() || timeout.toSeconds() > 60)
            throw new IllegalArgumentException("AI budget must be 1-12 tool calls and 1-60 seconds per request");
        if (!java.util.Set.of("http", "https").contains(baseUrl.getScheme()) || baseUrl.getHost() == null)
            throw new IllegalArgumentException("AI base URL must be an HTTP service URL");
    }
}
