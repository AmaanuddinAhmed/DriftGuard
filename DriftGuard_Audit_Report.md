# DriftGuard — Security Control Drift Audit Report

**Dataset:** `config_drift_events.csv` (Société Générale hackathon dataset)
**Total events analyzed:** 1,000
**Analysis engine:** DriftGuard Risk Engine (`backend/utils/riskEngine.js`)

---

## 1. Executive Summary

| Metric                                 | Value     |
| -------------------------------------- | --------- |
| Total configuration change events      | 1,000     |
| Flagged as anomalous (risky drift)     | 259 (26%) |
| Benign / hardening / no-effect changes | 741 (74%) |
| Overall Compliance Score               | **74%**   |

Severity breakdown (computed independently by the risk engine — not copied from the dataset's pre-filled `severity` column):

| Severity | Count |
| -------- | ----- |
| CRITICAL | 151   |
| HIGH     | 108   |
| MEDIUM   | 151   |
| LOW      | 590   |

---

## 2. Methodology

For each configuration change event, the engine:

1. **Parses** the `baseline_value` and `current_value` fields (format `enabled=True/False`) to determine whether the control's actual state changed.
2. **Classifies direction of change**:
   - A protective control turning **OFF** (e.g. logging, encryption, MFA, DLP, endpoint protection) is treated as inherently risky.
   - A protective control turning **ON** is treated as a hardening improvement, unless it is both unapproved _and_ still flagged `Drifted` by the source pipeline.
3. **Adjusts risk score** based on:
   - Whether the change has a recorded approver.
   - Whether the stated `change_reason` is a planned/legitimate one (Security Update, Policy Change) vs. a suspect one (Emergency Fix, Troubleshooting, Performance Tuning) often used to mask temporary-turned-permanent changes.
   - Whether the control is one of the three "crown jewel" categories (Logging, Encryption, Access Control), which receive an extra severity boost.
4. **Maps the result** to a 0–100 risk score, then to a severity band:
   - 80–100 → CRITICAL
   - 55–79 → HIGH
   - 30–54 → MEDIUM
   - 0–29 → LOW
5. **Generates an explanation** in plain English describing what changed, why (per the logged reason), who approved it, and the pipeline status.
6. **Maps compliance impact** to the relevant framework (NIST SP 800-53, ISO 27001, GDPR, PCI-DSS, CIS Benchmarks), normalizing truncated codes present in the source data (e.g. `IS` → ISO 27001, `NI` → NIST).
7. **Generates a remediation recommendation** specific to the control and drift direction.

### Note on self-evaluation

The provided dataset does not include a `config_drift_labels.csv` ground-truth file (no `is_anomaly` / `anomaly_type` columns were present in the data we received). As a result, precision/recall against ground truth could not be computed. The detection logic above is fully rule-based and transparent by design — every flagged event carries an explanation tying it back to a specific rule, rather than a black-box score.

---

## 3. Drift Hotspots by Control Category

| Control Type         | Total Events | Anomalies Flagged | Anomaly Rate |
| -------------------- | ------------ | ----------------- | ------------ |
| Vulnerability        | 124          | 31                | 25%          |
| DLP                  | 101          | 31                | 31%          |
| Endpoint             | 100          | 29                | 29%          |
| Data Protection      | 101          | 27                | 27%          |
| Firewall             | 99           | 26                | 26%          |
| Logging              | 111          | 25                | 23%          |
| Cloud Security       | 101          | 24                | 24%          |
| Network Segmentation | 81           | 24                | 30%          |
| Encryption           | 82           | 21                | 26%          |
| Access Control       | 100          | 21                | 21%          |

DLP and Network Segmentation show the highest proportional anomaly rates, while Vulnerability management contributes the largest absolute count of flagged events.

---

## 4. Sample High-Risk Drifts (CRITICAL, Risk Score ≥ 85)

### DRF00550 — Control-66 (Logging) · Risk Score: 95/100

**Explanation:** Audit logging was switched OFF (was enabled in baseline). Logged reason: "Performance Tuning"; change was approved by Leila Anderson. Current pipeline status: Mitigated.
**Compliance Impact:** Potential violation of NIST SP 800-53 (NIST AU-2 / SI-12)
**Recommended Action:** Re-enable audit logging immediately and restore baseline configuration for Control-66.

### DRF00676 — Control-57 (Access Control) · Risk Score: 95/100

**Explanation:** Access control / MFA enforcement was switched OFF (was enabled in baseline). Logged reason: "Performance Tuning"; change was approved by Pooja Kelly. Current pipeline status: Compliant.
**Compliance Impact:** Potential violation of CIS Benchmarks (NIST AC-2 / IA-2)
**Recommended Action:** Re-enable access control / MFA enforcement immediately and restore baseline configuration for Control-57.

### DRF00703 — Control-1 (Encryption) · Risk Score: 95/100

**Explanation:** Encryption was switched OFF (was enabled in baseline). Logged reason: "Emergency Fix"; change was approved by Brian Gupta. Current pipeline status: Mitigated.
**Compliance Impact:** Potential violation of NIST SP 800-53 (NIST SC-13 / GDPR Art.32)
**Recommended Action:** Re-enable encryption immediately and restore baseline configuration for Control-1.

### DRF00684 — Control-82 (Endpoint) · Risk Score: 85/100

**Explanation:** Endpoint protection was switched OFF (was enabled in baseline). Logged reason: "Troubleshooting"; change was approved by Larry Williams. Current pipeline status: Under_Review.
**Compliance Impact:** Potential violation of GDPR (CIS 8 / NIST SI-3)
**Recommended Action:** Re-enable endpoint protection immediately and restore baseline configuration for Control-82.

### DRF00560 — Control-48 (Data Protection) · Risk Score: 85/100

**Explanation:** Data protection control was switched OFF (was enabled in baseline). Logged reason: "Emergency Fix"; change was approved by Larry Lopez. Current pipeline status: Mitigated.
**Compliance Impact:** Potential violation of PCI-DSS (GDPR Art.32)
**Recommended Action:** Re-enable data protection control immediately and restore baseline configuration for Control-48.

### DRF00659 — Control-99 (Vulnerability) · Risk Score: 85/100

**Explanation:** Vulnerability management control was switched OFF (was enabled in baseline). Logged reason: "Performance Tuning"; change was approved by Sofia Robinson. Current pipeline status: Mitigated.
**Compliance Impact:** Potential violation of NIST SP 800-53 (NIST RA-5 / CIS 7)
**Recommended Action:** Re-enable vulnerability management control immediately and restore baseline configuration for Control-99.

---

## 5. Key Observations

- **Approval ≠ Safe.** All six CRITICAL examples above were _approved_, yet each represents a protective control being disabled — often justified by "Performance Tuning" or "Emergency Fix." This is precisely the pattern described in the problem statement's real-world incident cases: temporary, approved changes that leave critical controls disabled.
- **"Crown jewel" controls dominate the top risk scores.** Logging, Encryption, and Access Control consistently score 95/100 when disabled, reflecting their outsized impact on breach detection and data confidentiality.
- **Reason codes are a strong signal.** "Performance Tuning," "Troubleshooting," and "Emergency Fix" account for a disproportionate share of high-risk drifts — these are exactly the categories the problem statement flags as "temporary changes that become permanent."

---

## 6. Remediation Playbook (by Control Type)

| Control Type Disabled    | Immediate Action                                                  | Compliance Reference         |
| ------------------------ | ----------------------------------------------------------------- | ---------------------------- |
| Logging                  | Re-enable audit logging; review logs for the gap window           | NIST AU-2 / SI-12            |
| Encryption               | Restore encryption to baseline algorithm/strength                 | NIST SC-13, GDPR Art. 32     |
| Access Control / MFA     | Re-enable MFA enforcement; audit recent logins during gap         | NIST AC-2 / IA-2             |
| DLP                      | Restore DLP policy; scan for data exfiltration during gap         | GDPR Art. 25, ISO 27001 A.13 |
| Data Protection          | Restore control; verify no sensitive data was exposed             | GDPR Art. 32                 |
| Network Segmentation     | Restore segmentation rules; audit lateral traffic during gap      | NIST AC-4, CIS 3.1           |
| Endpoint Protection      | Re-enable; run full scan on affected endpoint                     | CIS 8, NIST SI-3             |
| Cloud Security Baseline  | Restore baseline policy via IaC; check for unauthorized resources | CIS 2.1, NIST CM-2           |
| Firewall                 | Restore firewall rule; review traffic logs for the open window    | CIS 3.1, NIST AC-4           |
| Vulnerability Management | Re-enable scanning; run immediate scan to catch missed window     | NIST RA-5, CIS 7             |

---

## 7. Limitations & Scaling Notes

- The current engine uses transparent, rule-based heuristics rather than ML (isolation forests / autoencoders), which keeps it explainable and fast (1,000 events processed in well under a second), but means novel drift patterns outside the encoded rules won't be caught.
- `baseline_configs.json` (5 reference controls) was provided separately from the 1,000-event drift log and uses a different schema; the current engine derives baselines directly from each event's own `baseline_value`/`current_value` pair rather than cross-referencing this file.
- For production scale (10,000+ daily changes across 200+ controls), the same per-row analysis function can be applied in a streaming fashion (e.g. on each webhook from Terraform/Ansible/cloud config APIs) without architectural changes — the engine is O(1) per event.
