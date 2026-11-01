package au.edu.sydney.elec5619.dashboard.auth;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PermissionMatrixIntegrationTests {
    @Autowired MockMvc mvc;

    @ParameterizedTest
    @ValueSource(strings = {"/api/dashboard/summary", "/api/systems", "/api/alerts", "/api/alerts?archived=true"})
    void managementCanReadSharedSummaries(String path) throws Exception {
        mvc.perform(get(path).with(user("manager").roles("MANAGEMENT")))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/dashboard/summary", "/api/systems", "/api/alerts", "/api/alerts?archived=true",
            "/api/systems/1", "/api/systems/1/metrics", "/api/auth/me"})
    void anonymousCannotReadProtectedData(String path) throws Exception {
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @CsvSource({"POST,/api/systems", "PUT,/api/systems/1", "POST,/api/systems/1/metrics",
            "PATCH,/api/alerts/1/acknowledge", "PATCH,/api/alerts/1/resolve",
            "PATCH,/api/alerts/1/archive", "PATCH,/api/alerts/1/unarchive"})
    void managementCannotMutateEvenWithValidCsrf(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path)
                        .with(user("manager").roles("MANAGEMENT")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @CsvSource({"POST,/api/systems", "PUT,/api/systems/1", "POST,/api/systems/1/metrics",
            "PATCH,/api/alerts/1/acknowledge", "PATCH,/api/alerts/1/resolve",
            "PATCH,/api/alerts/1/archive", "PATCH,/api/alerts/1/unarchive"})
    void anonymousMutationWithValidCsrfRequiresLogin(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
