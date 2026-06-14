const CONTROL_RISK_PROFILE = {
  Logging: { framework: "NIST AU-2 / SI-12", label: "audit logging" },
  Encryption: { framework: "NIST SC-13 / GDPR Art.32", label: "encryption" },
  Access_Control: {
    framework: "NIST AC-2 / IA-2",
    label: "access control / MFA enforcement",
  },
  DLP: {
    framework: "GDPR Art.25 / ISO 27001 A.13",
    label: "data loss prevention",
  },
  Data_Protection: {
    framework: "GDPR Art.32",
    label: "data protection control",
  },
  Network_Segmentation: {
    framework: "NIST AC-4 / CIS 3.1",
    label: "network segmentation",
  },
  Endpoint: { framework: "CIS 8 / NIST SI-3", label: "endpoint protection" },
  Cloud_Security: {
    framework: "CIS 2.1 / NIST CM-2",
    label: "cloud security baseline",
  },
  Firewall: { framework: "CIS 3.1 / NIST AC-4", label: "firewall control" },
  Vulnerability: {
    framework: "NIST RA-5 / CIS 7",
    label: "vulnerability management control",
  },
};

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

const SUSPECT_REASONS = new Set([
  "Emergency Fix",
  "Troubleshooting",
  "Performance Tuning",
]);
const CROWN_JEWELS = new Set(["Logging", "Encryption", "Access_Control"]);

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

function analyzeCsvRow(row) {
  const baselineEnabled = parseEnabled(row.baseline_value);
  const currentEnabled = parseEnabled(row.current_value);

  const isDrift =
    baselineEnabled !== null &&
    currentEnabled !== null &&
    baselineEnabled !== currentEnabled;

  const profile = CONTROL_RISK_PROFILE[row.control_type] || {
    framework: "General Security Policy",
    label: row.control_type || "security control",
  };

  const approved = !!row.approver_name && row.approver_name.trim().length > 0;
  const suspectReason = SUSPECT_REASONS.has(row.change_reason);

  let riskScore = 5;
  let isAnomaly = false;
  let severity = "LOW";
  let directionNote = "no effective change in control state";

  if (isDrift) {
    if (currentEnabled === false) {
      directionNote = `${profile.label} was switched OFF (was enabled in baseline)`;
      riskScore = 60;
      isAnomaly = true;
      if (suspectReason) riskScore += 25;
      if (!approved) riskScore += 15;
      if (CROWN_JEWELS.has(row.control_type)) riskScore += 10;
    } else {
      directionNote = `${profile.label} was switched ON (was disabled in baseline) — likely a hardening change`;
      riskScore = 10;
      if (!approved && row.status === "Drifted") {
        riskScore = 35;
        isAnomaly = true;
        directionNote += ", but it is unapproved and still flagged as Drifted";
      }
    }
  }

  if (row.status === "Drifted" && riskScore < 50) {
    riskScore = Math.max(riskScore, 45);
    isAnomaly = isAnomaly || riskScore >= 50;
  }

  riskScore = Math.min(100, riskScore);

  if (riskScore >= 80) severity = "CRITICAL";
  else if (riskScore >= 55) severity = "HIGH";
  else if (riskScore >= 30) severity = "MEDIUM";

  const approvalNote = approved
    ? `change was approved by ${row.approver_name}`
    : "no approver is on record for this change";

  const reasonNote = row.change_reason
    ? `logged reason: "${row.change_reason}"`
    : "no change reason logged";

  const explanation =
    `${row.control_name} (${row.control_type.replace(/_/g, " ")}) — ${directionNote}. ` +
    `${reasonNote}; ${approvalNote}. Current pipeline status: ${row.status}.`;

  const complianceFramework = normalizeComplianceImpact(row.compliance_impact);
  const complianceImpact = isAnomaly
    ? `Potential violation of ${complianceFramework} — ${profile.framework}`
    : `${complianceFramework} reference (no active violation)`;

  const recommendedAction = !isAnomaly
    ? "No action required — control is at or above baseline."
    : currentEnabled === false
      ? `Re-enable ${profile.label} immediately and restore baseline configuration for ${row.control_name}.`
      : `Review and document approval for ${row.control_name}; if unintended, revert to baseline value.`;

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
