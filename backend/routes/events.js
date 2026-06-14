const express = require("express");
const router = express.Router();
const DriftAlert = require("../models/DriftAlert");
const { analyzeCsvRow } = require("../utils/riskEngine");

router.post("/", async (req, res) => {
  try {
    const {
      control_name,
      control_type,
      baseline_value,
      current_value,
      change_type,
      operator_name,
      operator_email,
      approver_name,
      approver_email,
      change_reason,
      status,
      compliance_impact,
    } = req.body;

    if (!control_name || !control_type || !baseline_value || !current_value) {
      return res.status(400).json({
        error:
          "control_name, control_type, baseline_value, and current_value are required.",
      });
    }

    const row = {
      drift_event_id: `MANUAL-${Date.now()}`,
      control_name,
      control_type,
      baseline_value,
      current_value,
      change_type: change_type || "Modify",
      operator_name: operator_name || "Manual Entry",
      operator_email: operator_email || "manual@driftguard.local",
      approver_name: approver_name || "",
      approver_email: approver_email || "",
      change_date: new Date().toISOString(),
      change_reason: change_reason || "Policy Change",
      status: status || "Drifted",
      compliance_impact: compliance_impact || "",
    };

    const analysis = analyzeCsvRow(row);

    const alert = new DriftAlert({
      eventId: row.drift_event_id,
      systemId: row.control_type,
      systemName: row.control_name,
      environment: "Production",
      severity: analysis.severity,
      driftedKey: row.control_name,
      expectedValue: row.baseline_value,
      actualValue: row.current_value,
      complianceImpact: analysis.complianceImpact,
      changedBy: `${row.operator_name} (${row.operator_email})`,
      changeReason: row.change_reason,
      status: analysis.isAnomaly ? "Active Drift" : "Remediated",
      timestamp: new Date(),
      isAnomaly: analysis.isAnomaly,
      riskScore: analysis.riskScore,
      explanation: analysis.explanation,
      recommendedAction: analysis.recommendedAction,
    });

    await alert.save();
    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
