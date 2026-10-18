package au.edu.sydney.elec5619.dashboard.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import au.edu.sydney.elec5619.dashboard.system.*;
import au.edu.sydney.elec5619.dashboard.metric.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest(properties = {
    "spring.flyway.enabled=true", "spring.flyway.baseline-on-migrate=false",
    "spring.jpa.hibernate.ddl-auto=validate", "app.auth.seed.enabled=false",
    "app.demo-data.enabled=false", "app.metrics.retention.enabled=true", "app.metrics.retention.batch-size=2"
})
@AutoConfigureMockMvc
class MySqlDatabaseApiIT {
    @Container @ServiceConnection
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4");
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired MonitoredSystemRepository systems;
    @Autowired MetricRepository metrics;
    @Autowired MetricRetentionService retention;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach void clearBusinessRows() {
        jdbc.update("DELETE FROM metric_archive");
        jdbc.update("DELETE FROM alerts");
        jdbc.update("DELETE FROM metrics");
        jdbc.update("DELETE FROM monitored_systems");
    }
    MonitoredSystem createSystem(String name) {
        return systems.saveAndFlush(new MonitoredSystem(name, "SERVICE", name + ".example", HealthStatus.HEALTHY, null));
    }
    MvcResult submit(long id, String cpu, String responseTime) throws Exception {
        return mvc.perform(post("/api/systems/{id}/metrics", id)
            .with(user("review-ops").roles("OPERATIONS")).with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"cpuUsage\":" + cpu + ",\"memoryUsage\":20,\"responseTime\":" + responseTime + ",\"availability\":true}"))
            .andReturn();
    }
    JsonNode read(String uri) throws Exception {
        MvcResult result = mvc.perform(get(uri).with(user("review-ops").roles("OPERATIONS"))).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return mapper.readTree(result.getResponse().getContentAsString()).get("data");
    }
    @Test void rejectsExcessPrecisionAndPersistsConsistentBoundaryReadings() throws Exception {
        long id = createSystem("precision").getId();
        assertThat(submit(id, "74.999", "100").getResponse().getStatus()).isEqualTo(400);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM metrics", Integer.class)).isZero();
        assertThat(submit(id, "75.00", "100").getResponse().getStatus()).isEqualTo(201);
        JsonNode detail = read("/api/systems/" + id);
        assertThat(detail.get("latestMetric").get("cpuUsage").decimalValue()).isEqualByComparingTo("75.00");
        assertThat(detail.get("status").asText()).isEqualTo("WARNING");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM alerts", Integer.class)).isEqualTo(1);
    }
    @Test void negativeFractionalResponseTimeMustBeRejected() throws Exception {
        long id = createSystem("fraction").getId();
        MvcResult response = submit(id, "20", "-0.9");

        assertThat(response.getResponse().getStatus()).isEqualTo(400);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM metrics", Integer.class)).isZero();
    }
    @Test void historyAndDetailMustUseTheSameTimestampTieBreaker() throws Exception {
        MonitoredSystem system = createSystem("history");
        Instant timestamp = Instant.parse("2026-10-18T00:00:00Z");
        Metric first = metrics.saveAndFlush(new Metric(system, new BigDecimal("10"), new BigDecimal("20"), 100L, true, timestamp));
        Metric second = metrics.saveAndFlush(new Metric(system, new BigDecimal("30"), new BigDecimal("20"), 100L, true, timestamp));
        JsonNode detail = read("/api/systems/" + system.getId());
        JsonNode history = read("/api/systems/" + system.getId() + "/metrics");
        System.out.println("REVIEW_HISTORY first=" + first.getId() + " second=" + second.getId() + " latest=" + detail.get("latestMetric") + " history=" + history);
        assertThat(history.get(0).get("metricId").asLong()).isEqualTo(detail.get("latestMetric").get("metricId").asLong());
    }
    @Test void concurrentAbnormalReadingsForDifferentSystemsMustAllCommit() throws Exception {
        List<Long> ids = new ArrayList<>();
        for (int i = 0; i < 8; i++) ids.add(createSystem("parallel-" + i).getId());
        ExecutorService executor = Executors.newFixedThreadPool(ids.size());
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Integer>> pending = new ArrayList<>();
        try {
            for (long id : ids) pending.add(executor.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                MvcResult response = submit(id, "95", "100");
                if (response.getResponse().getStatus() != 201) System.out.println("REVIEW_PARALLEL_ERROR " + response.getResponse().getContentAsString());
                return response.getResponse().getStatus();
            }));
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> result : pending) statuses.add(result.get(40, TimeUnit.SECONDS));
            System.out.println("REVIEW_MYSQL_ISOLATION=" + jdbc.queryForObject("SELECT @@transaction_isolation", String.class));
            if (statuses.stream().anyMatch(value -> value != 201)) {
                String innodb = MYSQL.execInContainer("mysql", "-uroot", "-p" + MYSQL.getPassword(), "-e", "SHOW ENGINE INNODB STATUS\\G").getStdout();
                int startAt = innodb.indexOf("LATEST DETECTED DEADLOCK");
                int endAt = innodb.indexOf("TRANSACTIONS", Math.max(0, startAt));
                if (startAt >= 0) System.out.println("REVIEW_DEADLOCK_DETAILS " + innodb.substring(startAt, endAt > startAt ? endAt : innodb.length()));
            }
            System.out.println("REVIEW_PARALLEL statuses=" + statuses + " committedMetrics=" + jdbc.queryForObject("SELECT COUNT(*) FROM metrics", Integer.class));
            assertThat(statuses).containsOnly(201);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM metrics", Integer.class)).isEqualTo(ids.size());
        } finally { executor.shutdownNow(); }
    }
    @Test void concurrentReadingsAndAlertActionsPreserveOneOpenAlertPerType() throws Exception {
        long id = createSystem("same-system").getId();
        assertThat(submit(id, "95", "100").getResponse().getStatus()).isEqualTo(201);
        long alert = jdbc.queryForObject("SELECT alert_id FROM alerts", Long.class);
        var executor = Executors.newFixedThreadPool(10);
        var start = new CountDownLatch(1);
        List<Future<Integer>> work = new ArrayList<>();
        try {
            for (int i = 0; i < 8; i++) work.add(executor.submit(() -> { start.await(); return submit(id, "95", "100").getResponse().getStatus(); }));
            for (String action : List.of("acknowledge", "resolve")) work.add(executor.submit(() -> {
                start.await();
                return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/alerts/{id}/" + action, alert)
                    .with(user("review-ops").roles("OPERATIONS")).with(csrf())).andReturn().getResponse().getStatus();
            }));
            start.countDown();
            for (int i = 0; i < work.size(); i++) assertThat(work.get(i).get(40, TimeUnit.SECONDS)).isIn(i < 8 ? new Integer[]{201} : new Integer[]{200, 409});
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM metrics", Integer.class)).isEqualTo(9);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM alerts WHERE status IN ('ACTIVE','ACKNOWLEDGED')", Integer.class)).isLessThanOrEqualTo(1);
            assertThat(submit(id, "95", "100").getResponse().getStatus()).isEqualTo(201);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM alerts WHERE status IN ('ACTIVE','ACKNOWLEDGED')", Integer.class)).isEqualTo(1);
        } finally { executor.shutdownNow(); }
    }
    @Test void concurrentSystemCreationHasExactlyOneWinner() throws Exception {
        var executor = Executors.newFixedThreadPool(2); var start = new CountDownLatch(1);
        Callable<Integer> create = () -> {
            start.await();
            return mvc.perform(post("/api/systems").with(user("review-ops").roles("OPERATIONS")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Concurrent API\",\"type\":\"SERVICE\",\"host\":\"race.example.test\"}"))
                .andReturn().getResponse().getStatus();
        };
        try {
            var first = executor.submit(create); var second = executor.submit(create); start.countDown();
            assertThat(List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);
            assertThat(systems.count()).isEqualTo(1);
        } finally { executor.shutdownNow(); }
    }
    @Test void invalidNumbersAndMissingFieldsDoNotChangeMetricsHealthOrAlerts() throws Exception {
        long id = createSystem("invalid-numbers").getId();
        for (String body : List.of(
                "{\"cpuUsage\":101,\"memoryUsage\":20,\"responseTime\":100,\"availability\":true}",
                "{\"cpuUsage\":20,\"memoryUsage\":74.999,\"responseTime\":100,\"availability\":true}",
                "{\"cpuUsage\":20,\"memoryUsage\":-1,\"responseTime\":100,\"availability\":true}",
                "{\"cpuUsage\":20,\"memoryUsage\":20,\"responseTime\":0.9,\"availability\":true}",
                "{\"cpuUsage\":null,\"memoryUsage\":20,\"responseTime\":100,\"availability\":true}",
                "{\"cpuUsage\":20,\"memoryUsage\":20,\"responseTime\":100}")) {
            assertThat(mvc.perform(post("/api/systems/{id}/metrics", id).with(user("review-ops").roles("OPERATIONS")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getStatus()).isEqualTo(400);
        }
        assertThat(metrics.count()).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM alerts", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT status FROM monitored_systems WHERE system_id=?", String.class, id)).isEqualTo("HEALTHY");
        assertThat(submit(id, "0.00", "0").getResponse().getStatus()).isEqualTo(201);
    }
    @Test void realMySqlArchivePreservesLatestReadingsAndRespectsBatchLimit() {
        MonitoredSystem system = createSystem("archive");
        for (int i=0; i<4; i++) metrics.saveAndFlush(new Metric(system, new BigDecimal("20"), new BigDecimal("30"), 100L, true,
            Instant.now().minus(java.time.Duration.ofDays(40+i))));
        long latest = jdbc.queryForObject("SELECT metric_id FROM metrics ORDER BY recorded_at DESC,metric_id DESC LIMIT 1", Long.class);
        assertThat(retention.runBatch().archivedCount()).isEqualTo(2);
        assertThat(metrics.count()).isEqualTo(2);
        assertThat(retention.runBatch().archivedCount()).isEqualTo(1);
        assertThat(metrics.findById(latest)).isPresent();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM metric_archive", Integer.class)).isEqualTo(3);
        assertThat(retention.runBatch().archivedCount()).isZero();
    }
}
