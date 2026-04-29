import hre from "hardhat";

async function main() {
  console.log("Deploying WhoPaysEscrowV3...");
  const WhoPaysEscrowV3 = await hre.ethers.getContractFactory("WhoPaysEscrowV3");
  const escrow = await WhoPaysEscrowV3.deploy();
  await escrow.waitForDeployment();
  const address = await escrow.getAddress();
  console.log("WhoPaysEscrowV3 deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
