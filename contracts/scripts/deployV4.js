import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying WhoPaysEscrowV4 with deployer:", deployer.address);

  const WhoPaysEscrowV4 = await hre.ethers.getContractFactory("WhoPaysEscrowV4");
  const escrow = await WhoPaysEscrowV4.deploy(deployer.address);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("WhoPaysEscrowV4 deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
