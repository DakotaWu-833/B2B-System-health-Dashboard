package au.edu.sydney.elec5619.dashboard.auth;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import au.edu.sydney.elec5619.dashboard.user.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class MultiRoleDemoSeederTests {
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired MockMvc mvc;
    MultiRoleDemoSeeder seeder() { return new MultiRoleDemoSeeder(users, encoder, "seed.ops", "temporary-test-ops", "seed.mgmt", "temporary-test-management"); }
    @BeforeEach void clear() { users.deleteAll(); }
    @Test void repeatedSeedingPreservesHashesAndBothRolesCanLogIn() throws Exception {
        seeder().run(new DefaultApplicationArguments());
        String originalHash = users.findByUsername("seed.ops").orElseThrow().getPasswordHash();
        seeder().run(new DefaultApplicationArguments());
        assertThat(users.count()).isEqualTo(2);
        assertThat(users.findByUsername("seed.ops").orElseThrow().getPasswordHash()).isEqualTo(originalHash);
        for (String[] account : new String[][]{{"seed.ops", "temporary-test-ops", "OPERATIONS"}, {"seed.mgmt", "temporary-test-management", "MANAGEMENT"}}) {
            mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + account[0] + "\",\"password\":\"" + account[1] + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.role").value(account[2]));
        }
    }
    @Test void conflictingExistingRoleFailsWithoutChangingAccount() {
        users.saveAndFlush(new User("seed.ops", "existing-hash", Role.MANAGEMENT));
        assertThatThrownBy(() -> seeder().run(new DefaultApplicationArguments())).isInstanceOf(IllegalStateException.class);
        assertThat(users.findByUsername("seed.ops").orElseThrow().getRole()).isEqualTo(Role.MANAGEMENT);
        assertThat(users.count()).isEqualTo(1);
    }
    @Test void missingPasswordsFailBeforeWritingAnyAccount() {
        var invalid = new MultiRoleDemoSeeder(users, encoder, "seed.ops", "", "seed.mgmt", "test-password");
        assertThatThrownBy(() -> invalid.run(new DefaultApplicationArguments())).isInstanceOf(IllegalStateException.class);
        assertThat(users.count()).isZero();
    }
}
