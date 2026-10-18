package au.edu.sydney.elec5619.dashboard.common;

public class DatabaseBusyException extends RuntimeException {
    public DatabaseBusyException(Throwable cause) { super("Database is busy; please retry the request", cause); }
}
