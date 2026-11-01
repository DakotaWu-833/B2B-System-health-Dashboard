package au.edu.sydney.elec5619.dashboard.assistant;

import java.nio.ByteBuffer;
import java.util.concurrent.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

/** Only the configured model endpoint is reachable; tools never accept arbitrary URLs or SQL. */
@Component
public class OllamaClient {
    private final AiProperties properties;
    private final AiRuntimeProperties runtime;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    public OllamaClient(AiProperties properties, AiRuntimeProperties runtime, ObjectMapper mapper) { this.properties = properties; this.runtime = runtime; this.mapper = mapper; }
    public JsonNode chat(List<Map<String, Object>> messages, List<Map<String, Object>> tools, boolean json, Duration budget) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", properties.model()); body.put("messages", messages); body.put("stream", false);
        body.put("think", false); body.put("keep_alive", runtime.keepAlive().toMillis() + "ms");
        body.put("options", Map.of("temperature", 0, "num_predict", 1200, "num_ctx", runtime.contextTokens(), "num_batch", runtime.batchSize()));
        if (!tools.isEmpty()) body.put("tools", tools);
        if (json) body.put("format", "json");
        JsonNode response = post("/api/chat", body, budget);
        if (!response.path("message").isObject()) throw new ModelUnavailableException();
        return response.get("message");
    }
    public List<double[]> embed(List<String> texts, Duration budget) {
        JsonNode vectors = post("/api/embed", Map.of("model", properties.embeddingModel(), "input", texts,
                "truncate", false, "keep_alive", runtime.embeddingKeepAlive().toMillis() + "ms",
                "options", Map.of("num_ctx", runtime.embeddingContextTokens(), "num_batch", runtime.batchSize())), budget).path("embeddings");
        if (!vectors.isArray() || vectors.size() != texts.size()) throw new ModelUnavailableException();
        List<double[]> result = new ArrayList<>();
        for (JsonNode vector : vectors) {
            if (!vector.isArray() || vector.size() < 1 || vector.size() > 8192) throw new ModelUnavailableException();
            double[] values = new double[vector.size()];
            for (int i = 0; i < values.length; i++) {
                values[i] = vector.get(i).asDouble(Double.NaN);
                if (!Double.isFinite(values[i])) throw new ModelUnavailableException();
            }
            result.add(values);
        }
        return result;
    }
    private JsonNode post(String path, Object body, Duration budget) {
        if (!properties.enabled()) throw new ModelUnavailableException();
        if (budget.isNegative() || budget.isZero()) throw new ModelTimeoutException();
        try {
            Duration timeout = budget.compareTo(properties.timeout()) < 0 ? budget : properties.timeout();
            HttpRequest request = HttpRequest.newBuilder(properties.baseUrl().resolve(path)).timeout(timeout)
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build();
            var pending = http.sendAsync(request, ignored -> new BoundedBody());
            try {
                HttpResponse<byte[]> response = pending.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
                if (response.statusCode() != 200) throw new ModelUnavailableException();
                return mapper.readTree(response.body());
            } finally { if (!pending.isDone()) pending.cancel(true); }
        } catch (TimeoutException timedOut) { throw new ModelTimeoutException(); }
        catch (ExecutionException failed) {
            if (failed.getCause() instanceof HttpTimeoutException) throw new ModelTimeoutException();
            throw new ModelUnavailableException();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt(); throw new ModelUnavailableException();
        } catch (Exception failed) { throw new ModelUnavailableException(); }
    }
    private static final class BoundedBody implements HttpResponse.BodySubscriber<byte[]> {
        private final HttpResponse.BodySubscriber<byte[]> delegate = HttpResponse.BodySubscribers.ofByteArray();
        private Flow.Subscription subscription;
        private long bytes;
        public CompletionStage<byte[]> getBody() { return delegate.getBody(); }
        public void onSubscribe(Flow.Subscription subscription) { this.subscription = subscription; delegate.onSubscribe(subscription); }
        public void onNext(List<ByteBuffer> buffers) {
            bytes += buffers.stream().mapToLong(ByteBuffer::remaining).sum();
            if (bytes > 1_048_576) { subscription.cancel(); delegate.onError(new ModelUnavailableException()); }
            else delegate.onNext(buffers);
        }
        public void onError(Throwable error) { delegate.onError(error); }
        public void onComplete() { delegate.onComplete(); }
    }
    public static class ModelUnavailableException extends RuntimeException {
        public ModelUnavailableException() { super("Model unavailable or response invalid"); }
    }
    public static class ModelTimeoutException extends ModelUnavailableException {}
}
