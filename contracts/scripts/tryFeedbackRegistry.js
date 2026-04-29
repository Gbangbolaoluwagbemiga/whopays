import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://forno.celo.org");
  const pk = "0xb753309a1d6829e46e9fa74a60e23a4ca66a31232ba6796060e4ba68408d6429"; // Wallet 0
  const wallet = new ethers.Wallet(pk, provider);
  
  const registryAddress = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
  const agentId = 9047;
  const rating = 5;
  const comment = "Great agent, auto-settled correctly!";
  
  const signatures = [
    "function submitFeedback(uint256 agentId, uint8 score, string comment)",
    "function rateAgent(uint256 agentId, uint8 score, string comment)",
    "function submitAttestation(uint256 agentId, uint8 score, string comment)",
    "function submitFeedback(uint256 agentId, uint8 score)",
    "function rateAgent(uint256 agentId, uint8 score)"
  ];
  
  for (const sig of signatures) {
    console.log(`Trying ${sig}...`);
    const contract = new ethers.Contract(registryAddress, [sig], wallet);
    try {
      let tx;
      if (sig.includes("string")) {
        tx = await contract[sig.split("(")[0].split(" ")[1]](agentId, rating, comment);
      } else {
        tx = await contract[sig.split("(")[0].split(" ")[1]](agentId, rating);
      }
      console.log(`Success with ${sig}! TX: ${tx.hash}`);
      await tx.wait();
      return;
    } catch (e) {
      const msg = e.message.substring(0, 50);
      console.log(`Failed: ${msg}`);
      if (!msg.includes("revert") && !msg.includes("data out-of-bounds") && !msg.includes("unrecognized") && !msg.includes("execution reverted")) {
         console.error(e);
      }
    }
  }
}

main().catch(console.error);
