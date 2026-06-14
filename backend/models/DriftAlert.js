const mongoose = require("mongoose");

const DriftAlertSchema = new mongoose.Schema({
  eventId: { type: String },
  systemId: { type: String, default: "SG-CORE-01" },
  systemName: { type: String },
  environment: { type: String, default: "Production" },
  severity: { type: String, default: "LOW" },
  driftedKey: { type: String, required: true },
  expectedValue: { type: mongoose.Schema.Types.Mixed },
  actualValue: { type: mongoose.Schema.Types.Mixed },
  complianceImpact: { type: String },
  changedBy: { type: String },
  changeReason: { type: String },
  status: { type: String, default: "Active Drift" },
  timestamp: { type: Date, default: Date.now },
  isAnomaly: { type: Boolean, default: false },
  riskScore: { type: Number, default: 0 },
  explanation: { type: String },
  recommendedAction: { type: String },
});

module.exports = mongoose.model("DriftAlert", DriftAlertSchema);
