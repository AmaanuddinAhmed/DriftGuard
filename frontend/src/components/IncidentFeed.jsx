import IncidentCard from "./IncidentCard";
import React, { useEffect, useRef, useState } from "react";

const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const IncidentFeed = ({ alerts, selectedId, onSelect }) => {
  const seenIds = useRef(new Set());
  const [newIds, setNewIds] = useState(new Set());
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    const incoming = alerts.filter((a) => !seenIds.current.has(a._id));
    if (incoming.length > 0) {
      const updatedNew = new Set(incoming.map((a) => a._id));
      incoming.forEach((a) => seenIds.current.add(a._id));
      setNewIds(updatedNew);

      // remove the "entering" flag after the animation finishes
      const timer = setTimeout(() => {
        setNewIds(new Set());
      }, 550);
      return () => clearTimeout(timer);
    } else {
      alerts.forEach((a) => seenIds.current.add(a._id));
    }
  }, [alerts]);

  const filtered = alerts.filter((a) => {
    if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
    if (statusFilter === "DRIFTED" && a.status !== "Active Drift") return false;
    if (statusFilter === "REMEDIATED" && a.status === "Active Drift")
      return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.status !== b.status) return a.status === "Active Drift" ? -1 : 1;
    if (severityOrder[a.severity] !== severityOrder[b.severity])
      return severityOrder[a.severity] - severityOrder[b.severity];
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return (
    <div
      className="card-dark p-0"
      style={{ maxHeight: "70vh", overflowY: "auto" }}
    >
      <div
        className="p-3 border-bottom"
        style={{ borderColor: "var(--sg-border)" }}
      >
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <h6 className="mb-0 fw-bold">Active Incidents Feed</h6>
          <span className="text-muted small">
            {sorted.length} / {alerts.length}
          </span>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <select
            className="form-select form-select-sm"
            style={{ width: "auto" }}
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL">All Severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="form-select form-select-sm"
            style={{ width: "auto" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="DRIFTED">Active Drift</option>
            <option value="REMEDIATED">Remediated</option>
          </select>
        </div>
      </div>
      <div>
        {sorted.map((alert) => (
          <div
            key={alert._id}
            className={newIds.has(alert._id) ? "entering" : ""}
          >
            <IncidentCard
              alert={alert}
              isSelected={selectedId === alert._id}
              onSelect={onSelect}
            />
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="p-4 text-center text-muted">
            No alerts match the selected filters.
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentFeed;
