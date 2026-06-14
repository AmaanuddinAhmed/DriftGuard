import React, { useState, useEffect, useCallback } from "react";
import { FaShieldAlt } from "react-icons/fa";
import MetricsBar from "./components/MetricsBar";
import IncidentFeed from "./components/IncidentFeed";
import DriftInspector from "./components/DriftInspector";
import AddDriftEvent from "./components/AddDriftEvent";
import { fetchAlerts, fetchSummary, fetchFeedStatus } from "./api/alerts";

const App = () => {
  const [alerts, setAlerts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);
  const [feedStatus, setFeedStatus] = useState(null);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchAlerts();
      setAlerts(data);
      setSelected((prev) =>
        prev ? data.find((a) => a._id === prev._id) || prev : prev,
      );
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchSummary();
      setSummary(data);
    } catch (err) {
      console.error("Failed to fetch summary:", err);
    }
  }, []);

  const loadFeedStatus = useCallback(async () => {
    try {
      const data = await fetchFeedStatus();
      setFeedStatus(data);
    } catch (err) {
      console.error("Failed to fetch feed status:", err);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    loadSummary();
    loadFeedStatus();
    const interval = setInterval(() => {
      loadAlerts();
      loadSummary();
      loadFeedStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadAlerts, loadSummary, loadFeedStatus]);

  const handleRemediated = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a._id === id ? { ...a, status: "Remediated" } : a)),
    );
    setSelected((prev) =>
      prev && prev._id === id ? { ...prev, status: "Remediated" } : prev,
    );
  };

  const systemMap = new Map();
  alerts.forEach((a) => {
    const existing = systemMap.get(a.systemId);
    const isActive = a.status === "Active Drift";
    const rank = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
    if (!existing) {
      systemMap.set(a.systemId, {
        active: isActive,
        severity: a.severity,
        rank: isActive ? rank[a.severity] : -1,
      });
    } else if (isActive && (rank[a.severity] ?? -1) > existing.rank) {
      systemMap.set(a.systemId, {
        active: true,
        severity: a.severity,
        rank: rank[a.severity],
      });
    }
  });
  const systems = Array.from(systemMap.values());
  const driftingCount = systems.filter((s) => s.active).length;
  const integrityScore = systems.length
    ? Math.round(((systems.length - driftingCount) / systems.length) * 100)
    : 100;

  const segmentClass = (s) => {
    if (!s.active) return "ok";
    return s.severity === "CRITICAL" || s.severity === "HIGH"
      ? "drift-high"
      : "drift-low";
  };

  return (
    <div className="container-fluid p-4">
      <div className="sg-header">
        <div className="d-flex align-items-center">
          <span className="sg-brand-mark">
            <FaShieldAlt />
          </span>
          <div>
            <h3 className="sg-title">DriftGuard</h3>
            <div className="sg-subtitle">
              security_control_drift // misconfiguration_detection
            </div>
          </div>
        </div>
        <span className="sg-live-pill">
          <span className="sg-live-dot"></span>
          {feedStatus?.status === "streaming"
            ? `LIVE — streaming ${feedStatus.ingestedCount}/${feedStatus.totalEvents} events`
            : feedStatus?.status === "seeding" ||
                feedStatus?.status === "loading"
              ? "LIVE — initializing feed..."
              : feedStatus?.status === "complete"
                ? `LIVE — ${feedStatus.ingestedCount}/${feedStatus.totalEvents} events processed`
                : "LIVE — polling every 5s"}
        </span>
      </div>

      <div className="sg-integrity-strip">
        <span className="sg-integrity-label">Baseline Integrity</span>
        <div className="sg-integrity-track">
          {systems.length === 0 ? (
            <div className="sg-integrity-segment"></div>
          ) : (
            systems.map((s, i) => (
              <div
                key={i}
                className={`sg-integrity-segment ${segmentClass(s)}`}
              ></div>
            ))
          )}
        </div>
        <span
          className="sg-integrity-score"
          style={{
            color: integrityScore > 80 ? "var(--sg-green)" : "var(--sg-orange)",
          }}
        >
          {integrityScore}% COMPLIANT
        </span>
      </div>

      <MetricsBar alerts={alerts} summary={summary} />

      <AddDriftEvent
        onCreated={(created) => {
          loadAlerts();
          loadSummary();
          setSelected(created);
        }}
      />

      <div className="row">
        <div className="col-md-5 mb-3">
          <IncidentFeed
            alerts={alerts}
            selectedId={selected?._id}
            onSelect={setSelected}
          />
        </div>
        <div className="col-md-7 mb-3">
          <DriftInspector alert={selected} onRemediated={handleRemediated} />
        </div>
      </div>
    </div>
  );
};

export default App;
