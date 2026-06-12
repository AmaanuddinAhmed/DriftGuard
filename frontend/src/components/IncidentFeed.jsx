import IncidentCard from './IncidentCard';
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
        {sorted.map(alert => (
          <IncidentCard
            key={alert._id}
            alert={alert}
            isSelected={selectedId === alert._id}
            onSelect={onSelect}
          />
        ))}
        {sorted.length === 0 && <div className="p-4 text-center text-muted">No alerts yet.</div>}
      </div>
    </div>
  );
};

export default IncidentFeed;