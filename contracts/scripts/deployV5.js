import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying WhoPaysEscrowV5 with deployer:", deployer.address);

  const WhoPaysEscrowV5 = await hre.ethers.getContractFactory("WhoPaysEscrowV5");
  const escrow = await WhoPaysEscrowV5.deploy(deployer.address);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("WhoPaysEscrowV5 deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
