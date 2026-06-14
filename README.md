# DriftGuard

**Security Control Drift & Misconfiguration Detection**

DriftGuard is a full-stack monitoring dashboard that continuously ingests security configuration change events, independently scores each one for risk, and surfaces anomalous drifts with plain-English explanations, compliance mappings, and actionable remediation steps.

Built for Problem Statement 02 — Societe Generale Hackathon 2026.

---

## What It Does

Security controls change constantly. DriftGuard answers the question: _was this change risky, or routine?_

- Streams 1,000 real configuration change events from the provided dataset into MongoDB on startup, one event every 4 seconds — simulating a live monitoring pipeline.
- Each event is independently analyzed by a rule-based risk engine that compares baseline vs. current control state, adjusts for change reason, approval status, and control criticality, and produces a 0–100 risk score.
- The React dashboard polls for new events every 5 seconds and renders them with severity badges, a risk score bar, a "why this was flagged" explanation, compliance framework mapping (NIST/ISO/GDPR/PCI/CIS), and a one-click remediation action.
- Operators can manually inject new configuration change events through the dashboard and see them scored in real time.

---

## Detection Approach

For each configuration change event, the risk engine (`backend/utils/riskEngine.js`):

1. Parses `baseline_value` and `current_value` (`enabled=True/False`) to determine whether the control's state actually changed.
2. Classifies the **direction** of change — a protective control turning OFF is inherently risky; turning ON is treated as a hardening improvement unless it is both unapproved and still flagged as `Drifted`.
3. Adjusts risk score based on:
   - **Control criticality** — Logging, Encryption, and Access Control receive an additional weight boost as crown-jewel controls.
   - **Approval status** — unapproved changes score higher.
   - **Change reason** — `Emergency Fix`, `Troubleshooting`, and `Performance Tuning` are treated as suspect (often used to justify temporary changes that become permanent).
4. Maps the score to a severity band: `CRITICAL` (80+), `HIGH` (55+), `MEDIUM` (30+), `LOW`.
5. Generates a plain-English explanation, a compliance framework reference, and a specific remediation recommendation per event.

The engine does **not** trust the dataset's pre-filled `severity` column — every severity label in the dashboard is independently computed.

---

## Tech Stack

| Layer     | Technology                                           |
| --------- | ---------------------------------------------------- |
| Frontend  | React 18, Vite, Bootstrap 5                          |
| Backend   | Node.js, Express                                     |
| Database  | MongoDB, Mongoose                                    |
| Detection | Custom rule-based risk engine                        |
| Data      | SG-provided `config_drift_events.csv` (1,000 events) |

---

## Project Structure

```
DriftGuard/
├── backend/
│   ├── data/
│   │   └── config_drift_events.csv   # SG hackathon dataset
│   ├── models/
│   │   └── DriftAlert.js             # Mongoose schema
│   ├── routes/
│   │   ├── alerts.js                 # GET /api/alerts, GET /api/summary
│   │   ├── events.js                 # POST /api/events (manual entry)
│   │   └── remediate.js              # POST /api/remediate
│   ├── utils/
│   │   ├── riskEngine.js             # Core drift detection & scoring logic
│   │   └── liveFeed.js               # Startup simulation — streams events into DB
│   └── server.js                     # Express app entry point
└── frontend/
    └── src/
        ├── api/alerts.js             # API helpers
        ├── components/
        │   ├── MetricsBar.jsx        # Top-level KPI cards
        │   ├── IncidentFeed.jsx      # Scrollable alert list with filters
        │   ├── IncidentCard.jsx      # Single alert row
        │   ├── DriftInspector.jsx    # Detail panel — score, explanation, remediation
        │   └── AddDriftEvent.jsx     # Manual event injection form
        ├── App.jsx                   # Root layout and polling logic
        └── index.css                 # Dark theme design system
```

---

## Running Locally

**Prerequisites:** Node.js 18+, MongoDB running on `localhost:27017`

```bash
# 1. Clone the repo
git clone https://github.com/AmaanuddinAhmed/DriftGuard.git
cd DriftGuard

# 2. Start the backend
cd backend
npm install
node server.js
# MongoDB connects, live feed simulation starts automatically.
# Console: "LiveFeed: seeded 40 events, streaming 960 remaining at 4s intervals"

# 3. Start the frontend (new terminal)
cd ../frontend
npm install
npm run dev
# Open http://localhost:5173
```

The dashboard populates automatically — no manual data import step needed.

---

## API Reference

| Method | Endpoint           | Description                                                                                   |
| ------ | ------------------ | --------------------------------------------------------------------------------------------- |
| `GET`  | `/api/alerts`      | All drift alerts, sorted newest first                                                         |
| `GET`  | `/api/summary`     | Aggregate stats — anomaly rate, severity breakdown, compliance score, per-control-type counts |
| `GET`  | `/api/feed/status` | Live feed simulation progress                                                                 |
| `POST` | `/api/events`      | Manually inject a new configuration change event                                              |
| `POST` | `/api/remediate`   | Mark an active drift alert as remediated                                                      |

### POST /api/events — required fields

```json
{
  "control_name": "Control-201",
  "control_type": "Logging",
  "baseline_value": "enabled=True",
  "current_value": "enabled=False",
  "change_reason": "Performance Tuning",
  "approver_name": ""
}
```

---

## Compliance Coverage

| Framework      | Controls Mapped                                  |
| -------------- | ------------------------------------------------ |
| NIST SP 800-53 | AU-2, SI-12, SC-13, AC-2, AC-4, IA-2, CM-2, RA-5 |
| GDPR           | Article 25, Article 32                           |
| ISO 27001      | A.13                                             |
| CIS Benchmarks | 2.1, 3.1, 7, 8                                   |
| PCI-DSS        | General data protection controls                 |

---

## Deliverables

- [x] Drift detection engine with independent risk scoring
- [x] Live simulation pipeline (auto-starts on server launch)
- [x] React dashboard — severity filters, risk score bar, compliance mapping, remediation
- [x] Manual event injection with real-time risk scoring
- [x] `DriftGuard_Audit_Report.md` — 20+ flagged drifts with explanations
- [x] `DriftGuard_Data_Exploration.ipynb` — data exploration, severity/control-type charts, methodology
- [x] REST API with summary/aggregate endpoint
- [x] Remediation playbook (per control type, in audit report)
