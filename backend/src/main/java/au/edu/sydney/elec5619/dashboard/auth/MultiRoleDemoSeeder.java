package au.edu.sydney.elec5619.dashboard.auth;
import au.edu.sydney.elec5619.dashboard.user.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
@Component
@ConditionalOnProperty(prefix = "app.demo-accounts", name = "enabled", havingValue = "true")
public class MultiRoleDemoSeeder implements ApplicationRunner {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final String operationsName, operationsPassword, managementName, managementPassword;
    public MultiRoleDemoSeeder(UserRepository users, PasswordEncoder encoder,
            @Value("${app.demo-accounts.operations-username}") String operationsName,
            @Value("${app.demo-accounts.operations-password}") String operationsPassword,
            @Value("${app.demo-accounts.management-username}") String managementName,
            @Value("${app.demo-accounts.management-password}") String managementPassword) {
        this.users = users; this.encoder = encoder; this.operationsName = operationsName; this.operationsPassword = operationsPassword;
        this.managementName = managementName; this.managementPassword = managementPassword;
    }
    @Override @Transactional public void run(ApplicationArguments args) {
        if (operationsName == null || managementName == null || operationsName.isBlank() || managementName.isBlank()
                || operationsName.equals(managementName) || operationsName.length() > 100 || managementName.length() > 100
                || invalidPassword(operationsPassword) || invalidPassword(managementPassword))
            throw new IllegalStateException("Configure two distinct demo usernames and nonblank passwords (at most 72 UTF-8 bytes)");
        seed(operationsName, operationsPassword, Role.OPERATIONS);
        seed(managementName, managementPassword, Role.MANAGEMENT);
    }
    private boolean invalidPassword(String value) {
        return value == null || value.isBlank() || value.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72;
    }
    private void seed(String username, String password, Role role) {
        users.findByUsername(username).ifPresentOrElse(existing -> {
            if (existing.getRole() != role)
                throw new IllegalStateException("Existing demo username has a different role; choose another username");
        }, () -> users.save(new User(username, encoder.encode(password), role)));
    }
}
