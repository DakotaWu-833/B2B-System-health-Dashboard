import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { HealthDistribution, MetricTrend } from "../src/Charts";

const series = [{ key: "cpuUsage", label: "CPU", color: "#3866cd" }];

describe("Data charts", () => {
  test("empty data shows an empty state rather than fabricated values", () => {
    render(<><HealthDistribution summary={{ total: 0 }} />
      <MetricTrend metrics={[]} title="Resource usage" unit="%" series={series} maximum={100} /></>);
    expect(screen.getByText("No system data to chart yet.")).toBeInTheDocument();
    expect(screen.getByText("No recorded metrics to chart yet.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("health segments reflect the API category counts", () => {
    const { container } = render(<HealthDistribution summary={{ total: 4, healthy: 2, warning: 1, critical: 0, offline: 1 }} />);
    expect(screen.getByRole("img", { name: "4 systems by health status" })).toBeInTheDocument();
    const slices = container.querySelectorAll("circle[pathLength]");
    expect(slices[0].getAttribute("stroke-dasharray")).toBe("50 50");
    expect(slices[1].getAttribute("stroke-dashoffset")).toBe("-50");
    expect(slices[3].getAttribute("stroke-dasharray")).toBe("25 75");
  });

  test("sorts observations without mutating input and spaces them by actual time", () => {
    const metrics = [
      { timestamp: "2026-10-18T00:10:00Z", cpuUsage: 50 },
      { timestamp: "2026-10-18T00:00:00Z", cpuUsage: 0 },
      { timestamp: "2026-10-18T00:02:00Z", cpuUsage: 100 },
    ];
    const { container } = render(<MetricTrend metrics={metrics} title="Resource usage" unit="%" series={series} maximum={100} />);
    const points = container.querySelector("polyline").getAttribute("points").split(" ").map(point => point.split(",").map(Number));
    expect(points[0]).toEqual([48, 166]);
    expect(points[1][0]).toBeCloseTo(144.8);
    expect(points[1][1]).toBe(30);
    expect(points[2]).toEqual([532, 98]);
    expect(metrics[0].cpuUsage).toBe(50);
  });

  test("missing observations break the line and a single observation stays visible", () => {
    const metrics = [
      { timestamp: "2026-10-18T00:00:00Z", cpuUsage: 12 },
      { timestamp: "2026-10-18T00:01:00Z", cpuUsage: null },
      { timestamp: "2026-10-18T00:02:00Z", cpuUsage: 24 },
    ];
    const { container, rerender } = render(<MetricTrend metrics={metrics} title="Resource usage" unit="%" series={series} maximum={100} />);
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    rerender(<MetricTrend metrics={[metrics[0]]} title="Resource usage" unit="%" series={series} maximum={100} />);
    expect(container.querySelector("circle").getAttribute("cx")).toBe("290");
    expect(container.innerHTML).not.toContain("NaN");
  });
});
