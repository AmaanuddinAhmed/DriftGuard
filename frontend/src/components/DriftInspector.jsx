import React, { useState } from 'react';
import { remediateAlert } from '../api/alerts';

const DriftInspector = ({ alert, onRemediated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!alert) {
    return (
      <div className="card-dark p-5 text-center text-muted h-100 d-flex align-items-center justify-content-center">
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
      setError('Remediation failed. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const isActive = alert.status === 'Active Drift';

  return (
    <div className="card-dark p-4 h-100">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 className="fw-bold mb-1">{alert.systemName}</h5>
          <div className="text-muted small">{alert.systemId} • {alert.environment}</div>
        </div>
        <span className={`severity-badge sev-${alert.severity}`}>{alert.severity}</span>
      </div>

      <hr style={{ borderColor: 'var(--sg-border)' }} />

      <div className="mb-3">
        <div className="text-muted small text-uppercase mb-2" style={{ letterSpacing: '1px', fontSize: '0.7rem' }}>
          Configuration Diff — {alert.driftedKey}
        </div>
        <div className="diff-expected mb-2">
          - Expected: {JSON.stringify(alert.expectedValue)}
        </div>
        <div className="diff-actual">
          + Actual: {JSON.stringify(alert.actualValue)}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-muted small text-uppercase mb-2" style={{ letterSpacing: '1px', fontSize: '0.7rem' }}>
          Compliance Impact
        </div>
        <div className="p-3 rounded" style={{ background: 'var(--sg-slate-light)', border: '1px solid var(--sg-border)' }}>
          ⚠️ {alert.complianceImpact}
        </div>
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}

      <button
        className="remediate-btn w-100"
        onClick={handleRemediate}
        disabled={!isActive || loading}
      >
        {loading ? 'Executing Rollback...' : isActive ? '⚡ Execute Auto-Remediation' : '✓ Remediated — Baseline Restored'}
      </button>
    </div>
  );
};

export default DriftInspector;