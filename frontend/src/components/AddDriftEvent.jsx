import React, { useState } from "react";
import { FaPlus, FaTimes } from "react-icons/fa";
import { createEvent } from "../api/alerts";

const CONTROL_TYPES = [
  "Logging",
  "Encryption",
  "Access_Control",
  "DLP",
  "Data_Protection",
  "Network_Segmentation",
  "Endpoint",
  "Cloud_Security",
  "Firewall",
  "Vulnerability",
];

const CHANGE_REASONS = [
  "Security Update",
  "Policy Change",
  "Emergency Fix",
  "Troubleshooting",
  "Performance Tuning",
];

const STATUSES = [
  "Drifted",
  "Under_Review",
  "Mitigated",
  "Remediated",
  "Compliant",
];

const COMPLIANCE_TAGS = ["", "ISO", "NIST", "GDPR", "PCI", "CIS"];

const defaultForm = {
  control_name: "",
  control_type: "Logging",
  baseline_enabled: "True",
  current_enabled: "False",
  change_type: "Modify",
  operator_name: "",
  operator_email: "",
  approver_name: "",
  change_reason: "Policy Change",
  status: "Drifted",
  compliance_impact: "",
};

const AddDriftEvent = ({ onCreated }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.control_name.trim()) {
      setError("Control name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setLastResult(null);
    try {
      const payload = {
        control_name: form.control_name.trim(),
        control_type: form.control_type,
        baseline_value: `enabled=${form.baseline_enabled}`,
        current_value: `enabled=${form.current_enabled}`,
        change_type: form.change_type,
        operator_name: form.operator_name || "Manual Entry",
        operator_email: form.operator_email || "manual@driftguard.local",
        approver_name: form.approver_name,
        change_reason: form.change_reason,
        status: form.status,
        compliance_impact: form.compliance_impact,
      };
      const created = await createEvent(payload);
      setLastResult(created);
      setForm((f) => ({ ...defaultForm, control_type: f.control_type }));
      if (onCreated) onCreated(created);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card-dark p-3 mb-3">
      <div
        className="d-flex justify-content-between align-items-center"
        style={{ cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        <h6 className="mb-0 fw-bold">
          {open ? <FaTimes className="me-2" /> : <FaPlus className="me-2" />}
          Log New Drift Event
        </h6>
        <span className="text-muted small">
          {open ? "collapse" : "manually inject a config change"}
        </span>
      </div>

      {open && (
        <form className="mt-3" onSubmit={handleSubmit}>
          <div className="row g-2">
            <div className="col-md-3">
              <label className="section-label">Control Name</label>
              <input
                className="form-control form-control-sm"
                placeholder="e.g. Control-201"
                value={form.control_name}
                onChange={update("control_name")}
              />
            </div>
            <div className="col-md-3">
              <label className="section-label">Control Type</label>
              <select
                className="form-select form-select-sm"
                value={form.control_type}
                onChange={update("control_type")}
              >
                {CONTROL_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="section-label">Baseline State</label>
              <select
                className="form-select form-select-sm"
                value={form.baseline_enabled}
                onChange={update("baseline_enabled")}
              >
                <option value="True">Enabled</option>
                <option value="False">Disabled</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="section-label">Current State</label>
              <select
                className="form-select form-select-sm"
                value={form.current_enabled}
                onChange={update("current_enabled")}
              >
                <option value="True">Enabled</option>
                <option value="False">Disabled</option>
              </select>
            </div>

            <div className="col-md-3">
              <label className="section-label">Change Reason</label>
              <select
                className="form-select form-select-sm"
                value={form.change_reason}
                onChange={update("change_reason")}
              >
                {CHANGE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="section-label">Pipeline Status</label>
              <select
                className="form-select form-select-sm"
                value={form.status}
                onChange={update("status")}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="section-label">Approver Name (optional)</label>
              <input
                className="form-control form-control-sm"
                placeholder="leave blank if unapproved"
                value={form.approver_name}
                onChange={update("approver_name")}
              />
            </div>
            <div className="col-md-3">
              <label className="section-label">Compliance Tag</label>
              <select
                className="form-select form-select-sm"
                value={form.compliance_impact}
                onChange={update("compliance_impact")}
              >
                {COMPLIANCE_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t || "(none)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger small mt-2 mb-0">{error}</div>
          )}

          {lastResult && (
            <div className="alert-success-custom small mt-2">
              Ingested as {lastResult.eventId} — scored{" "}
              <strong>{lastResult.riskScore}/100</strong> ({lastResult.severity}
              ). Check the incident feed.
            </div>
          )}

          <button
            type="submit"
            className="remediate-btn w-100 mt-3"
            disabled={submitting}
            style={{
              background: "linear-gradient(135deg, var(--sg-accent), #1f6feb)",
            }}
          >
            {submitting ? "Analyzing..." : "Submit for Risk Analysis"}
          </button>
        </form>
      )}
    </div>
  );
};

export default AddDriftEvent;
