function SystemDetails({ system }) {
  if (!system) {
    return null;
  }

  return (
    <section>
      <h2>System Details</h2>

      <h3>{system.name}</h3>

      <p>
        <strong>Status:</strong> {system.status}
      </p>

      <p>
        <strong>Reason:</strong>{" "}
        {system.reason ?? "No threshold issue detected."}
      </p>

      <h3>Recent Metrics</h3>

      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Metric</th>
            <th>Value</th>
          </tr>
        </thead>

        <tbody>
          {system.metrics?.length > 0 ? (
            system.metrics.map((metric, index) => (
              <tr key={index}>
                <td>{metric.time}</td>
                <td>{metric.name}</td>
                <td>{metric.value}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="3">No recent metrics available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export default SystemDetails;