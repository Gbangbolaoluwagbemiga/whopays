import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("Deploying WhoPaysEscrowV6_Emergency to Celo Mainnet...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const WhoPays = await ethers.getContractFactory("WhoPaysEscrowV6_Emergency");
  const contract = await WhoPays.deploy(deployer.address);
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("WhoPaysEscrowV6_Emergency deployed to:", address);
  console.log("Arbiter set to:", deployer.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
