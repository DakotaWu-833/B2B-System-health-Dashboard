package au.edu.sydney.elec5619.dashboard.migration;
import static org.assertj.core.api.Assertions.*;
import java.nio.file.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.*;
@Testcontainers
class DatabaseCapacityIT {
    @Container static final MySQLContainer<?> MYSQL=new MySQLContainer<>("mysql:8.4");
    JdbcTemplate jdbc;
    Flyway flyway(String target) { var config=Flyway.configure().dataSource(MYSQL.getJdbcUrl(),MYSQL.getUsername(),MYSQL.getPassword()).cleanDisabled(false); if(target!=null)config.target(target); return config.load(); }
    @BeforeEach void clear() { flyway(null).clean(); jdbc=new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(),MYSQL.getUsername(),MYSQL.getPassword())); }
    @Test void databaseRejectsInvalidMetricValuesAndPreservesLegalBoundaries() {
        flyway(null).migrate(); jdbc.update("INSERT INTO monitored_systems(name,type,host,status) VALUES ('bounds','SERVICE','bounds.test','HEALTHY')");
        long id=jdbc.queryForObject("SELECT system_id FROM monitored_systems",Long.class);
        for(String values:List.of("-1,20,100","101,20,100","20,-1,100","20,101,100","20,20,-1"))
            assertThatThrownBy(() -> jdbc.update("INSERT INTO metrics(system_id,cpu_usage,memory_usage,response_time,availability,recorded_at) VALUES (?,"+values+",true,UTC_TIMESTAMP(6))",id)).isInstanceOf(DataAccessException.class).satisfies(failure ->
                assertThat(((java.sql.SQLException)((DataAccessException)failure).getMostSpecificCause()).getErrorCode()).isEqualTo(3819));
        for(String values:List.of("0,0,0","100,100,100")) jdbc.update("INSERT INTO metrics(system_id,cpu_usage,memory_usage,response_time,availability,recorded_at) VALUES (?,"+values+",true,UTC_TIMESTAMP(6))",id);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM metrics",Integer.class)).isEqualTo(2);
    }
    @Test void duplicateLegacyIdentityStopsUpgradeWithoutDeletingHistoryAndCanBeReconciled() {
        flyway("1").migrate();
        jdbc.update("INSERT INTO monitored_systems(name,type,host,status) VALUES (' Legacy ','SERVICE','same.test','HEALTHY'),('legacy','SERVICE','same.test','WARNING')");
        jdbc.update("INSERT INTO users(username,password_hash,role) VALUES ('legacy-user','test-hash','OPERATIONS')");
        jdbc.update("INSERT INTO metrics(system_id,cpu_usage,memory_usage,response_time,availability,recorded_at) SELECT system_id,20,30,100,true,UTC_TIMESTAMP(6) FROM monitored_systems");
        jdbc.update("INSERT INTO alerts(system_id,alert_type,severity,message,status,created_time) SELECT system_id,'HIGH_CPU','WARNING','legacy','ACTIVE',UTC_TIMESTAMP(6) FROM monitored_systems");
        assertThatThrownBy(() -> flyway(null).migrate()).isInstanceOf(org.flywaydb.core.api.FlywayException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM metrics",Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM alerts",Integer.class)).isEqualTo(2);
        jdbc.update("UPDATE monitored_systems SET name='Explicitly reconciled legacy system' WHERE system_id=(SELECT id FROM (SELECT MAX(system_id) id FROM monitored_systems) derived)");
        flyway(null).repair(); flyway(null).migrate();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM monitored_systems",Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email IS NULL AND email_verified=false",Integer.class)).isEqualTo(1);
    }
    @Test void plansAndTimingAreRecordedForTenThousandReadingsAndAlerts() throws Exception {
        flyway(null).migrate();
        List<Object[]> systems=new ArrayList<>();
        for(int i=1;i<=128;i++) systems.add(new Object[]{"capacity-"+i,"capacity-"+i+".test"});
        jdbc.batchUpdate("INSERT INTO monitored_systems(name,type,host,status) VALUES (?,'SERVICE',?,'HEALTHY')",systems);
        List<Object[]> metrics=new ArrayList<>(), alerts=new ArrayList<>(); Instant now=Instant.now();
        for(int i=0;i<10000;i++) {
            int system=i%128+1; Timestamp at=Timestamp.from(now.minusSeconds(i));
            metrics.add(new Object[]{system,at}); alerts.add(new Object[]{system,i%1000==0?"ACTIVE":"RESOLVED",at});
        }
        jdbc.batchUpdate("INSERT INTO metrics(system_id,cpu_usage,memory_usage,response_time,availability,recorded_at) VALUES (?,20,30,100,true,?)",metrics);
        jdbc.batchUpdate("INSERT INTO alerts(system_id,alert_type,severity,message,status,created_time) VALUES (?,'HIGH_CPU','WARNING','capacity',?,?)",alerts);
        jdbc.execute("ANALYZE TABLE alerts, metrics");
        String global="SELECT alert_id FROM alerts WHERE status='ACTIVE' ORDER BY created_time DESC,alert_id DESC LIMIT 20";
        String before="SELECT alert_id FROM alerts IGNORE INDEX (idx_alerts_status_time,idx_alerts_system_type_status_time) WHERE status='ACTIVE' ORDER BY created_time DESC,alert_id DESC LIMIT 20";
        String latest="SELECT m.metric_id FROM metrics m WHERE NOT EXISTS (SELECT 1 FROM metrics newer WHERE newer.system_id=m.system_id AND (newer.recorded_at>m.recorded_at OR (newer.recorded_at=m.recorded_at AND newer.metric_id>m.metric_id)))";
        String scoped=latest.replace("WHERE NOT EXISTS", "WHERE m.system_id IN (1,2,3,4,5,6,7,8,9,10) AND NOT EXISTS");
        Map<String,Object> report=new LinkedHashMap<>(); report.put("metricRows",10000);report.put("alertRows",10000);report.put("systems",128);
        report.put("alertsBefore",jdbc.queryForObject("EXPLAIN ANALYZE "+before,String.class));
        String after=jdbc.queryForObject("EXPLAIN ANALYZE "+global,String.class);report.put("alertsAfter",after);
        report.put("latestAllSystems",jdbc.queryForObject("EXPLAIN ANALYZE "+latest,String.class));
        report.put("latestCurrentPage",jdbc.queryForObject("EXPLAIN ANALYZE "+scoped,String.class));
        assertThat(after).contains("idx_alerts_status_time");
        assertThat(jdbc.queryForList(latest,Long.class)).hasSize(128); assertThat(jdbc.queryForList(scoped,Long.class)).hasSize(10);
        Path output=Path.of("target/verification/capacity-plans.json");Files.createDirectories(output.getParent());
        Files.writeString(output,new com.fasterxml.jackson.databind.ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(report));
    }
}
