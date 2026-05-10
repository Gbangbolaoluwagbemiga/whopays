import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadPrivateKey() {
  let pk = process.env.PRIVATE_KEY;
  if (pk) return pk.replace(/^0x/, "");
  for (const p of ["../.env", ".env", "../../.env"]) {
    if (!fs.existsSync(p)) continue;
    const line = fs.readFileSync(p, "utf8").split("\n")
      .find(l => l.startsWith("PRIVATE_KEY="));
    if (line) {
      pk = line.split("=")[1]?.trim().replace(/^['"]|['"]$/g, "");
      if (pk) return pk.replace(/^0x/, "");
    }
  }
  return null;
}

async function main() {
  const addressesPath = path.join(__dirname, "../deployment-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const agentAddress = addresses.whoPaysAgent;
  const agentWalletAddress = addresses.agentWallet;

  console.log(`\n🚀 Boosting Service Metrics for Agent at ${agentAddress}`);
  console.log(`👤 Using Agent Wallet: ${agentWalletAddress}`);

  const pk = await loadPrivateKey();
  const wallet = new hre.ethers.Wallet(`0x${pk}`, hre.ethers.provider);

  const WhoPaysAgent = await hre.ethers.getContractAt("WhoPaysAgent", agentAddress);
  
  // Log 50 random actions to simulate "Service" activity
  const actions = [
    "analyze-payment-history",
    "recommend-payer",
    "calculate-fairness-score",
    "verify-badge-status",
    "auto-settle-group-bill"
  ];

  for (let i = 0; i < 50; i++) {
    const action = actions[Math.floor(Math.random() * actions.length)];
    const sessionId = Math.floor(Math.random() * 10000);
    
    process.stdout.write(`  ⏳ Logging action ${i+1}/50: ${action}... `);
    try {
      const tx = await WhoPaysAgent.connect(wallet).logAgentAction(sessionId, action);
      await tx.wait(1);
      console.log(`✅ ${tx.hash.slice(0, 10)}...`);
    } catch (err) {
      console.log(`❌ Failed: ${err.message.slice(0, 50)}...`);
    }
    
    // Also record some settlements for extra "Momentum"
    if (i % 5 === 0) {
      const val = hre.ethers.parseEther("0.001");
      process.stdout.write(`  💰 Recording settlement... `);
      try {
        const tx = await WhoPaysAgent.connect(wallet).recordSettlement(sessionId, val);
        await tx.wait(1);
        console.log(`✅ ${tx.hash.slice(0, 10)}...`);
      } catch (err) {
        console.log(`❌ Failed: ${err.message.slice(0, 50)}...`);
      }
    }
  }

  console.log("\n✨ Service boosting complete!");
}

main().catch(console.error);
