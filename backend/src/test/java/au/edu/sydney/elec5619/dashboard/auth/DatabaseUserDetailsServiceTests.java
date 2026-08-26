package au.edu.sydney.elec5619.dashboard.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.util.Optional;

import au.edu.sydney.elec5619.dashboard.user.Role;
import au.edu.sydney.elec5619.dashboard.user.User;
import au.edu.sydney.elec5619.dashboard.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

@ExtendWith(MockitoExtension.class)
class DatabaseUserDetailsServiceTests {

    @Mock
    private UserRepository userRepository;

    private DatabaseUserDetailsService userDetailsService;

    @BeforeEach
    void setUp() {
        userDetailsService = new DatabaseUserDetailsService(userRepository);
    }

    @Test
    void loadsPersistedUserWithRoleAuthority() {
        User user = new User(
                "operations", "$2a$10$encoded-password", Role.OPERATIONS);
        when(userRepository.findByUsername("operations")).thenReturn(Optional.of(user));

        DashboardUserPrincipal principal = (DashboardUserPrincipal) userDetailsService
                .loadUserByUsername("operations");

        assertThat(principal.getUsername()).isEqualTo("operations");
        assertThat(principal.getPassword()).isEqualTo("$2a$10$encoded-password");
        assertThat(principal.getRole()).isEqualTo(Role.OPERATIONS);
        assertThat(principal.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_OPERATIONS");
    }

    @Test
    void hidesWhetherUsernameExists() {
        when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("unknown"))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessage("Invalid username or password");
    }
}
