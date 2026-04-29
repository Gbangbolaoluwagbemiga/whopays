import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying WhoPaysEscrowFinal with deployer:", deployer.address);

  const WhoPaysEscrowFinal = await hre.ethers.getContractFactory("WhoPaysEscrowV5_Final");
  const escrow = await WhoPaysEscrowFinal.deploy(deployer.address);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("WhoPaysEscrowFinal deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
