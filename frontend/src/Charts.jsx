import { useId } from "react";

const healthGroups = [
  ["healthy", "Healthy", "var(--healthy)"],
  ["warning", "Warning", "var(--warning)"],
  ["critical", "Critical", "var(--critical)"],
  ["offline", "Offline", "var(--offline)"],
  ["noData", "No data", "#8d989f"],
];

export function HealthDistribution({ summary }) {
  const total = healthGroups.reduce((sum, [key]) => sum + (Number(summary[key]) || 0), 0);
  let offset = 0;
  return (
    <section className="chart-card health-chart" aria-label="System health distribution">
      <div className="health-chart-heading">
        <p className="section-kicker">Status breakdown</p>
        <h3>System health distribution</h3>
      </div>
      {total === 0 ? <p className="empty-state">No system data to chart yet.</p> : (
        <div className="health-chart-body">
          <svg viewBox="0 0 160 160" role="img" aria-label={`${total} systems by health status`}>
            <circle cx="80" cy="80" r="58" fill="none" stroke="var(--chart-track)" strokeWidth="18" />
            {healthGroups.map(([key, label, color]) => {
              const percent = (Number(summary[key]) || 0) / total * 100;
              const start = offset;
              offset += percent;
              return <circle key={key} cx="80" cy="80" r="58" fill="none" stroke={color}
                strokeWidth="18" pathLength="100" strokeDasharray={`${percent} ${100 - percent}`}
                strokeDashoffset={-start} transform="rotate(-90 80 80)">
                <title>{label}: {summary[key] || 0}</title>
              </circle>;
            })}
            <text x="80" y="78" textAnchor="middle" className="donut-total">{total}</text>
            <text x="80" y="98" textAnchor="middle" className="donut-caption">systems</text>
          </svg>
          <ul className="chart-legend">
            {healthGroups.map(([key, label, color]) => (
              <li key={key}><span className="legend-dot" style={{ backgroundColor: color }} />
                <span>{label}</span><strong>{summary[key] || 0}</strong></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function MetricTrend({ metrics, title, series, unit, maximum }) {
  const titleId = useId();
  // API history is newest first; use actual timestamps for chronological spacing.
  const records = metrics.filter(record => Number.isFinite(Date.parse(record.timestamp)))
    .slice().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const hasValue = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const usable = records.some(record => series.some(item => hasValue(record[item.key])));
  const values = records.flatMap(record => series.map(item => record[item.key]).filter(hasValue).map(Number));
  const top = maximum ?? Math.max(100, Math.ceil(Math.max(0, ...values) / 100) * 100);
  const firstTime = records.length ? Date.parse(records[0].timestamp) : 0;
  const lastTime = records.length ? Date.parse(records[records.length - 1].timestamp) : 0;
  const x = record => lastTime === firstTime ? 290 : 48 + (Date.parse(record.timestamp) - firstTime) / (lastTime - firstTime) * 484;
  const y = value => 166 - Number(value) / top * 136;
  const timeLabel = record => new Date(record.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="chart-card trend-chart" aria-labelledby={titleId}>
      <h3 id={titleId}>{title}</h3>
      <p className="chart-description">Recorded observations · {unit}</p>
      {!usable ? <p className="empty-state">No recorded metrics to chart yet.</p> : (
        <>
          <svg viewBox="0 0 560 210" role="img" aria-label={`${title}, ${records.length} recorded observations`}>
            {[0, 0.5, 1].map(fraction => <g key={fraction}>
              <line x1="48" x2="532" y1={y(fraction * top)} y2={y(fraction * top)} className="chart-gridline" />
              <text x="38" y={y(fraction * top) + 4} textAnchor="end" className="chart-axis">{fraction * top}</text>
            </g>)}
            {series.map(item => {
              // A missing observation breaks the line instead of fabricating a value.
              const segments = [];
              let segment = [];
              records.forEach(record => {
                if (hasValue(record[item.key])) segment.push(record);
                else if (segment.length) { segments.push(segment); segment = []; }
              });
              if (segment.length) segments.push(segment);
              return <g key={item.key}>
                {segments.map((part, index) => <polyline key={index} fill="none" stroke={item.color} strokeWidth="2.5"
                  points={part.map(record => `${x(record)},${y(record[item.key])}`).join(" ")} />)}
                {records.filter(record => hasValue(record[item.key])).map((record, index) => (
                  <circle key={index} cx={x(record)} cy={y(record[item.key])} r="3.5" fill={item.color}>
                    <title>{new Date(record.timestamp).toLocaleString()}: {item.label} {record[item.key]} {unit}</title>
                  </circle>
                ))}
              </g>;
            })}
            <text x="48" y="193" className="chart-axis">{timeLabel(records[0])}</text>
            {records.length > 1 && <text x="532" y="193" textAnchor="end" className="chart-axis">{timeLabel(records[records.length - 1])}</text>}
          </svg>
          <ul className="trend-legend">{series.map(item => <li key={item.key}>
            <span className="legend-dot" style={{ backgroundColor: item.color }} />{item.label}
          </li>)}</ul>
        </>
      )}
    </section>
  );
}
