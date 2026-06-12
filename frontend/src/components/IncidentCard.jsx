import React from 'react';
import { FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';

const IncidentCard = ({ alert, isSelected, onSelect }) => {
  const isCriticalActive = alert.status === 'Active Drift' && (alert.severity === 'CRITICAL' || alert.severity === 'HIGH');

  return (
    <div
      className={`incident-row p-3 border-bottom ${isSelected ? 'selected' : ''} ${isCriticalActive ? 'pulse' : ''}`}
      style={{ borderColor: 'var(--sg-border)' }}
      onClick={() => onSelect(alert)}
    >
      <div className="d-flex justify-content-between align-items-start mb-1">
        <div className="fw-semibold">{alert.systemName}</div>
        <span className={`severity-badge sev-${alert.severity}`}>{alert.severity}</span>
      </div>

      <div className="small text-muted mb-1">
        {alert.systemId} • {alert.environment}
      </div>

      <div className="small d-flex align-items-center gap-2">
        {alert.status === 'Active Drift' ? (
          <>
            <FaExclamationTriangle color="var(--sg-red)" />
            <span style={{ color: 'var(--sg-red)' }}>{alert.driftedKey} drifted</span>
          </>
        ) : (
          <>
            <FaCheckCircle color="var(--sg-green)" />
            <span style={{ color: 'var(--sg-green)' }}>Remediated</span>
          </>
        )}
      </div>

      <div className="small text-muted mt-1" style={{ fontSize: '0.7rem' }}>
        {new Date(alert.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default IncidentCard;