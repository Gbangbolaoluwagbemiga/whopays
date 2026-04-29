import pkg from "hardhat";
import fs from "fs";

const { ethers } = pkg;

const WORKER_DERIVATION_SALT = "whopays-worker";
const TOTAL_WALLETS = 40;
const TARGET_BALANCE = ethers.parseEther("0.5");
const GAS_LIMIT = 21000;

async function loadPrivateKey() {
  let pk = process.env.PRIVATE_KEY || process.env.CELO_PRIVATE_KEY;
  if (pk) return pk;

  const envPaths = ["../.env", ".env"];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const envText = fs.readFileSync(envPath, "utf8");
    const keyLine = envText
      .split(/\r?\n/)
      .find(
        (line) =>
          line.startsWith("PRIVATE_KEY=") || line.startsWith("CELO_PRIVATE_KEY="),
      );
    if (keyLine) {
      pk = keyLine.split("=")[1]?.trim().replace(/^["']|["']$/g, "");
      if (pk) return pk;
    }
  }

  throw new Error("Missing PRIVATE_KEY (or CELO_PRIVATE_KEY) in environment");
}

function deriveWallets(provider, rootPrivateKey, count) {
  const root = rootPrivateKey.startsWith("0x")
    ? rootPrivateKey.toLowerCase()
    : `0x${rootPrivateKey.toLowerCase()}`;

  return Array.from({ length: count }, (_, i) => {
    const seed = ethers.toUtf8Bytes(`${WORKER_DERIVATION_SALT}:${root}:${i}`);
    const derivedPk = ethers.keccak256(seed);
    return new ethers.Wallet(derivedPk, provider);
  });
}

async function buildFeeOverrides(provider, nonce) {
  const feeData = await provider.getFeeData();
  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas > 0n
      ? feeData.maxPriorityFeePerGas
      : ethers.parseUnits("0.5", "gwei");
  const maxFeePerGas =
    feeData.maxFeePerGas && feeData.maxFeePerGas > 0n
      ? (feeData.maxFeePerGas * 110n) / 100n
      : ethers.parseUnits("2", "gwei");

  return { nonce, maxPriorityFeePerGas, maxFeePerGas };
}

function isTransientRpcError(error) {
  const message = `${error?.message || ""}`.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("socket") ||
    message.includes("network") ||
    message.includes("etimedout") ||
    message.includes("econnreset")
  );
}

async function sendWithRetry(sendFn, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await sendFn();
    } catch (error) {
      if (attempt === maxAttempts || !isTransientRpcError(error)) throw error;
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }
}

async function main() {
  const provider = ethers.provider;
  const pk = await loadPrivateKey();
  const signer = new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider);
  const wallets = deriveWallets(provider, pk, TOTAL_WALLETS);

  const signerBalance = await provider.getBalance(signer.address);
  let neededTotal = 0n;
  for (const wallet of wallets) {
    const bal = await provider.getBalance(wallet.address);
    if (bal < TARGET_BALANCE) neededTotal += TARGET_BALANCE - bal;
  }
  const estimatedTotal = neededTotal + ethers.parseEther("0.05");
  if (signerBalance < estimatedTotal) {
    throw new Error(
      `Insufficient host balance. Need about ${ethers.formatEther(estimatedTotal)} CELO, have ${ethers.formatEther(signerBalance)} CELO`,
    );
  }

  console.log(`Host: ${signer.address}`);
  console.log(
    `Topping up ${TOTAL_WALLETS} deterministic wallets to 0.5 CELO each...`,
  );

  let nonce = await provider.getTransactionCount(signer.address, "pending");
  const funded = [];

  for (let i = 0; i < wallets.length; i++) {
    const target = wallets[i];
    const balance = await provider.getBalance(target.address);
    const topUp = TARGET_BALANCE > balance ? TARGET_BALANCE - balance : 0n;
    if (topUp === 0n) {
      funded.push({
        index: i,
        address: target.address,
        txHash: "already-funded",
      });
      if ((i + 1) % 5 === 0) {
        console.log(`Checked ${i + 1}/${TOTAL_WALLETS}`);
      }
      continue;
    }

    const receipt = await sendWithRetry(async () => {
      const feeOverrides = await buildFeeOverrides(provider, nonce++);
      const tx = await signer.sendTransaction({
        to: target.address,
        value: topUp,
        gasLimit: GAS_LIMIT,
        ...feeOverrides,
      });
      return tx.wait(1);
    });

    funded.push({
      index: i,
      address: target.address,
      txHash: receipt.hash,
    });

    if ((i + 1) % 5 === 0) {
      console.log(`Processed ${i + 1}/${TOTAL_WALLETS}`);
    }
  }

  console.log("\nTop-up complete.");
  for (const item of funded) {
    console.log(`#${item.index} ${item.address} ${item.txHash}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
