package au.edu.sydney.elec5619.dashboard.alert;

public class InvalidAlertStatusTransitionException extends RuntimeException {

    public InvalidAlertStatusTransitionException(
            Long alertId,
            AlertStatus currentStatus,
            AlertStatus requestedStatus) {
        super("Alert " + alertId + " cannot change from " + currentStatus + " to " + requestedStatus);
    }
}
