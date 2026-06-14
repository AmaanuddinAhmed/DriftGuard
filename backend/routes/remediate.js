const express = require("express");
const router = express.Router();
const DriftAlert = require("../models/DriftAlert");

router.post("/", async (req, res) => {
  try {
    const { systemId, driftedKey } = req.body;

    if (!systemId || !driftedKey) {
      return res
        .status(400)
        .json({ error: "Missing systemId or driftedKey parameters." });
    }

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
      message: `Remediation successful. '${driftedKey}' has been restored to baseline.`,
      remediatedAlert: updatedAlert,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Remediation failed", details: error.message });
  }
});

module.exports = router;
