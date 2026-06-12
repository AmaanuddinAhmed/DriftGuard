const http = require("http");

// Configs to send to the server
const normalState = {
  systemId: "FW-SGP-01",
  allowAllTraffic: false,
  mfaEnforced: true,
  loggingStatus: "enabled",
  encryptionLevel: "TLSv1.3",
};

const attackScenarios = [
  {
    title: "Scenario 1: Hacker disables MFA to prepare for brute force",
    data: { ...normalState, mfaEnforced: false },
  },
  {
    title: "Scenario 2: Malicious insider opens firewall wide open",
    data: { ...normalState, allowAllTraffic: true },
  },
  {
    title: "Scenario 3: Rogue actor turns off system logging to cover tracks",
    data: { ...normalState, loggingStatus: "disabled" },
  },
  {
    title: "Scenario 4: Unauthorized script downgrades encryption protocol",
    data: { ...normalState, encryptionLevel: "TLSv1.0" },
  },
];

// Helper to make a POST request to your backend monitoring route
function sendConfigToServer(payload, title) {
  const dataString = JSON.stringify(payload);

  const options = {
    hostname: "localhost",
    port: 5000,
    path: "/api/monitor/config",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": dataString.length,
    },
  };

  console.log(`\nDeploying: ${title}...`);

  const req = http.request(options, (res) => {
    let responseData = "";
    res.on("data", (chunk) => (responseData += chunk));
    res.on("end", () => {
      console.log(
        `Server Processed Attack Event. Status: ${res.statusCode}`,
      );
    });
  });

  req.on("error", (error) => {
    console.error(`Simulator communication error: ${error.message}`);
  });

  req.write(dataString);
  req.end();
}

// Loop through attacks sequentially every 15 seconds to simulate an ongoing incident
let scenarioIndex = 0;
console.log("Security Control Drift Simulator Initialized...");

setInterval(() => {
  const currentScenario = attackScenarios[scenarioIndex];
  sendConfigToServer(currentScenario.data, currentScenario.title);

  // Cycle back to the first scenario after finishing the list
  scenarioIndex = (scenarioIndex + 1) % attackScenarios.length;
}, 15000); // 15 seconds
