const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const DriftAlert = require("./models/DriftAlert");
const { analyzeCsvRow } = require("./utils/riskEngine");
const { startLiveFeed } = require("./utils/liveFeed");

const alertRoutes = require("./routes/alerts");
const eventRoutes = require("./routes/events");
const remediateRoutes = require("./routes/remediate");

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/driftguard";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    startLiveFeed(app, DriftAlert, analyzeCsvRow);
  })
  .catch((err) => console.error("MongoDB connection error:", err));

app.get("/", (req, res) => res.send("DriftGuard API running."));
app.use("/api/alerts", alertRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/remediate", remediateRoutes);

const PORT = 5000;
app.listen(PORT, () => console.log(`DriftGuard running on port ${PORT}`));
