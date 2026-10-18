package au.edu.sydney.elec5619.dashboard.system;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import au.edu.sydney.elec5619.dashboard.metric.*;
import au.edu.sydney.elec5619.dashboard.alert.AlertRepository;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class PagingAndHistoryIntegrationTests {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json;
    @Autowired MonitoredSystemRepository systems; @Autowired MetricRepository metrics; @Autowired AlertRepository alerts;
    @BeforeEach void clear() { alerts.deleteAll(); metrics.deleteAll(); systems.deleteAll(); }
    MonitoredSystem system(String name) { return systems.saveAndFlush(new MonitoredSystem(name, "SERVICE", name + ".test", HealthStatus.HEALTHY, null)); }
    Metric metric(MonitoredSystem system, Instant time) { return metrics.saveAndFlush(new Metric(system, BigDecimal.TEN, BigDecimal.TEN, 10L, true, time)); }
    JsonNode read(String path) throws Exception {
        var result = mvc.perform(get(path).with(user("reader").roles("MANAGEMENT"))).andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("data");
    }
    @Test void systemPagesAreBoundedAndContainOnlyTheirOwnLatestReadings() throws Exception {
        for (int i=0; i<12; i++) metric(system("page-"+i), Instant.now());
        JsonNode page = read("/api/systems/page?page=1&size=5");
        assertThat(page.get("items").size()).isEqualTo(5);
        assertThat(page.get("totalElements").asInt()).isEqualTo(12);
        assertThat(page.get("first").asBoolean()).isFalse();
        for (JsonNode item : page.get("items")) assertThat(item.get("latestMetric").get("metricId").asLong()).isPositive();
        assertThat(read("/api/systems/page?page=2&size=5").get("items").size()).isEqualTo(2);
    }
    @Test void stableCursorCanReadBeyondOneHundredWithoutDuplicatesDuringNewInserts() throws Exception {
        // DATETIME(6) stores microseconds; keep the managed fixture and persisted cursor keys identical.
        var system = system("history"); Instant same = Instant.now().minusSeconds(600).truncatedTo(ChronoUnit.MICROS);
        Set<Long> expected = new HashSet<>();
        for (int i=0;i<125;i++) expected.add(metric(system, same).getId());
        JsonNode page = read("/api/systems/"+system.getId()+"/metrics/history?size=20");
        metric(system, Instant.now()); // Outside the first page's snapshot upper bound.
        Set<Long> received = new HashSet<>(); long previous = Long.MAX_VALUE;
        for (;;) {
            assertThat(page.get("items").size()).isLessThanOrEqualTo(20);
            for (JsonNode item : page.get("items")) {
                long id=item.get("metricId").asLong(); assertThat(id).isLessThan(previous); previous=id;
                assertThat(received.add(id)).isTrue();
            }
            if (!page.get("hasMore").asBoolean()) break;
            page=read("/api/systems/"+system.getId()+"/metrics/history?size=20&cursor="+page.get("nextCursor").asText());
        }
        assertThat(received).isEqualTo(expected);
    }
    @Test void invalidPagingAndRangesReturnBadRequest() throws Exception {
        var id=system("invalid").getId();
        for (String path : List.of("/api/systems/page?page=-1", "/api/systems/page?size=101", "/api/systems/page?page=1000001",
                "/api/systems/"+id+"/metrics/history?cursor=broken", "/api/systems/"+id+"/metrics/history?size=0",
                "/api/systems/"+id+"/metrics/history?from=2026-01-01T00:00:00Z&to=2026-04-01T00:00:00Z",
                "/api/systems/"+id+"/metrics/history?from=invalid"))
            mvc.perform(get(path).with(user("reader").roles("MANAGEMENT"))).andExpect(status().isBadRequest());
    }
    @Test void legacyListHasAnExplicitUpperBoundAndNewPagesRemainAvailable() throws Exception {
        for (int i=0; i<501; i++) system("legacy-"+i);
        mvc.perform(get("/api/systems").with(user("reader").roles("MANAGEMENT"))).andExpect(status().isBadRequest());
        assertThat(read("/api/systems/page?size=100").get("items").size()).isEqualTo(100);
    }
    @Test void unknownHistorySystemRetains404() throws Exception {
        mvc.perform(get("/api/systems/9999999/metrics/history").with(user("reader").roles("OPERATIONS"))).andExpect(status().isNotFound());
    }
}
