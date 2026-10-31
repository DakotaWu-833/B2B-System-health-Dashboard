package au.edu.sydney.elec5619.dashboard.config;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;
    private final au.edu.sydney.elec5619.dashboard.infrastructure.RateLimitInterceptor rateLimit;

    public WebConfig(
            @Value("${app.cors.allowed-origins:http://localhost:5173}") String allowedOrigins,
            au.edu.sydney.elec5619.dashboard.infrastructure.RateLimitInterceptor rateLimit) {
        this.rateLimit = rateLimit;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .toArray(String[]::new);
    }

    @Override
    public void addInterceptors(org.springframework.web.servlet.config.annotation.InterceptorRegistry registry) {
        registry.addInterceptor(rateLimit).addPathPatterns("/api/**");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("X-Request-ID", "Retry-After")
                .allowCredentials(true);
    }
}
