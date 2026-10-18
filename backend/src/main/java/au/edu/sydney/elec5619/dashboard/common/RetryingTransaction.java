package au.edu.sydney.elec5619.dashboard.common;

import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Supplier;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Retries a complete rolled-back write, never a statement inside an aborted transaction. */
@Component
public class RetryingTransaction {
    private final TransactionTemplate transaction;
    public RetryingTransaction(PlatformTransactionManager manager) {
        transaction = new TransactionTemplate(manager);
        // Per-system row locks preserve serialization; READ COMMITTED avoids cross-system gap locks.
        transaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        transaction.setTimeout(15);
    }
    public <T> T execute(Supplier<T> operation) {
        // The owner of an existing transaction must decide whether the complete transaction can retry.
        if (TransactionSynchronizationManager.isActualTransactionActive()) return operation.get();
        for (int attempt = 0; ; attempt++) {
            try { return transaction.execute(status -> operation.get()); }
            catch (PessimisticLockingFailureException failure) {
                if (attempt >= 4) throw new DatabaseBusyException(failure);
                try { Thread.sleep(ThreadLocalRandom.current().nextLong(10L, 30L * (attempt + 2))); }
                catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new DatabaseBusyException(interrupted);
                }
            }
        }
    }
}
