package au.edu.sydney.elec5619.dashboard.system;

public class MonitoredSystemNotFoundException extends RuntimeException {

    public MonitoredSystemNotFoundException(Long systemId) {
        super("Monitored system " + systemId + " was not found");
    }
}
