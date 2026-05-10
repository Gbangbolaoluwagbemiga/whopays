import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const addressesPath = path.join(__dirname, "../deployment-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const agentAddress = addresses.whoPaysAgent;

  const WhoPaysAgent = await hre.ethers.getContractAt("WhoPaysAgent", agentAddress);
  const cardData = await WhoPaysAgent.getAgentCard();
  const cardUri = cardData.agentCardURI;
  
  console.log(`On-chain Agent Card URI: ${cardUri}`);
  
  if (cardUri.startsWith("data:application/json;base64,")) {
    const base64 = cardUri.split(",")[1];
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    console.log("Decoded Content:");
    console.log(decoded);
  }
}

main().catch(console.error);
