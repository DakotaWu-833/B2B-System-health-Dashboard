package au.edu.sydney.elec5619.dashboard.infrastructure;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import au.edu.sydney.elec5619.dashboard.common.ApiProblemException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {
    private record Window(long minute, long count) {}
    private final ConcurrentHashMap<String, Window> local = new ConcurrentHashMap<>();
    private final RedisStore redis;
    private final int aiLimit;
    private final int loginLimit;
    public RateLimitInterceptor(RedisStore redis, @Value("${app.rate-limit.ai-per-minute:20}") int aiLimit,
                                @Value("${app.rate-limit.login-per-minute:10}") int loginLimit) {
        this.redis = redis; this.aiLimit = aiLimit; this.loginLimit = loginLimit;
    }
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!"POST".equals(request.getMethod())) return true;
        Object matched = request.getAttribute(org.springframework.web.servlet.HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        String path = matched == null ? request.getRequestURI() : matched.toString();
        boolean login = path.equals("/api/auth/login");
        boolean ai = path.equals("/api/assistant/ask") || path.equals("/api/assistant/diagnose") || path.equals("/api/assistant/chat");
        if (!login && !ai) return true;
        String subject = login ? request.getRemoteAddr() : request.getUserPrincipal().getName();
        long epoch = Instant.now().getEpochSecond();
        long minute = epoch / 60;
        String key = (login ? "login:" : "ai:") + subject;
        long count;
        if (redis.enabled()) {
            try { count = redis.incrementWindow("rate:" + minute + ":" + key, 65); }
            catch (RuntimeException unavailable) {
                throw new ApiProblemException(HttpStatus.SERVICE_UNAVAILABLE, "Request limiter unavailable. Try again shortly.", 5);
            }
        } else {
            // Bounded development fallback. Production uses the shared Redis counter.
            local.entrySet().removeIf(entry -> entry.getValue().minute < minute);
            if (local.size() >= 10000 && !local.containsKey(key))
                throw new ApiProblemException(HttpStatus.SERVICE_UNAVAILABLE, "Request limiter is busy", 5);
            count = local.compute(key, (ignored, old) -> new Window(minute,
                    old == null || old.minute != minute ? 1 : old.count + 1)).count;
        }
        if (count > (login ? loginLimit : aiLimit))
            throw new ApiProblemException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Try again shortly.", 60 - epoch % 60);
        return true;
    }
}
