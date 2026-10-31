package au.edu.sydney.elec5619.dashboard.assistant;

import static org.assertj.core.api.Assertions.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

class OllamaClientTests {
    @Test void sendsNonStreamingBoundedChatAndValidatesEmbeddingShape() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        ObjectMapper mapper = new ObjectMapper();
        server.createContext("/api/chat", exchange -> {
            var body = mapper.readTree(exchange.getRequestBody());
            assertThat(body.path("stream").asBoolean(true)).isFalse();
            assertThat(body.path("tools").isArray()).isTrue();
            byte[] response = "{\"message\":{\"role\":\"assistant\",\"content\":\"ready\"}}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, response.length); exchange.getResponseBody().write(response); exchange.close();
        });
        server.createContext("/api/embed", exchange -> {
            byte[] response = "{\"embeddings\":[[0.5,0.7]]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, response.length); exchange.getResponseBody().write(response); exchange.close();
        });
        server.start();
        try {
            var client = client(server, mapper, true);
            assertThat(client.chat(List.of(Map.of("role", "user", "content", "hello")), List.of(Map.of("type", "function")), false, Duration.ofSeconds(2)).path("content").asText()).isEqualTo("ready");
            assertThat(client.embed(List.of("one"), Duration.ofSeconds(2))).hasSize(1);
            assertThatThrownBy(() -> client.embed(List.of("one", "two"), Duration.ofSeconds(2))).isInstanceOf(OllamaClient.ModelUnavailableException.class);
            assertThatThrownBy(() -> client(server, mapper, false).chat(List.of(), List.of(), false, Duration.ofSeconds(2))).isInstanceOf(OllamaClient.ModelUnavailableException.class);
        } finally { server.stop(0); }
    }
    @Test void totalTimeoutAlsoCoversAStalledResponseBody() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.setExecutor(java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor());
        server.createContext("/api/chat", exchange -> {
            exchange.sendResponseHeaders(200, 100);
            exchange.getResponseBody().write('{'); exchange.getResponseBody().flush();
            try { Thread.sleep(2000); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            exchange.close();
        });
        server.start();
        try {
            long start = System.nanoTime();
            assertThatThrownBy(() -> client(server, new ObjectMapper(), true).chat(List.of(), List.of(), false, Duration.ofMillis(150)))
                    .isInstanceOf(OllamaClient.ModelUnavailableException.class);
            assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(1));
        } finally { server.stop(0); }
    }
    private OllamaClient client(HttpServer server, ObjectMapper mapper, boolean enabled) {
        return new OllamaClient(new AiProperties(enabled, URI.create("http://127.0.0.1:" + server.getAddress().getPort()),
                "test", "embed", Duration.ofSeconds(2), 3), mapper);
    }
}
