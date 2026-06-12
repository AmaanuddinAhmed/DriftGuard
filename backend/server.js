const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { detailedDiff } = require("deep-object-diff");

const DriftAlert = require("./models/DriftAlert");
const firewallBaseline = require("./baselines/firewall-baseline.json");

const app = express();
app.use(express.json());
app.use(cors());

// REPLACE THIS with your local or remote MongoDB string
const MONGO_URI = "mongodb://127.0.0.1:27017/driftguard";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB successfully"))
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

// Route for your friend to fetch all active alerts onto the React UI
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
      return res
        .status(404)
        .json({
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
