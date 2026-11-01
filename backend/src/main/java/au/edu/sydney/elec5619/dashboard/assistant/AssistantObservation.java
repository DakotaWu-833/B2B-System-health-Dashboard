package au.edu.sydney.elec5619.dashboard.assistant;

/** A server-loaded observation, distinct from untrusted conversation history. */
public record AssistantObservation(String id, String title, Object data) {}
