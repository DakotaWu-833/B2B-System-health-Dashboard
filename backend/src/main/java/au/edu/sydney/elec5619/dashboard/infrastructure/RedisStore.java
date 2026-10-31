package au.edu.sydney.elec5619.dashboard.infrastructure;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/** Cache failures are optional; callers of the security counter must handle failure explicitly. */
@Component
public class RedisStore {
    private static final DefaultRedisScript<Long> WINDOW = new DefaultRedisScript<>("""
            local n = redis.call('INCR', KEYS[1])
            if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
            return n
            """, Long.class);
    private final StringRedisTemplate redis;
    private final RedisProperties properties;

    public RedisStore(StringRedisTemplate redis, RedisProperties properties) {
        this.redis = redis;
        this.properties = properties;
    }
    public boolean enabled() { return properties.enabled(); }
    public Optional<String> get(String key) {
        if (!enabled()) return Optional.empty();
        try { return Optional.ofNullable(redis.opsForValue().get(properties.namespace() + key)); }
        catch (RuntimeException unavailable) { return Optional.empty(); }
    }
    public void put(String key, String value, Duration ttl) {
        if (!enabled()) return;
        try { redis.opsForValue().set(properties.namespace() + key, value, ttl); }
        catch (RuntimeException unavailable) { /* Retrieval still works without its cache. */ }
    }
    public long incrementWindow(String key, long seconds) {
        Long result = redis.execute(WINDOW, List.of(properties.namespace() + key), String.valueOf(seconds));
        if (result == null) throw new IllegalStateException("Redis counter unavailable");
        return result;
    }
}
