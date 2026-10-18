package au.edu.sydney.elec5619.dashboard.metric;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.math.BigDecimal;
import java.time.*;
import au.edu.sydney.elec5619.dashboard.system.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:retention-test;MODE=MySQL;DB_CLOSE_DELAY=-1", "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=", "spring.flyway.baseline-on-migrate=false", "app.metrics.retention.enabled=true", "app.metrics.retention.batch-size=2"})
@AutoConfigureMockMvc
class MetricRetentionIntegrationTests {
    @Autowired MetricRepository metrics; @Autowired MonitoredSystemRepository systems; @Autowired JdbcTemplate jdbc; @Autowired MockMvc mvc;
    @BeforeEach void clear() { jdbc.update("DELETE FROM metric_archive"); jdbc.update("DELETE FROM alerts"); metrics.deleteAll(); systems.deleteAll(); }
    Metric reading(MonitoredSystem system, int days) { return metrics.saveAndFlush(new Metric(system, BigDecimal.TEN, BigDecimal.TEN, 10L, true, Instant.now().minus(Duration.ofDays(days)))); }
    @Test void boundedBatchesArchiveHistoryAndPreserveEvenStaleLatestReadings() throws Exception {
        var a=systems.saveAndFlush(new MonitoredSystem("archive-a","SERVICE","a.test",HealthStatus.HEALTHY,null));
        var b=systems.saveAndFlush(new MonitoredSystem("archive-b","SERVICE","b.test",HealthStatus.HEALTHY,null));
        reading(a,50); reading(a,45); Metric latestA=reading(a,35); reading(b,40); Metric latestB=reading(b,0);
        mvc.perform(get("/api/admin/metrics-retention/preview").with(user("ops").roles("OPERATIONS"))).andExpect(status().isOk()).andExpect(jsonPath("$.data.eligibleCount").value(3));
        mvc.perform(post("/api/admin/metrics-retention/run").with(user("ops").roles("OPERATIONS")).with(csrf())).andExpect(status().isOk()).andExpect(jsonPath("$.data.archivedCount").value(2));
        mvc.perform(post("/api/admin/metrics-retention/run").with(user("ops").roles("OPERATIONS")).with(csrf())).andExpect(status().isOk()).andExpect(jsonPath("$.data.archivedCount").value(1));
        mvc.perform(post("/api/admin/metrics-retention/run").with(user("ops").roles("OPERATIONS")).with(csrf())).andExpect(status().isOk()).andExpect(jsonPath("$.data.archivedCount").value(0));
        assertThat(metrics.findAll()).extracting(Metric::getId).containsExactlyInAnyOrder(latestA.getId(),latestB.getId());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM metric_archive",Integer.class)).isEqualTo(3);
    }
    @Test void archiveFailureRollsBackTheEntireBatch() throws Exception {
        var a=systems.saveAndFlush(new MonitoredSystem("rollback","SERVICE","rollback.test",HealthStatus.HEALTHY,null));
        Metric first=reading(a,50); Metric second=reading(a,40); reading(a,0);
        jdbc.update("INSERT INTO metric_archive SELECT metric_id,system_id,cpu_usage,memory_usage,response_time,availability,recorded_at,CURRENT_TIMESTAMP FROM metrics WHERE metric_id=?",second.getId());
        mvc.perform(post("/api/admin/metrics-retention/run").with(user("ops").roles("OPERATIONS")).with(csrf())).andExpect(status().isConflict());
        assertThat(metrics.count()).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM metric_archive",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM metric_archive WHERE metric_id=?",Integer.class,first.getId())).isZero();
    }
    @Test void archiveControlsRequireOperationsAndCsrf() throws Exception {
        mvc.perform(get("/api/admin/metrics-retention/preview")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/metrics-retention/preview").with(user("manager").roles("MANAGEMENT"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/metrics-retention/run").with(user("ops").roles("OPERATIONS"))).andExpect(status().isForbidden());
    }
}
