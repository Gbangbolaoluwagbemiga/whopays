import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKER_DERIVATION_SALT = "whopays-worker";

function deriveWallets(provider, rootPrivateKey, count) {
  const root = rootPrivateKey.startsWith("0x")
    ? rootPrivateKey.toLowerCase()
    : `0x${rootPrivateKey.toLowerCase()}`;

  return Array.from({ length: count }, (_, i) => {
    const seed = hre.ethers.toUtf8Bytes(`${WORKER_DERIVATION_SALT}:${root}:${i}`);
    const derivedPk = hre.ethers.keccak256(seed);
    return new hre.ethers.Wallet(derivedPk, provider);
  });
}

async function main() {
  const ESCROW_ADDRESS = "0xe99ba2437AcFf740F3741966ADaF7392340aE3cc";
  const walletsPath = path.join(__dirname, "../../rater-wallets.json");
  const walletsData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  const w1 = new hre.ethers.Wallet(walletsData[1].privateKey, hre.ethers.provider);
  const w3 = new hre.ethers.Wallet(walletsData[3].privateKey, hre.ethers.provider);

  console.log(`Using Wallet 1: ${w1.address}`);
  console.log(`Using Wallet 3: ${w3.address}`);

  const balance1 = await hre.ethers.provider.getBalance(w1.address);
  console.log(`Balance 1: ${hre.ethers.formatEther(balance1)} CELO`);

  const Escrow = await hre.ethers.getContractAt("WhoPaysEscrow", ESCROW_ADDRESS);
  const STAKE = hre.ethers.parseEther("0.00001");
  const GAS_PRICE = hre.ethers.parseUnits("100", "gwei");

  // 1. Wallet 1 Creates a Bet
  console.log("\n--- Wallet 1 creating a bet (Minimal) ---");
  const createData = Escrow.interface.encodeFunctionData("createBet", [
    "A",
    "B",
    BigInt(3600),
    [w3.address]
  ]);

  const createTx = await w1.sendTransaction({
    to: ESCROW_ADDRESS,
    data: createData,
    value: STAKE,
    gasPrice: GAS_PRICE,
    gasLimit: 300000
  });
  await createTx.wait();
  
  const betId = await Escrow.nextBetId() - 1n;
  console.log(`Bet #${betId} created!`);

  // 2. Wallet 3 Joins
  console.log("\n--- Wallet 3 joining ---");
  const joinData = Escrow.interface.encodeFunctionData("joinBet", [betId]);
  const joinTx = await w3.sendTransaction({
    to: ESCROW_ADDRESS,
    data: joinData,
    value: STAKE,
    gasPrice: GAS_PRICE,
    gasLimit: 150000
  });
  await joinTx.wait();
  console.log("Wallet 3 joined!");

  // 3. Wallet 1 Resolves
  console.log("\n--- Wallet 1 resolving ---");
  const resolveData = Escrow.interface.encodeFunctionData("resolveBet", [
    betId,
    w3.address,
    "W"
  ]);
  const resolveTx = await w1.sendTransaction({
    to: ESCROW_ADDRESS,
    data: resolveData,
    gasPrice: GAS_PRICE,
    gasLimit: 150000
  });
  await resolveTx.wait();
  console.log("Interaction complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
