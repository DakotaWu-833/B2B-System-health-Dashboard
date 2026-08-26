package au.edu.sydney.elec5619.dashboard.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
class UserRepositoryTests {

    @Autowired
    private UserRepository userRepository;

    @Test
    void persistsAndFindsUserByUsername() {
        UserAccount savedUser = userRepository.saveAndFlush(
                new UserAccount("operations", "bcrypt-hash", Role.OPERATIONS));

        assertThat(savedUser.getId()).isNotNull();
        assertThat(userRepository.findByUsername("operations"))
                .hasValueSatisfying(user -> {
                    assertThat(user.getUsername()).isEqualTo("operations");
                    assertThat(user.getPasswordHash()).isEqualTo("bcrypt-hash");
                    assertThat(user.getRole()).isEqualTo(Role.OPERATIONS);
                });
    }

    @Test
    void rejectsDuplicateUsernames() {
        userRepository.saveAndFlush(
                new UserAccount("management", "first-hash", Role.MANAGEMENT));

        assertThatThrownBy(() -> userRepository.saveAndFlush(
                new UserAccount("management", "second-hash", Role.MANAGEMENT)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
