package au.edu.sydney.elec5619.dashboard.system;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SystemMutationRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Size(max = 50) String type,
        @NotBlank @Size(max = 255) String host,
        @Size(max = 1000) String description) {
}
