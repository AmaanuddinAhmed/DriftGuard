# DriftGuard — Testing Checklist & Expected Outputs

---

## 1. Backend Startup

**Steps:**

1. Ensure MongoDB is running (`mongod` or check your service)
2. `cd backend && node server.js`

**Expected console output:**

```
DriftGuard running on port 5000
Connected to MongoDB
LiveFeed: seeded 40 events, streaming 960 remaining at 4s intervals
```

**Checks:**

- [ ] No `MongoServerError` or connection refused
- [ ] "seeded 40 events" line appears within 3 seconds
- [ ] No `MODULE_NOT_FOUND` errors (all routes/utils imported correctly)

---

## 2. Live Feed Simulation

**Steps:**

1. Wait 15–20 seconds after backend starts
2. `GET http://localhost:5000/api/feed/status`

**Expected response:**

```json
{
  "status": "streaming",
  "totalEvents": 1000,
  "ingestedCount": 44,
  "remaining": 956,
  "startedAt": "..."
}
```

**Checks:**

- [ ] `status` is `"streaming"` (not `"error"` or `"loading"`)
- [ ] `ingestedCount` increases by 1 every ~4 seconds on repeated calls
- [ ] `totalEvents` is exactly `1000`

---

## 3. Alerts API

**Steps:**

1. `GET http://localhost:5000/api/alerts`

**Expected response:** Array of alert objects, newest first. Each should have:

```json
{
  "_id": "...",
  "severity": "CRITICAL",
  "isAnomaly": true,
  "riskScore": 95,
  "explanation": "Control-XX (Logging) — audit logging was switched OFF...",
  "recommendedAction": "Re-enable audit logging immediately...",
  "complianceImpact": "Potential violation of NIST SP 800-53 — NIST AU-2 / SI-12",
  "status": "Active Drift"
}
```

**Checks:**

- [ ] Response is an array (not an error object)
- [ ] At least one alert has `severity: "CRITICAL"`
- [ ] `riskScore` is a number between 0 and 100
- [ ] `explanation` is a non-empty string
- [ ] `recommendedAction` is a non-empty string
- [ ] `isAnomaly: true` alerts have `status: "Active Drift"`
- [ ] `isAnomaly: false` alerts have `status: "Remediated"`

---

## 4. Summary API

**Steps:**

1. `GET http://localhost:5000/api/summary`

**Expected response:**

```json
{
  "totalEvents": 44,
  "anomalies": 11,
  "anomalyRate": 25,
  "complianceScore": 75,
  "severityBreakdown": [...],
  "byControlType": [...]
}
```

**Checks:**

