const fs = require("fs");
const csv = require("csv-parser");

const SEED_BATCH_SIZE = 40;
const DRIP_INTERVAL_MS = 4000;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rowToAlertDoc(row, analysis) {
  return {
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
    timestamp: row.change_date ? new Date(row.change_date) : new Date(),
    isAnomaly: analysis.isAnomaly,
    riskScore: analysis.riskScore,
    explanation: analysis.explanation,
    recommendedAction: analysis.recommendedAction,
  };
}

async function runFeedCycle(
  app,
  DriftAlert,
  analyzeCsvRow,
  csvPath,
  state,
  isFirstRun,
) {
  const rows = await new Promise((resolve, reject) => {
    const r = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row) => r.push(row))
      .on("error", reject)
      .on("end", () => resolve(r));
  });

  const queue = shuffle(rows);
  state.totalEvents = queue.length;
  state.ingestedCount = 0;
  state.status = "seeding";

  await DriftAlert.deleteMany({});

  const seedRows = queue.splice(0, Math.min(SEED_BATCH_SIZE, queue.length));
  const seedDocs = seedRows.map((row) =>
    rowToAlertDoc(row, analyzeCsvRow(row)),
  );
  await DriftAlert.insertMany(seedDocs);
  state.ingestedCount = seedDocs.length;
  state.status = "streaming";

  console.log(
    `LiveFeed: seeded ${seedDocs.length}, streaming ${queue.length} remaining at ${DRIP_INTERVAL_MS / 1000}s intervals`,
  );

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      if (queue.length === 0) {
        clearInterval(interval);
        state.status = "restarting";
        console.log("LiveFeed: cycle complete — restarting simulation");
        resolve();
        return;
      }
      try {
        const row = queue.shift();
        const analysis = analyzeCsvRow(row);
        await new DriftAlert(rowToAlertDoc(row, analysis)).save();
        state.ingestedCount += 1;
      } catch (err) {
        console.error("LiveFeed insert error:", err.message);
      }
    }, DRIP_INTERVAL_MS);
  });
}

function startLiveFeed(
  app,
  DriftAlert,
  analyzeCsvRow,
  csvPath = "./data/config_drift_events.csv",
) {
  const state = {
    status: "loading",
    totalEvents: 0,
    ingestedCount: 0,
    startedAt: new Date(),
    error: null,
  };

  app.get("/api/feed/status", (req, res) => {
    res.json({
      ...state,
      remaining: Math.max(state.totalEvents - state.ingestedCount, 0),
    });
  });

  async function loop() {
    try {
      while (true) {
        state.startedAt = new Date();
        await runFeedCycle(app, DriftAlert, analyzeCsvRow, csvPath, state);
      }
    } catch (err) {
      state.status = "error";
      state.error = err.message;
      console.error("LiveFeed startup error:", err);
    }
  }

  loop();
}

module.exports = { startLiveFeed };
