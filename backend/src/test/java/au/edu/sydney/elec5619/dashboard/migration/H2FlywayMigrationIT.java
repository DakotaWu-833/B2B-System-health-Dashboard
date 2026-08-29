package au.edu.sydney.elec5619.dashboard.migration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:flyway-migration;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.flyway.enabled=true",
    "spring.flyway.baseline-on-migrate=false",
    "spring.jpa.hibernate.ddl-auto=validate",
    "app.auth.seed.enabled=false",
    "app.demo-data.enabled=false"
})
class H2FlywayMigrationIT {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void migrationCreatesSchemaThatMatchesTheJpaModel() {
        assertThat(rowCount("users")).isZero();
        assertThat(rowCount("monitored_systems")).isZero();
        assertThat(rowCount("metrics")).isZero();
        assertThat(rowCount("alerts")).isZero();
    }

    private Long rowCount(String tableName) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + tableName, Long.class);
    }
}
