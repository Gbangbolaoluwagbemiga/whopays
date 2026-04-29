import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadPrivateKey() {
  let pk = process.env.PRIVATE_KEY;
  if (pk) return pk.replace(/^0x/, "");
  for (const p of ["../.env", ".env"]) {
    if (!fs.existsSync(p)) continue;
    const line = fs.readFileSync(p, "utf8").split("\n")
      .find(l => l.startsWith("PRIVATE_KEY="));
    if (line) {
      pk = line.split("=")[1]?.trim().replace(/^['"]|['"]$/g, "");
      if (pk) return pk.replace(/^0x/, "");
    }
  }
  throw new Error("PRIVATE_KEY not found");
}

async function main() {
  console.log("\n🚀 Updating Agent Card on-chain...");

  // Load deployment addresses
  const addressesPath = path.join(__dirname, "../deployment-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const agentAddress = addresses.whoPaysAgent;

  // Load agent card
  const cardPath = path.join(__dirname, "../agent-card.json");
  const cardJson = fs.readFileSync(cardPath, "utf8");

  // Create a Data URI for the JSON so we don't need IPFS Pinata right now
  // Some indexers prefer base64 data URIs
  const base64Json = Buffer.from(cardJson).toString("base64");
  const dataUri = `data:application/json;base64,${base64Json}`;
  console.log(`📄 Generated Data URI (length: ${dataUri.length})`);

  const pk = await loadPrivateKey();
  const wallet = new hre.ethers.Wallet(`0x${pk}`, hre.ethers.provider);

  const WhoPaysAgent = await hre.ethers.getContractFactory("WhoPaysAgent");
  const contract = WhoPaysAgent.attach(agentAddress).connect(wallet);

  console.log(`  ⏳ Sending updateAgentCard tx...`);
  const tx = await contract.updateAgentCard(dataUri);
  await tx.wait(1);
  
  console.log(`  🌟 Agent Card Updated! TX: ${tx.hash}`);

  // Update local file to reflect it
  addresses.agentCardURI = dataUri;
  addresses.agentCardUpdateTx = tx.hash;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exitCode = 1;
});
