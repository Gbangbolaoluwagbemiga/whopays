// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WhoPaysEscrowV5_Final
 * @dev Production-grade Celo Mainnet Escrow with Random IDs, Claims, and Consensus.
 */
contract WhoPaysEscrowV5_Final is Ownable {
    using SafeERC20 for IERC20;

    enum Status { Open, Locked, Resolved, Cancelled }

    struct Bet {
        bytes32 id;
        address creator;
        string title;
        string description;
        uint256 stakePerPerson;
        address tokenAddress;
        address[] parties;
        mapping(address => bool) partyDeposited;
        mapping(address => string) partyClaim;
        mapping(address => address) partyVote;
        uint256 voteCount;
        address winner;
        Status status;
        uint256 expiresAt;
        bool isUniversal;
    }

    mapping(bytes32 => Bet) public bets;
    mapping(address => bytes32[]) public userBets;
    address public arbiter;
    uint256 private _nonce;

    event BetCreated(bytes32 indexed betId, address indexed creator, string title, uint256 stake, bool isUniversal);
    event ClaimStated(bytes32 indexed betId, address indexed participant, string claim);
    event VoteCast(bytes32 indexed betId, address indexed voter, address indexed candidate);
    event BetResolved(bytes32 indexed betId, address indexed winner, uint256 payout);

    constructor(address initialArbiter) {
        arbiter = initialArbiter;
    }

    function setArbiter(address _arbiter) external onlyOwner {
        arbiter = _arbiter;
    }

    function createBet(
        string calldata title,
        string calldata description,
        uint256 durationSeconds,
        address[] calldata otherParties,
        address tokenAddress,
        uint256 stakeAmount,
        bool isUniversal,
        string calldata creatorClaim
    ) external payable returns (bytes32) {
        if (tokenAddress == address(0)) {
            require(msg.value > 0, "Stake must be > 0");
            stakeAmount = msg.value;
        } else {
            IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), stakeAmount);
        }

        bytes32 betId = keccak256(abi.encodePacked(msg.sender, block.timestamp, _nonce++));
        Bet storage bet = bets[betId];
        bet.id = betId;
        bet.creator = msg.sender;
        bet.title = title;
        bet.description = description;
        bet.stakePerPerson = stakeAmount;
        bet.tokenAddress = tokenAddress;
        bet.status = Status.Open;
        bet.expiresAt = block.timestamp + durationSeconds;
        bet.isUniversal = isUniversal;

        bet.parties.push(msg.sender);
        bet.partyDeposited[msg.sender] = true;
        bet.partyClaim[msg.sender] = creatorClaim;

        for (uint i = 0; i < otherParties.length; i++) {
            bet.parties.push(otherParties[i]);
        }

        userBets[msg.sender].push(betId);
        emit BetCreated(betId, msg.sender, title, stakeAmount, isUniversal);
        emit ClaimStated(betId, msg.sender, creatorClaim);
        return betId;
    }

    function joinBet(bytes32 betId, string calldata claim) external payable {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Open, "Not open");
        require(!bet.partyDeposited[msg.sender], "Already in");
        
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

        bet.partyDeposited[msg.sender] = true;
        bet.partyClaim[msg.sender] = claim;
        userBets[msg.sender].push(betId);

        if (_allDeposited(betId)) {
            bet.status = Status.Locked;
        }
        emit ClaimStated(betId, msg.sender, claim);
    }

    function confirmWinner(bytes32 betId, address winnerCandidate) external {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Locked, "Not locked");
        require(bet.partyVote[msg.sender] == address(0), "Already voted");
        
        bet.partyVote[msg.sender] = winnerCandidate;
        bet.voteCount++;
        emit VoteCast(betId, msg.sender, winnerCandidate);
    }

    function resolveBet(bytes32 betId, address winner) external {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Locked, "Not locked");

        if (msg.sender != arbiter) {
            require(_checkConsensus(betId, winner), "Consensus required");
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

    function _checkConsensus(bytes32 betId, address candidate) internal view returns (bool) {
        Bet storage bet = bets[betId];
        uint256 candidateVotes = 0;
        for (uint i = 0; i < bet.parties.length; i++) {
            if (bet.partyVote[bet.parties[i]] == candidate) {
                candidateVotes++;
            }
        }
        uint256 total = bet.parties.length;
        if (total < 7) return candidateVotes == total;
        return candidateVotes * 100 / total >= 75;
    }

    function _allDeposited(bytes32 betId) internal view returns (bool) {
        Bet storage bet = bets[betId];
        for (uint i = 0; i < bet.parties.length; i++) {
            if (!bet.partyDeposited[bet.parties[i]]) return false;
        }
        return true;
    }

    function getBetInfo(bytes32 betId) external view returns (
        address creator,
        string memory title,
        string memory description,
        uint256 stake,
        uint256 partyCount,
        Status status,
        address winner,
        bool isUniversal
    ) {
        Bet storage bet = bets[betId];
        return (bet.creator, bet.title, bet.description, bet.stakePerPerson, bet.parties.length, bet.status, bet.winner, bet.isUniversal);
    }

    function hasDeposited(bytes32 betId, address party) external view returns (bool) {
        return bets[betId].partyDeposited[party];
    }

    function getPartyClaim(bytes32 betId, address party) external view returns (string memory) {
        return bets[betId].partyClaim[party];
    }

    function getParties(bytes32 betId) external view returns (address[] memory) {
        return bets[betId].parties;
    }
}
