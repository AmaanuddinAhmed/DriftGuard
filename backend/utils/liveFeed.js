// liveFeed.js
// Simulates a continuous monitoring pipeline: on server start, clears
// existing alerts, seeds the dashboard with an initial batch so it isn't
// empty, then drips in the remaining events from config_drift_events.csv
// one at a time on an interval — each one passed through the same
// analyzeCsvRow risk engine used by the manual ingest route.

const fs = require("fs");
const csv = require("csv-parser");

const SEED_BATCH_SIZE = 40; // events inserted immediately on startup
const DRIP_INTERVAL_MS = 4000; // time between subsequent events

// Fisher-Yates shuffle
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

/**
 * Starts the live feed simulation.
 *
 * @param {object} app - Express app (used to register /api/feed/status)
 * @param {object} DriftAlert - Mongoose model
 * @param {function} analyzeCsvRow - risk engine analysis function
 * @param {string} csvPath - path to config_drift_events.csv
 */
function startLiveFeed(
  app,
  DriftAlert,
  analyzeCsvRow,
  csvPath = "./data/config_drift_events.csv",
) {
  const state = {
    status: "loading", // loading | seeding | streaming | complete | error
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

  const rows = [];
  fs.createReadStream(csvPath)
    .pipe(csv())
    .on("data", (row) => rows.push(row))
    .on("error", (err) => {
      state.status = "error";
      state.error = err.message;
      console.error("LiveFeed: failed to read CSV", err);
    })
    .on("end", async () => {
      try {
        const queue = shuffle(rows);
        state.totalEvents = queue.length;
        state.status = "seeding";

        // Clear out any previously ingested data so the simulation starts fresh.
        await DriftAlert.deleteMany({});

        // Seed an initial batch so the dashboard isn't empty on first load.
        const seedRows = queue.splice(
          0,
          Math.min(SEED_BATCH_SIZE, queue.length),
        );
        const seedDocs = seedRows.map((row) =>
          rowToAlertDoc(row, analyzeCsvRow(row)),
        );
        await DriftAlert.insertMany(seedDocs);
        state.ingestedCount = seedDocs.length;
        state.status = "streaming";

        console.log(
          `LiveFeed: seeded ${seedDocs.length} events, streaming remaining ${queue.length} every ${DRIP_INTERVAL_MS / 1000}s`,
        );

        const interval = setInterval(async () => {
          if (queue.length === 0) {
            state.status = "complete";
            clearInterval(interval);
            console.log("LiveFeed: simulation complete — all events ingested.");
            return;
          }

          const row = queue.shift();
          try {
            const analysis = analyzeCsvRow(row);
            const doc = rowToAlertDoc(row, analysis);
            await new DriftAlert(doc).save();
            state.ingestedCount += 1;
          } catch (err) {
            console.error("LiveFeed: failed to insert event", err.message);
          }
        }, DRIP_INTERVAL_MS);
      } catch (err) {
        state.status = "error";
        state.error = err.message;
        console.error("LiveFeed: startup failed", err);
      }
    });
}

module.exports = { startLiveFeed };