- [ ] `anomalyRate` is between 20–30% (consistent with full dataset)
- [ ] `severityBreakdown` contains all four severity bands
- [ ] `byControlType` has 10 entries (one per control type)
- [ ] `complianceScore` + `anomalyRate` ≈ 100 (they're inverses)

---

## 5. Manual Event Injection

**Steps:**

1. `POST http://localhost:5000/api/events` with body:

```json
{
  "control_name": "Test-Control-001",
  "control_type": "Logging",
  "baseline_value": "enabled=True",
  "current_value": "enabled=False",
  "change_reason": "Performance Tuning",
  "approver_name": ""
}
```

**Expected response (HTTP 201):**

```json
{
  "severity": "CRITICAL",
  "riskScore": 95,
  "isAnomaly": true,
  "explanation": "Test-Control-001 (Logging) — audit logging was switched OFF...",
  "recommendedAction": "Re-enable audit logging immediately..."
}
```

**Checks:**

- [ ] HTTP status is `201`
- [ ] `severity` is `"CRITICAL"` (Logging + Performance Tuning + no approver = 95/100)
- [ ] `isAnomaly` is `true`
- [ ] Alert appears at top of `/api/alerts` response

**Negative test — hardening change:**

```json
{
  "control_name": "Test-Control-002",
  "control_type": "Encryption",
  "baseline_value": "enabled=False",
  "current_value": "enabled=True",
  "change_reason": "Security Update",
  "approver_name": "Admin"
}
```

- [ ] `severity` is `"LOW"`, `isAnomaly` is `false` (control turned ON = hardening)

---

## 6. Remediation

**Steps:**

1. Note the `systemId` and `driftedKey` of any `"Active Drift"` alert from `/api/alerts`
2. `POST http://localhost:5000/api/remediate` with:

```json
{
  "systemId": "Logging",
  "driftedKey": "Control-69"
}
```

**Expected response (HTTP 200):**

```json
{
  "message": "Remediation successful. 'Control-69' has been restored to baseline.",
  "remediatedAlert": { "status": "Remediated", ... }
}
```

**Checks:**

- [ ] HTTP status is `200`
- [ ] `remediatedAlert.status` is `"Remediated"`
- [ ] Calling `/api/alerts` again shows the alert with `status: "Remediated"`
- [ ] Calling `/api/summary` shows compliance score increased by ~1%

---

## 7. Frontend — Dashboard

**Steps:**

1. `cd frontend && npm run dev`
2. Open `http://localhost:5173`

**Checks:**

- [ ] Header shows "LIVE — streaming X/1000 events" and counter ticks up every 5s
- [ ] MetricsBar shows 6 cards: Systems Tracked, Active Critical Drifts, Remediation Events, Compliance Score, Events Analyzed, Detected Anomaly Rate
- [ ] Baseline Integrity strip shows colored segments (red = drifted, green = compliant)
- [ ] Active Incidents Feed has alerts visible, sorted CRITICAL first
- [ ] New alerts appear in the feed every few seconds with a slide-in animation

---

## 8. Frontend — Filters

**Steps:**

1. Select `CRITICAL` from severity dropdown
2. Select `Active Drift` from status dropdown
3. Select a combination that should return zero results (e.g. LOW + Active Drift if none exist)

**Checks:**

- [ ] Feed updates immediately on filter change
- [ ] Counter shows `X / total` correctly (e.g. `42 / 738`)
- [ ] Empty state message appears when no alerts match filters

---

## 9. Frontend — Drift Inspector

**Steps:**

1. Click any CRITICAL alert in the incident feed

**Checks:**

- [ ] Inspector panel shows control name, type, environment
- [ ] Configuration diff shows `- expected` and `+ actual` values
- [ ] Risk Score bar fills proportionally (red for high scores)
- [ ] "Why This Was Flagged" section shows a plain-English explanation
- [ ] "Compliance Impact" chip is visible
- [ ] "Recommended Action" text is visible
- [ ] "Execute Auto-Remediation" button is active (red)
- [ ] Clicking remediation button changes status to "Remediated" and button becomes disabled

---

## 10. Frontend — Manual Event Injection

**Steps:**

1. Click "+ Log New Drift Event" to expand the form
2. Fill in: Control Name = `Live-Test-001`, Control Type = `Access Control`, Baseline = Enabled, Current = Disabled, Reason = `Emergency Fix`, leave Approver blank
3. Click "Submit for Risk Analysis"

**Expected:**

- [ ] Green success message appears: "Ingested as MANUAL-XXXX — scored 95/100 (CRITICAL)"
- [ ] New alert appears at top of CRITICAL Active Drift alerts in the feed
- [ ] Clicking it in the feed shows full explanation and remediation in the inspector

---

## 11. Edge Cases

**Validation:**

1. Submit the manual form with Control Name blank

- [ ] Error message appears, no API call made

2. `POST /api/remediate` with a `systemId` that has no active drifts

- [ ] HTTP 404 with `"No active drift alert found..."` message

3. `POST /api/events` missing required fields

- [ ] HTTP 400 with specific error message

---

## Summary Checklist

| Area                                                                                   | Status |
| -------------------------------------------------------------------------------------- | ------ |
| Backend starts and connects to MongoDB                                                 | ☐      |
| Live feed simulation streams events                                                    | ☐      |
| Risk engine scores correctly (CRITICAL for disabled Logging/Encryption/Access Control) | ☐      |
| Hardening changes score LOW                                                            | ☐      |
| Summary API returns correct aggregates                                                 | ☐      |
| Remediation flips status and updates compliance score                                  | ☐      |
| Dashboard loads and populates automatically                                            | ☐      |
| Live counter ticks up in header                                                        | ☐      |
| Filters work correctly                                                                 | ☐      |
| Inspector shows explanation + compliance + remediation                                 | ☐      |
| Manual injection scores in real time                                                   | ☐      |
| Edge cases return correct HTTP status codes                                            | ☐      |
