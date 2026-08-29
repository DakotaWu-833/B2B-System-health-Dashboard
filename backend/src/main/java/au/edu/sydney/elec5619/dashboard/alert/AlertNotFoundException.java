package au.edu.sydney.elec5619.dashboard.alert;

public class AlertNotFoundException extends RuntimeException {

    public AlertNotFoundException(Long alertId) {
        super("Alert " + alertId + " was not found");
    }
}
