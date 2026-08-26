package au.edu.sydney.elec5619.dashboard.dashboard;

public record DashboardSummaryResponse(
        long total,
        long healthy,
        long warning,
        long critical,
        long offline) {
}
