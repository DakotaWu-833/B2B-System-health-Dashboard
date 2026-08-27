package au.edu.sydney.elec5619.dashboard.system;

public record SystemListItemResponse(
        Long id,
        String name,
        String type,
        String host,
        HealthStatus status,
        String description) {

    public static SystemListItemResponse from(MonitoredSystem system) {
        return new SystemListItemResponse(
                system.getId(),
                system.getName(),
                system.getType(),
                system.getHost(),
                system.getStatus(),
                system.getDescription());
    }
}
