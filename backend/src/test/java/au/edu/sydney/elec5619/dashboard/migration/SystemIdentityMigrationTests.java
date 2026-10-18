package au.edu.sydney.elec5619.dashboard.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class SystemIdentityMigrationTests {
    @Test
    void upgradesV1NormalizesLegacyValuesAndEnforcesCompositeUniqueness() {
        var source = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        Flyway.configure().dataSource(source).target("1").load().migrate();
        var jdbc = new JdbcTemplate(source);
        jdbc.update("INSERT INTO monitored_systems(name,type,host,status) VALUES (' Legacy ',' SERVICE ',' legacy.example ','HEALTHY')");
        Flyway.configure().dataSource(source).load().migrate();
        assertThat(jdbc.queryForObject("SELECT name FROM monitored_systems", String.class)).isEqualTo("Legacy");
        assertThatThrownBy(() -> jdbc.update("INSERT INTO monitored_systems(name,type,host,status) VALUES ('Legacy','SERVICE','legacy.example','HEALTHY')"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        jdbc.update("INSERT INTO monitored_systems(name,type,host,status) VALUES ('Legacy','SERVICE','other.example','HEALTHY')");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM monitored_systems", Integer.class)).isEqualTo(2);
    }
}
