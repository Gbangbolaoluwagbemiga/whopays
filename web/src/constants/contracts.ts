export const ESCROW_ADDRESS = "0x6811fCE3dEf0F8cdd2fF1f4330F064cBbdaFb0Be";

export const ESCROW_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "title", "type": "string" },
      { "internalType": "string", "name": "description", "type": "string" },
      { "internalType": "uint256", "name": "durationSeconds", "type": "uint256" },
      { "internalType": "address[]", "name": "otherParties", "type": "address[]" },
      { "internalType": "address", "name": "tokenAddress", "type": "address" },
      { "internalType": "uint256", "name": "stakeAmount", "type": "uint256" },
      { "internalType": "bool", "name": "isUniversal", "type": "bool" },
      { "internalType": "string", "name": "creatorClaim", "type": "string" }
    ],
    "name": "createBet",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "betId", "type": "bytes32" },
      { "internalType": "string", "name": "claim", "type": "string" }
    ],
    "name": "joinBet",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "betId", "type": "bytes32" },
      { "internalType": "address", "name": "winner", "type": "address" }
    ],
    "name": "resolveBet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "betId", "type": "bytes32" },
      { "internalType": "address", "name": "winnerCandidate", "type": "address" }
    ],
    "name": "confirmWinner",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "betId", "type": "bytes32" }],
    "name": "getBetInfo",
    "outputs": [
      { "internalType": "address", "name": "creator", "type": "address" },
      { "internalType": "string", "name": "title", "type": "string" },
      { "internalType": "string", "name": "description", "type": "string" },
      { "internalType": "uint256", "name": "stake", "type": "uint256" },
      { "internalType": "uint256", "name": "partyCount", "type": "uint256" },
      { "internalType": "uint8", "name": "status", "type": "uint8" },
      { "internalType": "address", "name": "winner", "type": "address" },
      { "internalType": "bool", "name": "isUniversal", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "betId", "type": "bytes32" }],
    "name": "getParties",
    "outputs": [{ "internalType": "address[]", "name": "", "type": "address[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "betId", "type": "bytes32" },
      { "internalType": "address", "name": "party", "type": "address" }
    ],
    "name": "hasDeposited",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "betId", "type": "bytes32" },
      { "internalType": "address", "name": "party", "type": "address" }
    ],
    "name": "getPartyClaim",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "betId", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "creator", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "title", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "stake", "type": "uint256" },
      { "indexed": false, "internalType": "bool", "name": "isUniversal", "type": "bool" }
    ],
    "name": "BetCreated",
    "type": "event"
  }
] as const;

export const TOKEN_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const SUPPORTED_TOKENS = [
  { symbol: "CELO", name: "Celo Native", address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  { symbol: "cUSD", name: "Celo Dollar", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18 },
  { symbol: "cEUR", name: "Celo Euro", address: "0xD8763C9223010b91011925b169600a94b5952B97", decimals: 18 },
];
