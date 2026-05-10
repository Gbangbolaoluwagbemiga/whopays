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
  return null;
}

async function main() {
  const provider = hre.ethers.provider;
  
  const pk = await loadPrivateKey();
  if (pk) {
    const funder = new hre.ethers.Wallet(`0x${pk}`, provider);
    const funderBal = await provider.getBalance(funder.address);
    console.log(`Funder (${funder.address}): ${hre.ethers.formatEther(funderBal)} CELO`);
  }

  const walletsPath = path.join(__dirname, "../../rater-wallets.json");
  const raterWallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  
  for (let i = 0; i < raterWallets.length; i++) {
    const bal = await provider.getBalance(raterWallets[i].address);
    console.log(`Wallet ${i} (${raterWallets[i].address}): ${hre.ethers.formatEther(bal)} CELO`);
  }
}

main().catch(console.error);
