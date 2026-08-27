package au.edu.sydney.elec5619.dashboard.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import au.edu.sydney.elec5619.dashboard.user.Role;
import au.edu.sydney.elec5619.dashboard.user.User;
import au.edu.sydney.elec5619.dashboard.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class DemoUserSeederTests {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    void hashesPasswordBeforePersistingDemoUser() throws Exception {
        when(userRepository.existsByUsername("demo.operations")).thenReturn(false);
        when(passwordEncoder.encode("local-password")).thenReturn("bcrypt-hash");
        DemoUserSeeder seeder = new DemoUserSeeder(
                userRepository,
                passwordEncoder,
                "demo.operations",
                "local-password",
                "operations");

        seeder.run(new DefaultApplicationArguments(new String[0]));

        ArgumentCaptor<User> accountCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(accountCaptor.capture());
        assertThat(accountCaptor.getValue().getUsername()).isEqualTo("demo.operations");
        assertThat(accountCaptor.getValue().getPasswordHash()).isEqualTo("bcrypt-hash");
        assertThat(accountCaptor.getValue().getPasswordHash()).isNotEqualTo("local-password");
        assertThat(accountCaptor.getValue().getRole()).isEqualTo(Role.OPERATIONS);
    }

    @Test
    void doesNotOverwriteExistingUser() throws Exception {
        when(userRepository.existsByUsername("demo.operations")).thenReturn(true);
        DemoUserSeeder seeder = new DemoUserSeeder(
                userRepository,
                passwordEncoder,
                "demo.operations",
                "local-password",
                "OPERATIONS");

        seeder.run(new DefaultApplicationArguments(new String[0]));

        verify(passwordEncoder, never()).encode(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    void rejectsMissingSeedPassword() {
        DemoUserSeeder seeder = new DemoUserSeeder(
                userRepository,
                passwordEncoder,
                "demo.operations",
                "",
                "OPERATIONS");

        assertThatThrownBy(() -> seeder.run(new DefaultApplicationArguments(new String[0])))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("AUTH_SEED_USERNAME and AUTH_SEED_PASSWORD");
    }
}
