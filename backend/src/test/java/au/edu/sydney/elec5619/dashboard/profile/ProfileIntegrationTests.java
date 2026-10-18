package au.edu.sydney.elec5619.dashboard.profile;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.concurrent.atomic.AtomicReference;
import au.edu.sydney.elec5619.dashboard.common.ApiProblemException;
import au.edu.sydney.elec5619.dashboard.user.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProfileIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired EmailVerificationRepository verifications;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean VerificationMailSender mail;
    final AtomicReference<String> deliveredCode = new AtomicReference<>();
    @BeforeEach void setup() {
        verifications.deleteAll(); users.deleteAll(); reset(mail); deliveredCode.set(null);
        users.saveAndFlush(new User("profile.ops", "test-hash", Role.OPERATIONS));
        users.saveAndFlush(new User("profile.manager", "test-hash", Role.MANAGEMENT));
        doAnswer(invocation -> { deliveredCode.set(invocation.getArgument(1)); return null; }).when(mail).send(anyString(), anyString());
    }
    ResultActions updateEmail(String owner, String email) throws Exception {
        return mvc.perform(put("/api/profile").with(user(owner).roles(owner.endsWith("manager") ? "MANAGEMENT" : "OPERATIONS"))
                .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(java.util.Map.of("email", email))));
    }
    ResultActions send(String owner) throws Exception {
        return mvc.perform(post("/api/profile/email-verification").with(user(owner).roles("OPERATIONS")).with(csrf()));
    }
    ResultActions confirm(String owner, String code) throws Exception {
        return mvc.perform(post("/api/profile/email-verification/confirm").with(user(owner).roles("OPERATIONS"))
                .with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(java.util.Map.of("code", code))));
    }
    @Test void oldAccountsHaveNoVerifiedEmailAndSensitiveFieldsAreAbsent() throws Exception {
        mvc.perform(get("/api/profile").with(user("profile.ops").roles("OPERATIONS"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").isEmpty()).andExpect(jsonPath("$.data.emailVerified").value(false))
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist()).andExpect(jsonPath("$.data.codeHash").doesNotExist());
    }
    @Test void bothRolesCanUpdateOnlyTheirOwnNormalizedEmail() throws Exception {
        updateEmail("profile.manager", " Manager@Example.TEST ").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("manager@example.test"));
        assertThat(users.findByUsername("profile.ops").orElseThrow().getEmail()).isNull();
        mvc.perform(put("/api/profile").with(user("profile.ops").roles("OPERATIONS")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"ops@example.test\",\"role\":\"MANAGEMENT\",\"emailVerified\":true,\"userId\":999}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.role").value("OPERATIONS"))
                .andExpect(jsonPath("$.data.emailVerified").value(false));
    }
    @Test void duplicateEmailReturnsConflictAndPreservesBothAccounts() throws Exception {
        updateEmail("profile.ops", "owner@example.test").andExpect(status().isOk());
        updateEmail("profile.manager", "OWNER@example.test").andExpect(status().isConflict());
        assertThat(users.findByUsername("profile.manager").orElseThrow().getEmail()).isNull();
    }
    @Test void invalidEmailIsRejectedWithoutMutation() throws Exception {
        updateEmail("profile.ops", "not-an-email").andExpect(status().isBadRequest());
        assertThat(users.findByUsername("profile.ops").orElseThrow().getEmail()).isNull();
    }
    @Test void anonymousAndCrossUserPathsCannotAccessAProfile() throws Exception {
        mvc.perform(get("/api/profile")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/profile/999").with(user("profile.ops").roles("OPERATIONS"))).andExpect(status().isNotFound());
    }
    @Test void allProfileMutationsRequireCsrf() throws Exception {
        for (String path : new String[]{"/api/profile/email-verification", "/api/profile/email-verification/confirm"}) {
            mvc.perform(post(path).with(user("profile.ops").roles("OPERATIONS")).contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"123456\"}"))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(put("/api/profile").with(user("profile.ops").roles("OPERATIONS"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"ops@example.test\"}"))
                .andExpect(status().isForbidden());
        assertThat(verifications.count()).isZero();
    }
    @Test void successfulVerificationIsPersistedSingleUseAndStoresOnlyHash() throws Exception {
        updateEmail("profile.ops", "verified@example.test").andExpect(status().isOk());
        send("profile.ops").andExpect(status().isOk()).andExpect(jsonPath("$.data.code").doesNotExist());
        String code = deliveredCode.get();
        var challenge = verifications.findById(users.findByUsername("profile.ops").orElseThrow().getId()).orElseThrow();
        assertThat(challenge.getCodeHash()).startsWith("$2").doesNotContain(code);
        confirm("profile.ops", code).andExpect(status().isOk()).andExpect(jsonPath("$.data.emailVerified").value(true));
        mvc.perform(get("/api/profile").with(user("profile.ops").roles("OPERATIONS"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.emailVerified").value(true)).andExpect(jsonPath("$.data.emailVerifiedAt").isNotEmpty());
        confirm("profile.ops", code).andExpect(status().isConflict());
        send("profile.ops").andExpect(status().isConflict());
    }
    @Test void wrongAttemptsPersistAndLockOutCorrectCodeAfterTheLimit() throws Exception {
        updateEmail("profile.ops", "attempts@example.test"); send("profile.ops");
        String wrong = "000000".equals(deliveredCode.get()) ? "111111" : "000000";
        for (int i = 0; i < 4; i++) confirm("profile.ops", wrong).andExpect(status().isBadRequest());
        confirm("profile.ops", wrong).andExpect(status().isTooManyRequests());
        confirm("profile.ops", deliveredCode.get()).andExpect(status().isTooManyRequests());
        assertThat(users.findByUsername("profile.ops").orElseThrow().isEmailVerified()).isFalse();
        assertThat(verifications.findAll().getFirst().getAttempts()).isEqualTo(5);
    }
    @Test void expiredCodeIsRejected() throws Exception {
        updateEmail("profile.ops", "expiry@example.test"); send("profile.ops");
        jdbc.update("UPDATE email_verifications SET expires_at = ?", Timestamp.from(Instant.now().minusSeconds(1)));
        confirm("profile.ops", deliveredCode.get()).andExpect(status().isGone());
    }
    @Test void changingEmailInvalidatesOldCodeAndClearsVerifiedStatus() throws Exception {
        updateEmail("profile.ops", "before@example.test"); send("profile.ops"); String old = deliveredCode.get();
        confirm("profile.ops", old).andExpect(status().isOk());
        updateEmail("profile.ops", "after@example.test").andExpect(status().isOk()).andExpect(jsonPath("$.data.emailVerified").value(false));
        confirm("profile.ops", old).andExpect(status().isBadRequest());
        assertThat(verifications.findAll().getFirst().getConsumedAt()).isNotNull();
    }
    @Test void noOpEmailUpdatePreservesVerification() throws Exception {
        updateEmail("profile.ops", "same@example.test"); send("profile.ops"); confirm("profile.ops", deliveredCode.get());
        updateEmail("profile.ops", "SAME@example.test").andExpect(status().isOk()).andExpect(jsonPath("$.data.emailVerified").value(true));
    }
    @Test void anotherUserCannotUseAnOwnersCode() throws Exception {
        updateEmail("profile.ops", "owner@example.test"); updateEmail("profile.manager", "other@example.test");
        send("profile.ops"); confirm("profile.manager", deliveredCode.get()).andExpect(status().isBadRequest());
    }
    @Test void resendIsThrottledAndDeliveryFailureRollsBackChallenge() throws Exception {
        updateEmail("profile.ops", "resend@example.test"); send("profile.ops").andExpect(status().isOk());
        send("profile.ops").andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
        updateEmail("profile.manager", "failure@example.test");
        doThrow(new ApiProblemException(HttpStatus.SERVICE_UNAVAILABLE, "Mail unavailable")).when(mail).send(eq("failure@example.test"), anyString());
        send("profile.manager").andExpect(status().isServiceUnavailable());
        assertThat(verifications.count()).isEqualTo(1);
        assertThat(users.findByUsername("profile.manager").orElseThrow().isEmailVerified()).isFalse();
    }
    @Test void changingEmailDoesNotBypassTheSendCooldown() throws Exception {
        updateEmail("profile.ops", "first@example.test"); send("profile.ops").andExpect(status().isOk());
        updateEmail("profile.ops", "second@example.test");
        send("profile.ops").andExpect(status().isTooManyRequests());
        verify(mail, times(1)).send(anyString(), anyString());
    }
    @Test void missingEmailAndMalformedCodesAreRejected() throws Exception {
        send("profile.ops").andExpect(status().isBadRequest());
        confirm("profile.ops", "12abc").andExpect(status().isBadRequest());
    }
}
