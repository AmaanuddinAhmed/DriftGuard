import IncidentCard from "./IncidentCard";
import React, { useEffect, useRef, useState } from "react";

const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const IncidentFeed = ({ alerts, selectedId, onSelect }) => {
  const seenIds = useRef(new Set());
  const [newIds, setNewIds] = useState(new Set());

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

  const sorted = [...alerts].sort((a, b) => {
    if (a.status !== b.status) return a.status === "Active Drift" ? -1 : 1;
    return severityOrder[a.severity] - severityOrder[b.severity];
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
        <h6 className="mb-0 fw-bold">Active Incidents Feed</h6>
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
          <div className="p-4 text-center text-muted">No alerts yet.</div>
        )}
      </div>
    </div>
  );
};

export default IncidentFeed;
