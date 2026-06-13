import React from "react";
import { FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";

const IncidentCard = ({ alert, isSelected, onSelect }) => {
  const isCriticalActive =
    alert.status === "Active Drift" &&
    (alert.severity === "CRITICAL" || alert.severity === "HIGH");

  return (
    <div
      className={`incident-row p-3 border-bottom ${isSelected ? "selected" : ""} ${isCriticalActive ? "pulse" : ""}`}
      style={{ borderColor: "var(--sg-border)" }}
      onClick={() => onSelect(alert)}
    >
      <div className="d-flex justify-content-between align-items-start mb-1">
        <div className="fw-semibold">{alert.systemName}</div>
        <span className={`severity-badge sev-${alert.severity}`}>
          {alert.severity}
        </span>
      </div>

      <div className="incident-system-id mb-2">
        {alert.systemId} · {alert.environment}
      </div>

      <div className="small d-flex align-items-center justify-content-between">
        <span className="d-flex align-items-center gap-2">
          {alert.status === "Active Drift" ? (
            <>
              <FaExclamationTriangle color="var(--sg-red)" />
              <span className="mono" style={{ color: "var(--sg-red)" }}>
                {alert.driftedKey} drifted
              </span>
            </>
          ) : (
            <>
              <FaCheckCircle color="var(--sg-green)" />
              <span className="mono" style={{ color: "var(--sg-green)" }}>
                remediated
              </span>
            </>
          )}
        </span>
        <span className="incident-timestamp">
          {new Date(alert.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

export default IncidentCard;
