const mongoose = require("mongoose");

const DriftAlertSchema = new mongoose.Schema({
  systemId: { type: String, required: true },
  systemName: { type: String, required: true },
  environment: { type: String, required: true },
  severity: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    default: "LOW",
  },
  driftedKey: { type: String, required: true }, // e.g., "mfaEnforced"
  expectedValue: { type: mongoose.Schema.Types.Mixed }, // e.g., true
  actualValue: { type: mongoose.Schema.Types.Mixed }, // e.g., false
  complianceImpact: { type: String, required: true }, // e.g., "NIST CM-2 / GDPR Art 32"
  status: {
    type: String,
    enum: ["Active Drift", "Remediated"],
    default: "Active Drift",
  },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DriftAlert", DriftAlertSchema);
