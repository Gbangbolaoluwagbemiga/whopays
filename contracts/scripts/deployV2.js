import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("Deploying WhoPaysEscrowV2...");

  const Escrow = await ethers.getContractFactory("WhoPaysEscrowV2");
  const escrow = await Escrow.deploy();

  await escrow.waitForDeployment();
  const address = await escrow.getAddress();

  console.log(`WhoPaysEscrowV2 deployed to: ${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
