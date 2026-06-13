// riskEngine.js
// Independent drift analysis: takes a raw row from config_drift_events.csv
// and computes our OWN severity / anomaly verdict / explanation / remediation,
// instead of trusting the CSV's pre-filled `severity` column.

// Controls where being DISABLED is dangerous (security controls).
// Controls where being ENABLED (i.e. opening something up) is dangerous
// are handled separately via the "riskyDirection" map below.
const CONTROL_RISK_PROFILE = {
  Logging: {
    dangerousState: false,
    framework: "NIST AU-2 / SI-12",
    label: "audit logging",
  },
  Encryption: {
    dangerousState: false,
    framework: "NIST SC-13 / GDPR Art.32",
    label: "encryption",
  },
  Access_Control: {
    dangerousState: false,
    framework: "NIST AC-2 / IA-2",
    label: "access control / MFA enforcement",
  },
  DLP: {
    dangerousState: false,
    framework: "GDPR Art.25 / ISO 27001 A.13",
    label: "data loss prevention",
  },
  Data_Protection: {
    dangerousState: false,
    framework: "GDPR Art.32",
    label: "data protection control",
  },
  Network_Segmentation: {
    dangerousState: false,
    framework: "NIST AC-4 / CIS 3.1",
    label: "network segmentation",
  },
  Endpoint: {
    dangerousState: false,
    framework: "CIS 8 / NIST SI-3",
    label: "endpoint protection",
  },
  Cloud_Security: {
    dangerousState: false,
    framework: "CIS 2.1 / NIST CM-2",
    label: "cloud security baseline",
  },
  Firewall: {
    dangerousState: false,
    framework: "CIS 3.1 / NIST AC-4",
    label: "firewall control",
  },
  Vulnerability: {
    dangerousState: false,
    framework: "NIST RA-5 / CIS 7",
    label: "vulnerability management control",
  },
};

// Compliance code -> framework mapping. The dataset has some truncated codes
// (e.g. "IS" instead of "ISO", "NI" instead of "NIST") which we normalize here.
const COMPLIANCE_MAP = {
  ISO: "ISO 27001",
  IS: "ISO 27001",
  NIST: "NIST SP 800-53",
  NI: "NIST SP 800-53",
  GDPR: "GDPR",
  GD: "GDPR",
  CIS: "CIS Benchmarks",
  CI: "CIS Benchmarks",
  PCI: "PCI-DSS",
  PC: "PCI-DSS",
  "": "Internal Security Policy",
};

// Change reasons that represent a legitimate, planned, reviewable change.
const LEGITIMATE_REASONS = new Set(["Security Update", "Policy Change"]);
// Change reasons that often mask risky/temporary changes left in place.
const SUSPECT_REASONS = new Set([
  "Emergency Fix",
  "Troubleshooting",
  "Performance Tuning",
]);

// Parses "enabled=False" / "enabled=True" -> boolean (or null if unparseable)
function parseEnabled(value) {
  if (!value) return null;
  const match = String(value).match(/=\s*(true|false)/i);
  if (!match) return null;
  return match[1].toLowerCase() === "true";
}

function normalizeComplianceImpact(raw) {
  const key = (raw || "").trim();
  return COMPLIANCE_MAP[key] || COMPLIANCE_MAP[""];
}

/**
 * Core analysis function. Returns an enriched object that we attach
 * to each DriftAlert document at ingest time.
 */
