const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { detailedDiff } = require("deep-object-diff");
const fs = require("fs");
const csv = require("csv-parser");

const assetBaselines = require("./data/baseline_configs.json");
const firewallBaseline = require("./baselines/firewall-baseline.json");
const DriftAlert = require("./models/DriftAlert");
const { analyzeCsvRow } = require("./utils/riskEngine");
const { startLiveFeed } = require("./utils/liveFeed");

const app = express();
app.use(express.json());
app.use(cors());

// REPLACE THIS with your local or remote MongoDB string
const MONGO_URI = "mongodb://127.0.0.1:27017/driftguard";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully");
    startLiveFeed(app, DriftAlert, analyzeCsvRow);
  })
  .catch((err) => console.error("MongoDB Connection Failure:", err));

// Quick sanity check route
app.get("/", (req, res) => {
  res.send("DriftGuard Backend Is Running.");
});

// Route to ingest configuration data and check for variations
app.post("/api/monitor/config", async (req, res) => {
  try {
    const currentDeviceState = req.body;

    // 1. Calculate structural differences using deep-object-diff
    const diff = detailedDiff(firewallBaseline, currentDeviceState);

    // Check if any parameters were modified
    const modifiedKeys = Object.keys(diff.updated);

    if (modifiedKeys.length === 0) {
      return res
        .status(200)
        .json({ message: "Config matches baseline. System secure." });
    }

    let detectedAlerts = [];

    // 2. Security Assessment Logic Loop
    for (const key of modifiedKeys) {
      let severity = "LOW";
      let complianceImpact = "General Posture Degradation";
      const actualVal = diff.updated[key];
      const expectedVal = firewallBaseline[key];

      // Custom rule matching based on Problem Statement specifications
      if (key === "allowAllTraffic" && actualVal === true) {
        severity = "CRITICAL";
        complianceImpact = "Firewall Bypass Risk (NIST CM-2 / CIS 1.1)";
      } else if (key === "mfaEnforced" && actualVal === false) {
        severity = "CRITICAL";
        complianceImpact = "Broken Authentication Scheme (GDPR Article 32)";
      } else if (key === "loggingStatus" && actualVal === "disabled") {
        severity = "HIGH";
        complianceImpact = "Audit Trail Blindspot (NIST AC-2)";
      } else if (key === "encryptionLevel" && actualVal !== "TLSv1.3") {
        severity = "MEDIUM";
        complianceImpact = "Cryptographic Downgrade Attack Vector";
      }

      // Create a document record payload
      const newAlert = new DriftAlert({
        systemId: firewallBaseline.systemId,
        systemName: firewallBaseline.systemName,
        environment: firewallBaseline.environment,
        severity,
        driftedKey: key,
        expectedValue: expectedVal,
        actualValue: actualVal,
        complianceImpact,
      });

      const savedAlert = await newAlert.save();
      detectedAlerts.push(savedAlert);
    }

    res.status(201).json({
      message: "Drift detected and logged!",
      alerts: detectedAlerts,
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal Engine processing error",
      details: error.message,
    });
  }
});

// Route to instantly ingest the SG hackathon CSV data
app.post("/api/admin/ingest-csv", (req, res) => {
  const results = [];
  let insertedCount = 0;

  // Make sure your config_drift_events.csv is inside the /data folder!
  fs.createReadStream("./data/config_drift_events.csv")
    .pipe(csv())
    .on("data", (row) => {
      results.push(row);
    })
    .on("end", async () => {
      console.log(
        `Parsed ${results.length} rows from SG CSV. Pushing to database...`,
      );

      // Clear the old dummy data out before importing the real hackathon data
      await DriftAlert.deleteMany({});

      for (const event of results) {
        const analysis = analyzeCsvRow(event);

        // Map SG's exact CSV headers to our Mongoose Schema, enriched
        // with our own risk-engine output (severity/explanation/etc.)
        const newAlert = new DriftAlert({
          eventId: event.drift_event_id,
          systemId: event.control_type, // group controls by category for the dashboard
          systemName: event.control_name,
          environment: "Production",
          severity: analysis.severity, // computed by riskEngine, NOT copied from CSV
          driftedKey: event.control_name,
          expectedValue: event.baseline_value,
          actualValue: event.current_value,
          complianceImpact: analysis.complianceImpact,
          changedBy: `${event.operator_name} (${event.operator_email})`,
          changeReason: event.change_reason,
          status: analysis.isAnomaly ? "Active Drift" : "Remediated",
          timestamp: event.change_date
            ? new Date(event.change_date)
            : Date.now(),
          isAnomaly: analysis.isAnomaly,
          riskScore: analysis.riskScore,
          explanation: analysis.explanation,
          recommendedAction: analysis.recommendedAction,
        });

        await newAlert.save();
        insertedCount++;
      }

      res.status(200).json({
        message: "Official Societe Generale Dataset successfully ingested!",
        totalProcessed: insertedCount,
      });
    });
});

// Aggregate stats for the presentation/report and top-level dashboard cards
app.get("/api/summary", async (req, res) => {
  try {
    const total = await DriftAlert.countDocuments();
    const anomalies = await DriftAlert.countDocuments({ isAnomaly: true });
    const severityBreakdown = await DriftAlert.aggregate([
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]);
    const byControlType = await DriftAlert.aggregate([
      {
        $group: {
          _id: "$systemId",
          count: { $sum: 1 },
          anomalies: { $sum: { $cond: ["$isAnomaly", 1, 0] } },
        },
      },
      { $sort: { anomalies: -1 } },
    ]);
    const complianceScore = total
      ? Math.round(((total - anomalies) / total) * 100)
      : 100;

    res.json({
      totalEvents: total,
      anomalies,
      anomalyRate: total ? Math.round((anomalies / total) * 100) : 0,
      complianceScore,
      severityBreakdown,
      byControlType,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route for the operator to manually log a new configuration change.
// Runs through the SAME risk engine as the CSV ingest pipeline.
app.post("/api/events", async (req, res) => {
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

    const newAlert = new DriftAlert({
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

    await newAlert.save();
    res.status(201).json(newAlert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/alerts", async (req, res) => {
  try {
    const alerts = await DriftAlert.find().sort({ timestamp: -1 });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to trigger auto-remediation and overwrite/fix the system configuration
app.post("/api/remediate", async (req, res) => {
  try {
    const { systemId, driftedKey } = req.body;

    if (!systemId || !driftedKey) {
      return res
        .status(400)
        .json({ error: "Missing systemId or driftedKey parameters." });
    }

    // 1. In a real-world scenario, this is where your backend would fire an Ansible Playbook,
    // an AWS Systems Manager document, or an API call to revert the config back to the baseline.
    // For our hackathon simulation, we mark the database state as 'Remediated'.

    const updatedAlert = await DriftAlert.findOneAndUpdate(
      { systemId, driftedKey, status: "Active Drift" },
      { $set: { status: "Remediated" } },
      { new: true },
    );

    if (!updatedAlert) {
      return res.status(404).json({
        message:
          "No active drift alert found for this configuration parameter.",
      });
    }

    res.status(200).json({
      message: `System remediation successful. Parameter '${driftedKey}' has been forced back to its gold baseline.`,
      remediatedAlert: updatedAlert,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Remediation routine failed", details: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`DriftGuard Server active on port ${PORT}`);
});
