// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WhoPaysEscrowV4
 * @dev Senior-grade decentralized escrow with Multi-sig Consensus and AI Arbiter fallback.
 */
contract WhoPaysEscrowV4 is Ownable {
    using SafeERC20 for IERC20;

    enum Status { Open, Locked, Resolved, Cancelled }

    struct Bet {
        uint256 id;
        address creator;
        string title;
        uint256 stakePerPerson;
        address tokenAddress;
        address[] parties;
        mapping(address => bool) hasDeposited;
        mapping(address => address) partyVote; // Who each party thinks won
        uint256 voteCount;
        address winner;
        Status status;
        uint256 expiresAt;
        bool isUniversal; // If true, AI can resolve independently
    }

    uint256 public nextBetId;
    mapping(uint256 => Bet) public bets;
    mapping(address => uint256[]) public userBets;
    address public arbiter; // AI/Ref address

    event BetCreated(uint256 indexed betId, address indexed creator, string title, uint256 stake, bool isUniversal);
    event VoteCast(uint256 indexed betId, address indexed voter, address indexed candidate);
    event BetResolved(uint256 indexed betId, address indexed winner, uint256 payout);

    constructor(address initialArbiter) {
        arbiter = initialArbiter;
    }

    function setArbiter(address _arbiter) external onlyOwner {
        arbiter = _arbiter;
    }

    function createBet(
        string calldata title,
        uint256 durationSeconds,
        address[] calldata otherParties,
        address tokenAddress,
        uint256 stakeAmount,
        bool isUniversal
    ) external payable returns (uint256) {
        if (tokenAddress == address(0)) {
            require(msg.value > 0, "Stake must be > 0");
            stakeAmount = msg.value;
        } else {
            IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), stakeAmount);
        }

        uint256 betId = nextBetId++;
        Bet storage bet = bets[betId];
        bet.id = betId;
        bet.creator = msg.sender;
        bet.title = title;
        bet.stakePerPerson = stakeAmount;
        bet.tokenAddress = tokenAddress;
        bet.status = Status.Open;
        bet.expiresAt = block.timestamp + durationSeconds;
        bet.isUniversal = isUniversal;

        bet.parties.push(msg.sender);
        bet.hasDeposited[msg.sender] = true;

        for (uint i = 0; i < otherParties.length; i++) {
            bet.parties.push(otherParties[i]);
        }

        userBets[msg.sender].push(betId);
        emit BetCreated(betId, msg.sender, title, stakeAmount, isUniversal);
        return betId;
    }

    function joinBet(uint256 betId) external payable {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Open, "Not open");
        require(!bet.hasDeposited[msg.sender], "Already in");
        
        bool isAValidParty = false;
        for(uint i=0; i<bet.parties.length; i++) {
            if(bet.parties[i] == msg.sender) { isAValidParty = true; break; }
        }
        require(isAValidParty, "Not a party");

        if (bet.tokenAddress == address(0)) {
            require(msg.value == bet.stakePerPerson, "Wrong stake");
        } else {
            IERC20(bet.tokenAddress).safeTransferFrom(msg.sender, address(this), bet.stakePerPerson);
        }

        bet.hasDeposited[msg.sender] = true;
        userBets[msg.sender].push(betId);

        if (_allDeposited(betId)) {
            bet.status = Status.Locked;
        }
    }

    /**
     * @dev Cast a vote for the winner.
     */
    function confirmWinner(uint256 betId, address winnerCandidate) external {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Locked, "Not locked");
        require(bet.partyVote[msg.sender] == address(0), "Already voted");
        
        bet.partyVote[msg.sender] = winnerCandidate;
        bet.voteCount++;
        emit VoteCast(betId, msg.sender, winnerCandidate);
    }

    /**
     * @dev Finalize resolution. Enforces threshold or Arbiter override.
     */
    function resolveBet(uint256 betId, address winner, string calldata aiVerdict) external {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Locked, "Not locked");

        // SECURITY CHECK
        if (msg.sender != arbiter) {
            // Consensus check for normal users
            require(_checkConsensus(betId, winner), "Consensus not reached");
        }
        
        bet.winner = winner;
        bet.status = Status.Resolved;

        uint256 totalPot = bet.stakePerPerson * bet.parties.length;
        if (bet.tokenAddress == address(0)) {
            payable(winner).transfer(totalPot);
        } else {
            IERC20(bet.tokenAddress).safeTransfer(winner, totalPot);
        }
        emit BetResolved(betId, winner, totalPot);
    }

    function _checkConsensus(uint256 betId, address candidate) internal view returns (bool) {
        Bet storage bet = bets[betId];
        uint256 candidateVotes = 0;
        for (uint i = 0; i < bet.parties.length; i++) {
            if (bet.partyVote[bet.parties[i]] == candidate) {
                candidateVotes++;
            }
        }
        
        uint256 total = bet.parties.length;
        if (total < 7) {
            return candidateVotes == total; // 100%
        } else {
            return candidateVotes * 100 / total >= 75; // 75%
        }
    }

    function _allDeposited(uint256 betId) internal view returns (bool) {
        Bet storage bet = bets[betId];
        for (uint i = 0; i < bet.parties.length; i++) {
            if (!bet.hasDeposited[bet.parties[i]]) return false;
        }
        return true;
    }

    function getBetInfo(uint256 betId) external view returns (
        address creator,
        string memory title,
        uint256 stake,
        uint256 partyCount,
        Status status,
        address winner,
        uint256 voteCount,
        bool isUniversal
    ) {
        Bet storage bet = bets[betId];
        return (bet.creator, bet.title, bet.stakePerPerson, bet.parties.length, bet.status, bet.winner, bet.voteCount, bet.isUniversal);
    }
}
