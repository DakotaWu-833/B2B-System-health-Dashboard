package au.edu.sydney.elec5619.dashboard.system;

public class DuplicateMonitoredSystemException extends RuntimeException {
    public DuplicateMonitoredSystemException() {
        super("A monitored system with the same name, type and host already exists");
    }
}
