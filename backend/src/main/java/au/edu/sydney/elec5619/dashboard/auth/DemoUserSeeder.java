package au.edu.sydney.elec5619.dashboard.auth;

import java.util.Locale;

import au.edu.sydney.elec5619.dashboard.user.Role;
import au.edu.sydney.elec5619.dashboard.user.User;
import au.edu.sydney.elec5619.dashboard.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Component
@ConditionalOnProperty(prefix = "app.auth.seed", name = "enabled", havingValue = "true")
public class DemoUserSeeder implements ApplicationRunner {

    private static final Logger LOGGER = LoggerFactory.getLogger(DemoUserSeeder.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String username;
    private final String password;
    private final String roleName;

    public DemoUserSeeder(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.auth.seed.username:}") String username,
            @Value("${app.auth.seed.password:}") String password,
            @Value("${app.auth.seed.role:OPERATIONS}") String roleName) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.username = username;
        this.password = password;
        this.roleName = roleName;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        validateConfiguration();

        if (userRepository.existsByUsername(username)) {
            LOGGER.info("Demo authentication user '{}' already exists", username);
            return;
        }

        Role role = parseRole();
        userRepository.save(new User(username, passwordEncoder.encode(password), role));
        LOGGER.info("Created demo authentication user '{}' with role {}", username, role);
    }

    private void validateConfiguration() {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            throw new IllegalStateException(
                    "AUTH_SEED_USERNAME and AUTH_SEED_PASSWORD are required when demo-user seeding is enabled");
        }
    }

    private Role parseRole() {
        try {
            return Role.valueOf(roleName.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("AUTH_SEED_ROLE must be OPERATIONS or MANAGEMENT", exception);
        }
    }
}
