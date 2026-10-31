package au.edu.sydney.elec5619.dashboard.infrastructure;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("app.redis")
public record RedisProperties(@DefaultValue("false") boolean enabled,
                              @DefaultValue("dashboard:v1:") String namespace) {}
