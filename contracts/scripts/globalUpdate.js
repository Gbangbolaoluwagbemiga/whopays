import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GLOBAL_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const AGENT_ID = 9047;

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
  console.log("\n🌍 Updating Agent Metadata on GLOBAL Identity Registry...");

  const addressesPath = path.join(__dirname, "../deployment-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const dataUri = addresses.agentCardURI;

  const pk = await loadPrivateKey();
  const wallet = new hre.ethers.Wallet(`0x${pk}`, hre.ethers.provider);

  // Common ERC-8004 IdentityRegistry ABI
  const abi = [
    "function updateAgent(uint256 agentId, string calldata metadataURI) external",
    "function getAgent(uint256 agentId) external view returns (address owner, string memory metadataURI, bool active)"
  ];

  const registry = new hre.ethers.Contract(GLOBAL_REGISTRY, abi, wallet);

  try {
    console.log(`  ⏳ Checking current global metadata for ID ${AGENT_ID}...`);
    const agentData = await registry.getAgent(AGENT_ID);
    console.log(`  Current Owner: ${agentData.owner}`);
    console.log(`  Current URI: ${agentData.metadataURI.slice(0, 50)}...`);

    if (agentData.owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error(`  ❌ Error: You are not the owner of ID ${AGENT_ID} on the global registry!`);
      console.error(`  Wallet: ${wallet.address}`);
      console.error(`  Owner: ${agentData.owner}`);
      return;
    }

    console.log(`  ⏳ Sending global updateAgent tx...`);
    const tx = await registry.updateAgent(AGENT_ID, dataUri);
    await tx.wait(1);
    console.log(`  🌟 GLOBAL Metadata Updated! TX: ${tx.hash}`);
  } catch (err) {
    console.error(`  ❌ Failed to update global registry:`, err.message);
  }
}

main().catch(console.error);
