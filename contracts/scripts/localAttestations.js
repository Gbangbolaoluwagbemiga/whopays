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

  const walletsPath = path.join(__dirname, "../../rater-wallets.json");
  const walletsData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  console.log(`\n🏠 Submitting LOCAL Attestations to Agent Contract at ${agentAddress}`);

  const WhoPaysAgent = await hre.ethers.getContractAt("WhoPaysAgent", agentAddress);

  for (let i = 0; i < walletsData.length; i++) {
    const wData = walletsData[i];
    const wallet = new hre.ethers.Wallet(wData.privateKey, hre.ethers.provider);
    
    console.log(`  ⏳ Submitting attestation from Wallet ${i} (${wallet.address.slice(0, 10)}...)...`);
    try {
      // Check if already attested locally
      const hasAttested = await WhoPaysAgent.hasAttested(wallet.address);
      if (hasAttested) {
        console.log(`  ✅ Wallet ${i} has already attested locally.`);
        continue;
      }

      const tx = await WhoPaysAgent.connect(wallet).submitAttestation(5, Math.floor(Math.random() * 10000));
      await tx.wait(1);
      console.log(`  🌟 Success! TX: ${tx.hash}`);
    } catch (err) {
      console.error(`  ❌ Failed for Wallet ${i}:`, err.message);
    }
  }

  console.log("\n✅ Local attestations complete!");
}

main().catch(console.error);
