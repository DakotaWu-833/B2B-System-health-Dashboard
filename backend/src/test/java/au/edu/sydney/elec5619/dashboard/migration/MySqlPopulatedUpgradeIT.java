package au.edu.sydney.elec5619.dashboard.migration;
import static org.assertj.core.api.Assertions.assertThat;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
@Testcontainers
class MySqlPopulatedUpgradeIT {
    @Container static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4");
    @Test void populatedV1DatabaseUpgradesWithoutLosingHistoryOrUsers() {
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword())
            .locations("classpath:db/migration").target(MigrationVersion.fromVersion("1")).load().migrate();
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()));
        jdbc.update("INSERT INTO users (username,password_hash,role) VALUES ('review-ops','review-hash','OPERATIONS')");
        jdbc.update("INSERT INTO monitored_systems (name,type,host,status) VALUES (' Legacy API ',' SERVICE ',' legacy.example ','WARNING')");
        Long id = jdbc.queryForObject("SELECT system_id FROM monitored_systems", Long.class);
        jdbc.update("INSERT INTO metrics (system_id,cpu_usage,memory_usage,response_time,availability,recorded_at) VALUES (?,80,40,120,true,UTC_TIMESTAMP(6))", id);
        jdbc.update("INSERT INTO alerts (system_id,alert_type,severity,message,status,created_time) VALUES (?,'HIGH_CPU','WARNING','review alert','ACTIVE',UTC_TIMESTAMP(6))", id);
        Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).locations("classpath:db/migration").load().migrate();
        assertThat(jdbc.queryForObject("SELECT name FROM monitored_systems", String.class)).isEqualTo("Legacy API");
        for (String table : new String[]{"users", "monitored_systems", "metrics", "alerts"}) {
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class)).isEqualTo(1);
        }
        assertThat(jdbc.queryForObject("SELECT status FROM monitored_systems", String.class)).isEqualTo("WARNING");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email IS NULL AND email_verified=false", Integer.class)).isEqualTo(1);
        assertThat(Flyway.configure().dataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword()).load().migrate().migrationsExecuted).isZero();
        System.out.println("REVIEW_UPGRADE populated V1-to-V5 and repeated startup passed; existing user/system/metric/alert preserved");
    }
}
