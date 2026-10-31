package au.edu.sydney.elec5619.dashboard.infrastructure;

import java.io.IOException;
import java.util.UUID;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestTraceFilter extends OncePerRequestFilter {
    private static final Logger LOG = LoggerFactory.getLogger(RequestTraceFilter.class);
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String supplied = request.getHeader("X-Request-ID");
        String id = supplied != null && supplied.matches("[a-zA-Z0-9-]{8,64}")
                ? supplied : UUID.randomUUID().toString();
        response.setHeader("X-Request-ID", id);
        String path = request.getRequestURI();
        String servletPath = request.getServletPath().isEmpty() ? path : request.getServletPath();
        if (servletPath.startsWith("/api/assistant") || servletPath.startsWith("/api/knowledge")) {
            response.setHeader("Cache-Control", "private, no-store");
        }
        long start = System.nanoTime();
        try (MDC.MDCCloseable ignored = MDC.putCloseable("requestId", id)) {
            chain.doFilter(request, response);
        } finally {
            if (path.startsWith("/api/")) LOG.info("request={} method={} path={} status={} durationMs={}",
                    id, request.getMethod(), path, response.getStatus(), (System.nanoTime() - start) / 1_000_000);
        }
    }
}
