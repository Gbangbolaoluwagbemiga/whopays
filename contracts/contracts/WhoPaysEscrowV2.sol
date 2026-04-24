// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title WhoPaysEscrowV2
 * @dev Supports native CELO and ERC20 (cUSD/cEUR). 
 * Includes time extension and improved multi-party logic.
 */
contract WhoPaysEscrowV2 {
    using SafeERC20 for IERC20;

    enum Status { Open, Locked, Resolved, Cancelled }

    struct Bet {
        uint256 id;
        address creator;
        string title;
        string description;
        uint256 stakePerPerson;
        address tokenAddress; // address(0) for native CELO
        address[] parties;
        mapping(address => bool) hasDeposited;
        address winner;
        Status status;
        uint256 createdAt;
        uint256 expiresAt;
        string aiVerdict;
    }

    uint256 public nextBetId;
    mapping(uint256 => Bet) public bets;
    mapping(address => uint256[]) public userBets;

    event BetCreated(uint256 indexed betId, address indexed creator, string title, uint256 stake, address token);
    event PartyJoined(uint256 indexed betId, address indexed party);
    event BetLocked(uint256 indexed betId);
    event BetResolved(uint256 indexed betId, address indexed winner, uint256 payout, string verdict);
    event BetCancelled(uint256 indexed betId);
    event TimeExtended(uint256 indexed betId, uint256 newExpiresAt);

    modifier onlyParty(uint256 betId) {
        require(_isParty(betId, msg.sender), "Not a party");
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
            require(stakeAmount > 0, "Stake must be > 0");
            IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), stakeAmount);
        }

        require(otherParties.length >= 1, "Min 1 other party");
        require(otherParties.length <= 19, "Max 20 parties");

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
            require(otherParties[i] != address(0), "Invalid address");
            require(otherParties[i] != msg.sender, "No self-bet");
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
        require(block.timestamp < bet.expiresAt, "Expired");

        if (bet.tokenAddress == address(0)) {
            require(msg.value == bet.stakePerPerson, "Wrong stake");
        } else {
            require(msg.value == 0, "Native sent for ERC20");
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

    function resolveBet(uint256 betId, address winner, string calldata aiVerdict) external onlyParty(betId) {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Locked, "Not locked");
        require(_isParty(betId, winner), "Invalid winner");

        bet.winner = winner;
        bet.aiVerdict = aiVerdict;
        bet.status = Status.Resolved;

        uint256 totalPot = bet.stakePerPerson * bet.parties.length;
        
        if (bet.tokenAddress == address(0)) {
            payable(winner).transfer(totalPot);
        } else {
            IERC20(bet.tokenAddress).safeTransfer(winner, totalPot);
        }

        emit BetResolved(betId, winner, totalPot, aiVerdict);
    }

    function extendTime(uint256 betId, uint256 additionalSeconds) external onlyParty(betId) {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Open || bet.status == Status.Locked, "Cannot extend");
        bet.expiresAt += additionalSeconds;
        emit TimeExtended(betId, bet.expiresAt);
    }

    function cancelBet(uint256 betId) external onlyParty(betId) {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Open, "Locked");
        bet.status = Status.Cancelled;

        if (bet.hasDeposited[msg.sender]) {
            if (bet.tokenAddress == address(0)) {
                payable(msg.sender).transfer(bet.stakePerPerson);
            } else {
                IERC20(bet.tokenAddress).safeTransfer(msg.sender, bet.stakePerPerson);
            }
        }
        emit BetCancelled(betId);
    }

    // --- Views ---

    function getBetInfo(uint256 betId) external view returns (
        address creator,
        string memory title,
        string memory description,
        uint256 stakePerPerson,
        address tokenAddress,
        uint256 partyCount,
        address winner,
        Status status,
        uint256 expiresAt,
        string memory aiVerdict
    ) {
        Bet storage bet = bets[betId];
        return (
            bet.creator,
            bet.title,
            bet.description,
            bet.stakePerPerson,
            bet.tokenAddress,
            bet.parties.length,
            bet.winner,
            bet.status,
            bet.expiresAt,
            bet.aiVerdict
        );
    }

    function getParties(uint256 betId) external view returns (address[] memory) {
        return bets[betId].parties;
    }

    function hasDeposited(uint256 betId, address party) external view returns (bool) {
        return bets[betId].hasDeposited[party];
    }

    function getUserBets(address user) external view returns (uint256[] memory) {
        return userBets[user];
    }

    // --- Internal ---

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
}
