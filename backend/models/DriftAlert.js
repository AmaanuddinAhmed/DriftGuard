const mongoose = require("mongoose");

const DriftAlertSchema = new mongoose.Schema({
  eventId: { type: String }, // Maps from drift_event_id
  systemId: { type: String, default: "SG-CORE-01" }, // Default so React frontend doesn't break
  systemName: { type: String }, // Maps from control_type (e.g., "Firewall")
  environment: { type: String, default: "Production" },
  severity: { type: String, default: "LOW" }, // Maps directly from severity
  driftedKey: { type: String, required: true }, // Maps from control_name
  expectedValue: { type: mongoose.Schema.Types.Mixed }, // Maps from baseline_value
  actualValue: { type: mongoose.Schema.Types.Mixed }, // Maps from current_value
  complianceImpact: { type: String }, // Maps from compliance_impact
  changedBy: { type: String }, // Maps from operator_name
  changeReason: { type: String }, // Maps from change_reason
  status: { type: String, default: "Active Drift" }, // Maps from status
  timestamp: { type: Date, default: Date.now }, // Maps from change_date

  // --- Risk engine enrichment fields ---
  isAnomaly: { type: Boolean, default: false },
  riskScore: { type: Number, default: 0 },
  explanation: { type: String },
  recommendedAction: { type: String },
});

module.exports = mongoose.model("DriftAlert", DriftAlertSchema);
