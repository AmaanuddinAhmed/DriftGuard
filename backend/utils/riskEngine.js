// Helper to clean messy CSV strings (handles spaces, caps, and boolean stringification)
const normalize = (val) => {
  if (val === undefined || val === null) return "";
  return String(val).trim().toLowerCase();
};

const evaluateDrift = (
  controlName,
  expectedValue,
  actualValue,
  reason,
  operator,
  csvSeverity,
) => {
  const key = normalize(controlName);
  const actualStr = normalize(actualValue);
  const expectedStr = normalize(expectedValue);
  const reasonStr = normalize(reason);
  const providedSeverity = String(csvSeverity || "LOW").toUpperCase();

  // ==========================================
  // FILTER 1: THE SANITY CHECK (BUG FIX)
  // ==========================================
  if (actualStr === expectedStr) {
    return {
      severity: "INFO",
      isAnomaly: false,
      explanation: "Configuration matched baseline exactly. No drift detected.",
      complianceImpact: "Compliant",
      remediationAction: "None required.",
    };
  }

  // ==========================================
  // FILTER 2: INTENT & APPROVAL PARSING
  // ==========================================
  const isApproved =
    reasonStr.includes("approved") ||
    reasonStr.includes("jira") ||
    reasonStr.includes("chg-");
  const isEmergency =
    reasonStr.includes("emergency") ||
    reasonStr.includes("outage") ||
    reasonStr.includes("hotfix");
  const isTesting = reasonStr.includes("test") || reasonStr.includes("temp");

  // Default Fallback State
  let isAnomaly = true;
  let severity = "MEDIUM";
  let explanation = `Unapproved parameter shift in ${controlName || "system"}. Changed from '${expectedValue}' to '${actualValue}'.`;
  let complianceImpact = "General Baseline Deviation (NIST CM-2)";
  let remediationAction = "Review and revert to established baseline.";

  // ==========================================
  // FILTER 3: DIRECTIONAL SECURITY HEURISTICS
  // ==========================================

  // A. LOGGING & AUDITING (CloudTrail, Syslog, etc.)
  if (key.includes("log") || key.includes("trail") || key.includes("audit")) {
    if (
      actualStr === "false" ||
      actualStr === "disabled" ||
      actualStr === "none"
    ) {
      severity = "CRITICAL";
      explanation = `Audit trail explicitly disabled. This creates a severe compliance blindspot hiding potential malicious activity.`;
      complianceImpact = "Violation: NIST AU-2, CIS 8.1";
      remediationAction =
        "Immediately restore logging to prevent unmonitored access.";
    } else if (actualStr === "true" || actualStr === "enabled") {
      // Posture Improvement!
      return {
        severity: "INFO",
        isAnomaly: false,
        explanation: "Security posture improved: Logging enabled.",
        complianceImpact: "Compliant",
      };
    }
  }

  // B. ENCRYPTION & CRYPTOGRAPHY (TLS, AES, RDS Encryption)
  else if (
    key.includes("enc") ||
    key.includes("tls") ||
    key.includes("crypto") ||
    key.includes("cipher")
  ) {
    // Check for downgrades (e.g., 256 to 128)
    const expectedStrength = (expectedStr.match(/\d+/) || [0])[0];
    const actualStrength = (actualStr.match(/\d+/) || [0])[0];

    if (
      actualStr === "false" ||
      actualStr === "disabled" ||
      actualStr === "http"
    ) {
      severity = "CRITICAL";
      explanation = `Encryption at rest/transit completely disabled. Data is currently exposed in plaintext.`;
      complianceImpact = "Violation: GDPR Art 32, PCI-DSS 3.4";
      remediationAction =
        "Halt operations and mandate encryption protocols immediately.";
    } else if (actualStrength < expectedStrength && actualStrength !== 0) {
      severity = "HIGH";
      explanation = `Cryptographic downgrade detected (${expectedValue} → ${actualValue}). Weakened cipher suite in use.`;
      complianceImpact = "Warning: NIST SC-13";
      remediationAction = `Upgrade cipher to match baseline minimum of ${expectedValue}.`;
    } else if (actualStrength > expectedStrength) {
      // Upgraded encryption!
      return {
        severity: "INFO",
        isAnomaly: false,
        explanation:
          "Security posture improved: Encryption strength increased.",
        complianceImpact: "Compliant",
      };
    }
  }

  // C. ACCESS & AUTHENTICATION (MFA, IAM)
  else if (
    key.includes("mfa") ||
    key.includes("auth") ||
    key.includes("admin")
  ) {
    if (actualStr === "false" || actualStr === "disabled") {
      severity = "CRITICAL";
      explanation = `Authentication requirement bypassed. Severe vulnerability to credential stuffing or account takeover.`;
      complianceImpact = "Violation: NIST IA-2, CIS 5.3";
      remediationAction =
        "Force re-authentication and enable MFA policies globally.";
    } else if (actualStr === "true" || actualStr === "enabled") {
      return {
        severity: "INFO",
        isAnomaly: false,
        explanation: "Security posture improved: MFA/Auth enforced.",
        complianceImpact: "Compliant",
      };
    }
  }

  // D. NETWORK PERIMETER & FIREWALLS
  else if (
    key.includes("port") ||
    key.includes("fw") ||
    key.includes("firewall") ||
    key.includes("rule")
  ) {
    if (
      actualStr.includes("all") ||
      actualStr.includes("any") ||
      actualStr.includes("0.0.0.0/0")
    ) {
      severity = "CRITICAL";
      explanation = `Firewall perimeter fundamentally broken. Rule altered to allow ANY/ALL traffic.`;
      complianceImpact = "Violation: CIS 3.1, NIST AC-4";
      remediationAction =
        "Immediately revoke ANY/ALL rule and restore strict ingress IP filtering.";
    } else if (actualStr.length > expectedStr.length && expectedStr !== "") {
      severity = "HIGH";
      explanation = `Perimeter broadened. Additional unverified network ports/IPs opened (${actualValue}).`;
      complianceImpact = "Warning: NIST AC-4";
      remediationAction =
        "Audit newly opened ports and close unless business-justified.";
    }
  }

  // ==========================================
  // FILTER 4: MODIFIERS (Contextual Adjustments)
  // ==========================================

  // If it wasn't caught by a specific rule above, but it IS an approved CI/CD change, let it pass.
  if (severity === "MEDIUM" && isApproved) {
    return {
      severity: "LOW",
      isAnomaly: false,
      explanation: "Authorized operational config update.",
      complianceImpact: "Compliant",
    };
  }

  // If it's an emergency change, it's an anomaly, but note the context.
  if (isAnomaly && isEmergency) {
    explanation += ` Note: Change occurred during an emergency/outage window by ${operator}. Requires post-incident review.`;
  }

  // If the CSV explicitly told us it's a CRITICAL threat, trust the ground-truth data.
  if (providedSeverity === "CRITICAL" && severity !== "CRITICAL") {
    severity = "CRITICAL";
  }

  return {
    severity,
    isAnomaly,
    explanation,
    complianceImpact,
    remediationAction,
  };
};

module.exports = { evaluateDrift };
