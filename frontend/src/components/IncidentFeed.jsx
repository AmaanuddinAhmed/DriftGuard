import React from 'react';
import { FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';

const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const IncidentFeed = ({ alerts, selectedId, onSelect }) => {
  const sorted = [...alerts].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Active Drift' ? -1 : 1;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return (
    <div className="card-dark p-0" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
      <div className="p-3 border-bottom" style={{ borderColor: 'var(--sg-border)' }}>
        <h6 className="mb-0 fw-bold">Active Incidents Feed</h6>
      </div>
      <div>
        {sorted.map(alert => {
          const isCriticalActive = alert.status === 'Active Drift' && (alert.severity === 'CRITICAL' || alert.severity === 'HIGH');
          return (
            <div
              key={alert._id}
              className={`incident-row p-3 border-bottom ${selectedId === alert._id ? 'selected' : ''} ${isCriticalActive ? 'pulse' : ''}`}
              style={{ borderColor: 'var(--sg-border)' }}
              onClick={() => onSelect(alert)}
            >
              <div className="d-flex justify-content-between align-items-start mb-1">
                <div className="fw-semibold">{alert.systemName}</div>
                <span className={`severity-badge sev-${alert.severity}`}>{alert.severity}</span>
              </div>
              <div className="small text-muted mb-1">{alert.systemId} • {alert.environment}</div>
              <div className="small d-flex align-items-center gap-2">
                {alert.status === 'Active Drift' ? (
                  <><FaExclamationTriangle color="var(--sg-red)" /> <span style={{ color: 'var(--sg-red)' }}>{alert.driftedKey} drifted</span></>
                ) : (
                  <><FaCheckCircle color="var(--sg-green)" /> <span style={{ color: 'var(--sg-green)' }}>Remediated</span></>
                )}
              </div>
              <div className="small text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                {new Date(alert.timestamp).toLocaleTimeString()}
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && <div className="p-4 text-center text-muted">No alerts yet.</div>}
      </div>
    </div>
  );
};

export default IncidentFeed;