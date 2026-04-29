import pkg from "hardhat";
import fs from "fs";

const { ethers } = pkg;

const WORKER_DERIVATION_SALT = "whopays-worker";
const TOTAL_WALLETS = 40;

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

async function main() {
  const provider = ethers.provider;
  const pk = await loadPrivateKey();
  const wallets = deriveWallets(provider, pk, TOTAL_WALLETS);

  console.log("Checking balances for deterministic worker wallets...");
  for (let i = 0; i < wallets.length; i++) {
    const balance = await provider.getBalance(wallets[i].address);
    if (balance > 0n) {
      console.log(`${i}: ${wallets[i].address} -> ${ethers.formatEther(balance)} CELO`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
