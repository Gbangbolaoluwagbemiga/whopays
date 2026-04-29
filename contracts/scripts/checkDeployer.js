import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const ESCROW_ADDRESS = "0xe99ba2437AcFf740F3741966ADaF7392340aE3cc";
  const addressesPath = path.join(__dirname, "../deployment-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

  const balance = await hre.ethers.provider.getBalance(addresses.deployer);
  console.log(`Deployer ${addresses.deployer} -> ${hre.ethers.formatEther(balance)} CELO`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
