package au.edu.sydney.elec5619.dashboard.common;
import static org.assertj.core.api.Assertions.*;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
class RetryingTransactionTests {
    @Test void retriesStartFreshTransactionsAndDoNotKeepFailedAttemptWrites() {
        var source=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1","sa","");
        var jdbc=new JdbcTemplate(source); jdbc.execute("CREATE TABLE attempts(id INT PRIMARY KEY)");
        var retry=new RetryingTransaction(new DataSourceTransactionManager(source)); var attempts=new AtomicInteger();
        int result=retry.execute(() -> { int attempt=attempts.incrementAndGet(); jdbc.update("INSERT INTO attempts VALUES (?)",attempt);
            if(attempt<3) throw new CannotAcquireLockException("simulated deadlock"); return attempt; });
        assertThat(result).isEqualTo(3); assertThat(jdbc.queryForList("SELECT id FROM attempts",Integer.class)).containsExactly(3);
    }
    @Test void retryExhaustionIsBoundedAndRollsBackEveryAttempt() {
        var source=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1","sa","");
        var jdbc=new JdbcTemplate(source); jdbc.execute("CREATE TABLE attempts(id INT PRIMARY KEY)");
        var retry=new RetryingTransaction(new DataSourceTransactionManager(source)); var attempts=new AtomicInteger();
        assertThatThrownBy(() -> retry.execute(() -> { jdbc.update("INSERT INTO attempts VALUES (?)",attempts.incrementAndGet()); throw new CannotAcquireLockException("simulated deadlock"); }))
            .isInstanceOf(DatabaseBusyException.class);
        assertThat(attempts.get()).isEqualTo(5); assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM attempts",Integer.class)).isZero();
    }
}
