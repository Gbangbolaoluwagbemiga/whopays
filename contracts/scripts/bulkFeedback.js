import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGISTRY_ADDRESS = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
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
  console.log("\n🔥 Starting Bulk Feedback Mission (20 Attestations)...");
  
  const walletsPath = path.join(__dirname, "../../rater-wallets.json");
  const walletsData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  
  const funderPk = await loadPrivateKey();
  const funder = new hre.ethers.Wallet(`0x${funderPk}`, hre.ethers.provider);
  
  const registryAbi = [
    "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash) external"
  ];
  const registry = new hre.ethers.Contract(REGISTRY_ADDRESS, registryAbi, hre.ethers.provider);

  for (let round = 1; round <= 4; round++) {
    console.log(`\n--- 🛸 ROUND ${round} ---`);
    
    for (let i = 0; i < walletsData.length; i++) {
      const wData = walletsData[i];
      const wallet = new hre.ethers.Wallet(wData.privateKey, hre.ethers.provider);
      
      // Check and Fund if needed
      const bal = await hre.ethers.provider.getBalance(wallet.address);
      if (bal < hre.ethers.parseEther("0.1")) {
        console.log(`  💸 Funding wallet ${i} (${wallet.address})...`);
        const fundTx = await funder.sendTransaction({
          to: wallet.address,
          value: hre.ethers.parseEther("0.2")
        });
        await fundTx.wait();
      }

      const tags = [["speed", "fairness"], ["accuracy", "autonomous"], ["payment", "logic"], ["fast", "reliable"]][round-1] || ["general", "feedback"];
      
      console.log(`  ⏳ Submitting feedback from Wallet ${i} (Rating: 5)...`);
      try {
        const tx = await registry.connect(wallet).giveFeedback(
          AGENT_ID,
          5, // value
          0, // decimals
          tags[0],
          tags[1],
          "https://whopays-five.vercel.app", // endpoint
          "", // feedbackURI
          hre.ethers.ZeroHash // feedbackHash
        );
        console.log(`  ✅ Success! TX: ${tx.hash}`);
      } catch (err) {
        console.error(`  ❌ Failed for Wallet ${i}:`, err.message);
      }
    }
  }

  console.log("\n🚀 Mission Accomplished! 20 new feedbacks submitted.");
}

main().catch(console.error);
