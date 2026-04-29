import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const walletsPath = path.join(__dirname, "../../rater-wallets.json");
  const walletsData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  console.log("Checking balances for all rater wallets...");
  const feeData = await hre.ethers.provider.getFeeData();
  console.log(`Current Gas Price: ${hre.ethers.formatUnits(feeData.gasPrice, "gwei")} gwei`);
  
  for (const w of walletsData) {
    const balance = await hre.ethers.provider.getBalance(w.address);
    console.log(`${w.index}: ${w.address} -> ${hre.ethers.formatEther(balance)} CELO`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
