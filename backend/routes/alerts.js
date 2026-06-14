const express = require("express");
const router = express.Router();
const DriftAlert = require("../models/DriftAlert");

router.get("/", async (req, res) => {
  try {
    const alerts = await DriftAlert.find().sort({ timestamp: -1 });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/summary", async (req, res) => {
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

module.exports = router;
