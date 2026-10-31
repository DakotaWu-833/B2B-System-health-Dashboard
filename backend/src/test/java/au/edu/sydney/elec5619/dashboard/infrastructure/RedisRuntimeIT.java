package au.edu.sydney.elec5619.dashboard.infrastructure;

import static org.assertj.core.api.Assertions.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

@EnabledIfSystemProperty(named = "redis.it", matches = "true")
class RedisRuntimeIT {
    @Test void realRedisProvidesSharedAtomicCountersCacheTtlAndNamespaceIsolation() throws Exception {
        var connection = new LettuceConnectionFactory("127.0.0.1", Integer.getInteger("redis.port", 6386));
        connection.afterPropertiesSet(); connection.start();
        var template = new StringRedisTemplate(connection); template.afterPropertiesSet();
        String prefix = "dashboard-test:" + UUID.randomUUID() + ":";
        try {
            var first = new RedisStore(template, new RedisProperties(true, prefix));
            var second = new RedisStore(template, new RedisProperties(true, prefix));
            first.put("embedding:version-a", "[0.2,0.4]", Duration.ofSeconds(30));
            assertThat(second.get("embedding:version-a")).contains("[0.2,0.4]");
            assertThat(template.getExpire(prefix + "embedding:version-a")).isBetween(1L, 30L);
            Set<Long> counters = ConcurrentHashMap.newKeySet();
            try (var workers = Executors.newFixedThreadPool(8)) {
                List<Callable<Void>> jobs = new ArrayList<>();
                for (int i = 0; i < 60; i++) { final int n = i; jobs.add(() -> { counters.add((n % 2 == 0 ? first : second).incrementWindow("rate:shared", 65)); return null; }); }
                for (Future<Void> job : workers.invokeAll(jobs)) job.get();
            }
            assertThat(counters).hasSize(60).contains(1L, 60L);
            assertThat(template.getExpire(prefix + "rate:shared")).isBetween(1L, 65L);
            assertThat(new RedisStore(template, new RedisProperties(true, prefix + "other:")).get("embedding:version-a")).isEmpty();
        } finally {
            template.delete(List.of(prefix + "embedding:version-a", prefix + "rate:shared"));
            connection.destroy();
        }
    }
}
