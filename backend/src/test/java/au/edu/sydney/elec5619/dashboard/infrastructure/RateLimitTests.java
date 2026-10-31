package au.edu.sydney.elec5619.dashboard.infrastructure;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import au.edu.sydney.elec5619.dashboard.common.ApiProblemException;

class RateLimitTests {
    @Test void loginIsLimitedAndDoesNotTrustForwardedAddresses() {
        RedisStore redis = mock(RedisStore.class);
        var limiter = new RateLimitInterceptor(redis, 20, 1);
        var request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr("127.0.0.2");
        assertThat(limiter.preHandle(request, new MockHttpServletResponse(), null)).isTrue();
        request.addHeader("X-Forwarded-For", "untrusted-new-address");
        request.setRequestURI("/api/auth/%6cogin");
        request.setAttribute(org.springframework.web.servlet.HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/auth/login");
        assertThatThrownBy(() -> limiter.preHandle(request, new MockHttpServletResponse(), null))
                .isInstanceOfSatisfying(ApiProblemException.class, e -> { assertThat(e.status().value()).isEqualTo(429); assertThat(e.retryAfter()).isPositive(); });
    }
    @Test void twoInstancesShareTheRedisCounterAndFailureDoesNotBypassLimit() {
        RedisStore redis = mock(RedisStore.class); when(redis.enabled()).thenReturn(true);
        AtomicLong count = new AtomicLong(); when(redis.incrementWindow(anyString(), anyLong())).thenAnswer(i -> count.incrementAndGet());
        var first = new RateLimitInterceptor(redis, 1, 10); var second = new RateLimitInterceptor(redis, 1, 10);
        var request = new MockHttpServletRequest("POST", "/api/assistant/ask"); request.setUserPrincipal(() -> "same-user");
        first.preHandle(request, new MockHttpServletResponse(), null);
        assertThatThrownBy(() -> second.preHandle(request, new MockHttpServletResponse(), null)).hasMessageContaining("Too many");
        when(redis.incrementWindow(anyString(), anyLong())).thenThrow(new IllegalStateException());
        assertThatThrownBy(() -> second.preHandle(request, new MockHttpServletResponse(), null))
                .isInstanceOfSatisfying(ApiProblemException.class, e -> assertThat(e.status().value()).isEqualTo(503));
    }
}