function analyzeCsvRow(row) {
  const baselineEnabled = parseEnabled(row.baseline_value);
  const currentEnabled = parseEnabled(row.current_value);

  const isDrift =
    baselineEnabled !== null &&
    currentEnabled !== null &&
    baselineEnabled !== currentEnabled;

  const profile = CONTROL_RISK_PROFILE[row.control_type] || {
    dangerousState: false,
    framework: "General Security Policy",
    label: row.control_type || "security control",
  };

  const approved = !!row.approver_name && row.approver_name.trim().length > 0;
  const legitimateReason = LEGITIMATE_REASONS.has(row.change_reason);
  const suspectReason = SUSPECT_REASONS.has(row.change_reason);

  // --- Risk scoring ---------------------------------------------------
  let riskScore = 5; // baseline "nothing happened" score
  let isAnomaly = false;
  let severity = "LOW";
  let directionNote = "no effective change in control state";

  if (isDrift) {
    const turnedOff = currentEnabled === false; // control just got disabled
    const turnedOn = currentEnabled === true; // control just got enabled

    if (turnedOff) {
      // A protective control was switched off -> almost always risky.
      directionNote = `${profile.label} was switched OFF (was enabled in baseline)`;
      riskScore = 60;
      isAnomaly = true;

      if (suspectReason) riskScore += 25; // disabled "for troubleshooting" etc.
      if (!approved) riskScore += 15; // no approver on record

      if (
        row.control_type === "Logging" ||
        row.control_type === "Encryption" ||
        row.control_type === "Access_Control"
      ) {
        riskScore += 10; // these three are the "crown jewel" controls
      }
    } else if (turnedOn) {
      // A control flipping ON is usually a hardening / improvement,
      // UNLESS the control_type itself represents something that should
      // normally stay off (not the case for any control_type here, so
      // we treat "turned on" as benign-to-positive).
      directionNote = `${profile.label} was switched ON (was disabled in baseline) — likely a hardening change`;
      riskScore = 10;
      isAnomaly = false;

      // Still flag if it's completely undocumented / unapproved AND tagged
      // with a "Drifted" status by SG's own pipeline.
      if (!approved && row.status === "Drifted") {
        riskScore = 35;
        isAnomaly = true;
        directionNote += ", but it is unapproved and still flagged as Drifted";
      }
    }
  } else {
    // No effective drift between baseline and current value.
    riskScore = 5;
    isAnomaly = false;
  }

  // Status from SG's pipeline can still raise the score even with no
  // raw value change (e.g. something is still "Under_Review").
  if (row.status === "Drifted" && riskScore < 50) {
    riskScore = Math.max(riskScore, 45);
    isAnomaly = isAnomaly || riskScore >= 50;
  }

  riskScore = Math.min(100, riskScore);

  if (riskScore >= 80) severity = "CRITICAL";
  else if (riskScore >= 55) severity = "HIGH";
  else if (riskScore >= 30) severity = "MEDIUM";
  else severity = "LOW";

  // --- Explanation -----------------------------------------------------
  const approvalNote = approved
    ? `change was approved by ${row.approver_name}`
    : "no approver is on record for this change";

  const reasonNote = row.change_reason
    ? `logged reason: "${row.change_reason}"`
    : "no change reason logged";

  const explanation =
    `${row.control_name} (${row.control_type.replace(/_/g, " ")}) — ${directionNote}. ` +
    `${reasonNote}; ${approvalNote}. Current pipeline status: ${row.status}.`;

  // --- Compliance mapping ----------------------------------------------
  const complianceFramework = normalizeComplianceImpact(row.compliance_impact);
  const complianceImpact = isAnomaly
    ? `Potential violation of ${complianceFramework} — ${profile.framework}`
    : `${complianceFramework} reference (no active violation)`;

  // --- Remediation -------------------------------------------------------
  let recommendedAction;
  if (!isAnomaly) {
    recommendedAction = "No action required — control is at or above baseline.";
  } else if (currentEnabled === false) {
    recommendedAction = `Re-enable ${profile.label} immediately and restore baseline configuration for ${row.control_name}.`;
  } else {
    recommendedAction = `Review and document approval for ${row.control_name}; if unintended, revert to baseline value.`;
  }

  return {
    isDrift,
    isAnomaly,
    riskScore,
    severity,
    explanation,
    complianceImpact,
    complianceFramework,
    recommendedAction,
    approved,
  };
}

module.exports = { analyzeCsvRow, parseEnabled, normalizeComplianceImpact };
