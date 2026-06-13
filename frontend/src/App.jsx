import React, { useState, useEffect, useCallback } from "react";
import MetricsBar from "./components/MetricsBar";
import IncidentFeed from "./components/IncidentFeed";
import DriftInspector from "./components/DriftInspector";
import { fetchAlerts } from "./api/alerts";

const App = () => {
  const [alerts, setAlerts] = useState([]);
  const [selected, setSelected] = useState(null);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchAlerts();
      setAlerts(data);
      // keep selected alert in sync with latest status
      setSelected((prev) =>
        prev ? data.find((a) => a._id === prev._id) || prev : prev,
      );
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 5000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const handleRemediated = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a._id === id ? { ...a, status: "Remediated" } : a)),
    );
    setSelected((prev) =>
      prev && prev._id === id ? { ...prev, status: "Remediated" } : prev,
    );
  };

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-0">🛡️ DriftGuard</h3>
          <div className="text-muted small">
            Security Control Drift & Misconfiguration Detection
          </div>
        </div>
        <span
          className="badge"
          style={{
            background: "var(--sg-slate-light)",
            border: "1px solid var(--sg-border)",
            padding: "8px 14px",
          }}
        >
          🟢 Live • Polling every 5s
        </span>
      </div>

      <MetricsBar alerts={alerts} />

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
