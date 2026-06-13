import React from "react";

const MetricCard = ({ label, value, accent, suffix = "" }) => (
  <div className="col-md-3 col-6 mb-3">
    <div className="card-dark metric-card p-3 h-100">
      <div
        className="metric-accent-bar"
        style={{ background: accent || "var(--sg-border)" }}
      ></div>
      <div className="metric-label">{label}</div>
      <div
        className="metric-value"
        style={{ color: accent || "var(--sg-text)" }}
      >
        {value}
        {suffix}
      </div>
    </div>
  </div>
);

const MetricsBar = ({ alerts }) => {
  const totalSystems = new Set(alerts.map((a) => a.systemId)).size || 1;
  const activeCritical = alerts.filter(
    (a) => a.status === "Active Drift" && a.severity === "CRITICAL",
  ).length;
  const remediated = alerts.filter((a) => a.status === "Remediated").length;
  const activeTotal = alerts.filter((a) => a.status === "Active Drift").length;
  const total = alerts.length || 1;
  const complianceScore = Math.round(((total - activeTotal) / total) * 100);

  return (
    <div className="row mb-1">
      <MetricCard
        label="Systems Tracked"
        value={Math.max(totalSystems, 1)}
        accent="var(--sg-accent)"
      />
      <MetricCard
        label="Active Critical Drifts"
        value={activeCritical}
        accent="var(--sg-red)"
      />
      <MetricCard
        label="Remediation Events"
        value={remediated}
        accent="var(--sg-green)"
      />
      <MetricCard
        label="Compliance Score"
        value={complianceScore}
        suffix="%"
        accent={complianceScore > 80 ? "var(--sg-green)" : "var(--sg-orange)"}
      />
    </div>
  );
};

export default MetricsBar;
