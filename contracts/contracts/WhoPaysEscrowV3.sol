// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title WhoPaysEscrowV3
 * @dev Secure consensus-based escrow.
 * Requires unanimous agreement or AI Arbiter intervention.
 */
contract WhoPaysEscrowV3 {
    using SafeERC20 for IERC20;

    enum Status { Open, Locked, Resolved, Cancelled }

    struct Bet {
        uint256 id;
        address creator;
        string title;
        string description;
        uint256 stakePerPerson;
        address tokenAddress;
        address[] parties;
        mapping(address => bool) hasDeposited;
        mapping(address => address) partyVote; // Who each party thinks won
        uint256 voteCount;
        address winner;
        Status status;
        uint256 createdAt;
        uint256 expiresAt;
        string aiVerdict;
    }

    uint256 public nextBetId;
    mapping(uint256 => Bet) public bets;
    mapping(address => uint256[]) public userBets;
    address public arbiter; // AI/Admin fallback

    event BetCreated(uint256 indexed betId, address indexed creator, string title, uint256 stake, address token);
    event PartyJoined(uint256 indexed betId, address indexed party);
    event BetLocked(uint256 indexed betId);
    event VoteCast(uint256 indexed betId, address indexed voter, address indexed winnerCandidate);
    event BetResolved(uint256 indexed betId, address indexed winner, uint256 payout, string verdict);
    event BetCancelled(uint256 indexed betId);

    constructor() {
        arbiter = msg.sender;
    }

    modifier onlyParty(uint256 betId) {
        require(_isParty(betId, msg.sender), "Not a party");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Not arbiter");
        _;
    }

    function createBet(
        string calldata title,
        string calldata description,
        uint256 durationSeconds,
        address[] calldata otherParties,
        address tokenAddress,
        uint256 stakeAmount
    ) external payable returns (uint256) {
        if (tokenAddress == address(0)) {
            require(msg.value > 0, "Stake must be > 0");
            stakeAmount = msg.value;
        } else {
            require(msg.value == 0, "Native value sent for ERC20 bet");
            IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), stakeAmount);
        }

        uint256 betId = nextBetId++;
        Bet storage bet = bets[betId];
        bet.id = betId;
        bet.creator = msg.sender;
        bet.title = title;
        bet.description = description;
        bet.stakePerPerson = stakeAmount;
        bet.tokenAddress = tokenAddress;
        bet.status = Status.Open;
        bet.createdAt = block.timestamp;
        bet.expiresAt = block.timestamp + durationSeconds;

        bet.parties.push(msg.sender);
        bet.hasDeposited[msg.sender] = true;

        for (uint i = 0; i < otherParties.length; i++) {
            bet.parties.push(otherParties[i]);
        }

        userBets[msg.sender].push(betId);
        emit BetCreated(betId, msg.sender, title, stakeAmount, tokenAddress);
        return betId;
    }

    function joinBet(uint256 betId) external payable onlyParty(betId) {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Open, "Not open");
        require(!bet.hasDeposited[msg.sender], "Already in");

        if (bet.tokenAddress == address(0)) {
            require(msg.value == bet.stakePerPerson, "Wrong stake");
        } else {
            IERC20(bet.tokenAddress).safeTransferFrom(msg.sender, address(this), bet.stakePerPerson);
        }

        bet.hasDeposited[msg.sender] = true;
        userBets[msg.sender].push(betId);
        emit PartyJoined(betId, msg.sender);

        if (_allDeposited(betId)) {
            bet.status = Status.Locked;
            emit BetLocked(betId);
        }
    }

    /**
     * @dev Parties vote for the winner. Unanimous vote triggers resolution.
     */
    function confirmWinner(uint256 betId, address winnerCandidate) external onlyParty(betId) {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Locked, "Bet must be locked");
        require(_isParty(betId, winnerCandidate), "Winner must be a party");
        require(bet.partyVote[msg.sender] == address(0), "Already voted");

        bet.partyVote[msg.sender] = winnerCandidate;
        bet.voteCount++;
        
        emit VoteCast(betId, msg.sender, winnerCandidate);

        if (_isUnanimous(betId, winnerCandidate)) {
            _resolve(betId, winnerCandidate, "Unanimous agreement");
        }
    }

    /**
     * @dev Fallback for disputes or when consensus isn't reached.
     */
    function arbiterResolve(uint256 betId, address winner, string calldata verdict) external onlyArbiter {
        _resolve(betId, winner, verdict);
    }

    function _resolve(uint256 betId, address winner, string memory verdict) internal {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Locked, "Not locked");
        
        bet.winner = winner;
        bet.aiVerdict = verdict;
        bet.status = Status.Resolved;

        uint256 totalPot = bet.stakePerPerson * bet.parties.length;
        if (bet.tokenAddress == address(0)) {
            payable(winner).transfer(totalPot);
        } else {
            IERC20(bet.tokenAddress).safeTransfer(winner, totalPot);
        }
        emit BetResolved(betId, winner, totalPot, verdict);
    }

    function _isUnanimous(uint256 betId, address candidate) internal view returns (bool) {
        Bet storage bet = bets[betId];
        if (bet.voteCount < bet.parties.length) return false;
        
        for (uint i = 0; i < bet.parties.length; i++) {
            if (bet.partyVote[bet.parties[i]] != candidate) return false;
        }
        return true;
    }

    function _isParty(uint256 betId, address addr) internal view returns (bool) {
        address[] storage parties = bets[betId].parties;
        for (uint i = 0; i < parties.length; i++) {
            if (parties[i] == addr) return true;
        }
        return false;
    }

    function _allDeposited(uint256 betId) internal view returns (bool) {
        Bet storage bet = bets[betId];
        for (uint i = 0; i < bet.parties.length; i++) {
            if (!bet.hasDeposited[bet.parties[i]]) return false;
        }
        return true;
    }

    // Views for UI
    function getBetInfo(uint256 betId) external view returns (
        address creator,
        string memory title,
        uint256 stake,
        uint256 partyCount,
        Status status,
        address winner,
        uint256 voteCount
    ) {
        Bet storage bet = bets[betId];
        return (bet.creator, bet.title, bet.stakePerPerson, bet.parties.length, bet.status, bet.winner, bet.voteCount);
    }
    
    function getPartyVote(uint256 betId, address party) external view returns (address) {
        return bets[betId].partyVote[party];
    }

    function getParties(uint256 betId) external view returns (address[] memory) {
        return bets[betId].parties;
    }
}
