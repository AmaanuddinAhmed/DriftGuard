import React, { useState } from "react";
import { FaBolt, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { remediateAlert } from "../api/alerts";

const DriftInspector = ({ alert, onRemediated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!alert) {
    return (
      <div className="card-dark p-5 text-center h-100 d-flex align-items-center justify-content-center">
        Select an incident to inspect drift details.
      </div>
    );
  }

  const handleRemediate = async () => {
    setLoading(true);
    setError(null);
    try {
      await remediateAlert(alert.systemId, alert.driftedKey);
      onRemediated(alert._id);
    } catch (err) {
      setError("Remediation failed. Check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  const isActive = alert.status === "Active Drift";

  return (
    <div className="card-dark p-4 h-100">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 className="fw-bold mb-1">{alert.systemName}</h5>
          <div className="incident-system-id">
            {alert.systemId} · {alert.environment}
          </div>
        </div>
        <span className={`severity-badge sev-${alert.severity}`}>
          {alert.severity}
        </span>
      </div>

      <hr />

      <div className="mb-3">
        <div className="section-label">
          Configuration Diff — <span className="mono">{alert.driftedKey}</span>
        </div>
        <div className="diff-expected mb-2">
          - expected: {JSON.stringify(alert.expectedValue)}
        </div>
        <div className="diff-actual">
          + actual: {JSON.stringify(alert.actualValue)}
        </div>
      </div>

      <div className="mb-4">
        <div className="section-label text-info">
          Engine Analysis & Detection Reason
        </div>
        <div
          className="p-3 rounded"
          style={{
            background: "rgba(23, 162, 184, 0.1)",
            border: "1px solid var(--sg-info, #17a2b8)",
            color: "#e0e0e0",
          }}
        >
          <span className="mono" style={{ fontSize: "0.95rem" }}>
            {alert.changeReason}
          </span>
        </div>
        <div className="text-muted small mt-2">
          <strong>Detected By:</strong> RiskEngine v1.0 |{" "}
          <strong>Operator:</strong> {alert.changedBy}
        </div>
      </div>

      <div className="mb-4">
        <div className="section-label">Compliance Impact</div>
        <div
          className="p-3 rounded d-flex align-items-start gap-2"
          style={{
            background: "var(--sg-slate-light)",
            border: "1px solid var(--sg-border)",
          }}
        >
          <span style={{ flex: 1 }}>
            <FaExclamationTriangle color="var(--sg-orange)" className="me-2" />
            {alert.complianceImpact}
          </span>
        </div>
        {alert.complianceFrameworks && (
          <div className="d-flex gap-2 mt-2 flex-wrap">
            {alert.complianceFrameworks.map((f) => (
              <span key={f} className="compliance-chip">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}

      <button
        className="remediate-btn w-100"
        onClick={handleRemediate}
        disabled={!isActive || loading}
      >
        {loading ? (
          "Executing Rollback..."
        ) : isActive ? (
          <>
            <FaBolt className="me-2" />
            Execute Auto-Remediation
          </>
        ) : (
          <>
            <FaCheckCircle className="me-2" />
            Remediated — Baseline Restored
          </>
        )}
      </button>
    </div>
  );
};

export default DriftInspector;
