import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Deploying WhoPaysEscrow contract...");

  const WhoPaysEscrow = await hre.ethers.getContractFactory("WhoPaysEscrow");
  const escrow = await WhoPaysEscrow.deploy();

  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("WhoPaysEscrow deployed to:", address);

  // Update deployment-addresses.json
  const addressesPath = path.join(__dirname, "../deployment-addresses.json");
  let addresses = {};
  if (fs.existsSync(addressesPath)) {
    addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  }

  addresses.escrow = address;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("Updated deployment-addresses.json with escrow address.");

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
