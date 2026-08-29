package au.edu.sydney.elec5619.dashboard.migration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
    "spring.flyway.enabled=true",
    "spring.flyway.baseline-on-migrate=false",
    "spring.jpa.hibernate.ddl-auto=validate",
    "app.auth.seed.enabled=false",
    "app.demo-data.enabled=false"
})
class MySqlFlywayMigrationIT {

    @Container
    @ServiceConnection
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void migrationCreatesSchemaThatMatchesTheJpaModelOnMySql() {
        Integer tableCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name IN ('users', 'monitored_systems', 'metrics', 'alerts')
                """,
                Integer.class);

        assertThat(tableCount).isEqualTo(4);
    }
}
