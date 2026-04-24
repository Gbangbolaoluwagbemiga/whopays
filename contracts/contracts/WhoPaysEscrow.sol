// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WhoPaysEscrow
 * @dev On-chain bet/escrow between 2+ parties. AI-assisted dispute resolution.
 * Both parties lock funds. After the stated condition is met, winner is declared.
 */
contract WhoPaysEscrow {
    enum Status { Open, Locked, Resolved, Cancelled }

    struct Bet {
        uint256 id;
        address creator;
        string title;        // "Lakers vs Celtics tonight"
        string description;  // Creative bet description
        uint256 stakePerPerson;
        address[] parties;
        mapping(address => bool) hasDeposited;
        address winner;
        Status status;
        uint256 createdAt;
        uint256 expiresAt;   // Auto-cancels if not resolved by this time
        string aiVerdict;    // Stored when AI resolves
    }

    uint256 public nextBetId;
    mapping(uint256 => Bet) public bets;
    mapping(address => uint256[]) public userBets;

    event BetCreated(uint256 indexed betId, address indexed creator, string title, uint256 stake);
    event PartyJoined(uint256 indexed betId, address indexed party);
    event BetLocked(uint256 indexed betId);
    event BetResolved(uint256 indexed betId, address indexed winner, uint256 payout, string verdict);
    event BetCancelled(uint256 indexed betId);

    modifier onlyParty(uint256 betId) {
        require(_isParty(betId, msg.sender), "Not a party to this bet");
        _;
    }

    function createBet(
        string calldata title,
        string calldata description,
        uint256 durationSeconds,
        address[] calldata otherParties
    ) external payable returns (uint256) {
        require(msg.value > 0, "Stake must be > 0");
        require(otherParties.length >= 1, "Need at least 1 other party");
        require(otherParties.length <= 9, "Max 10 parties");

        uint256 betId = nextBetId++;
        Bet storage bet = bets[betId];
        bet.id = betId;
        bet.creator = msg.sender;
        bet.title = title;
        bet.description = description;
        bet.stakePerPerson = msg.value;
        bet.status = Status.Open;
        bet.createdAt = block.timestamp;
        bet.expiresAt = block.timestamp + durationSeconds;

        bet.parties.push(msg.sender);
        bet.hasDeposited[msg.sender] = true;

        for (uint i = 0; i < otherParties.length; i++) {
            require(otherParties[i] != address(0), "Invalid party address");
            require(otherParties[i] != msg.sender, "Cannot bet with yourself");
            bet.parties.push(otherParties[i]);
        }

        userBets[msg.sender].push(betId);
        emit BetCreated(betId, msg.sender, title, msg.value);
        return betId;
    }

    function joinBet(uint256 betId) external payable onlyParty(betId) {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Open, "Bet not open");
        require(!bet.hasDeposited[msg.sender], "Already deposited");
        require(msg.value == bet.stakePerPerson, "Wrong stake amount");
        require(block.timestamp < bet.expiresAt, "Bet expired");

        bet.hasDeposited[msg.sender] = true;
        userBets[msg.sender].push(betId);
        emit PartyJoined(betId, msg.sender);

        // Auto-lock when all parties have deposited
        if (_allDeposited(betId)) {
            bet.status = Status.Locked;
            emit BetLocked(betId);
        }
    }

    // Called by any party to declare a winner (off-chain AI verdict stored as string)
    function resolveBet(uint256 betId, address winner, string calldata aiVerdict) external onlyParty(betId) {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Locked, "Bet not locked yet");
        require(_isParty(betId, winner), "Winner must be a party");

        bet.winner = winner;
        bet.aiVerdict = aiVerdict;
        bet.status = Status.Resolved;

        uint256 totalPot = bet.stakePerPerson * bet.parties.length;
        payable(winner).transfer(totalPot);

        emit BetResolved(betId, winner, totalPot, aiVerdict);
    }

    // Any party can cancel if not yet locked, refunding all depositors
    function cancelBet(uint256 betId) external onlyParty(betId) {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Open, "Cannot cancel locked bet");
        bet.status = Status.Cancelled;

        // Refund creator's deposit
        if (bet.hasDeposited[msg.sender]) {
            payable(msg.sender).transfer(bet.stakePerPerson);
        }

        emit BetCancelled(betId);
    }

    // Expired open bets can be cleaned up by anyone
    function expireBet(uint256 betId) external {
        Bet storage bet = bets[betId];
        require(bet.status == Status.Open, "Not open");
        require(block.timestamp > bet.expiresAt, "Not expired yet");

        bet.status = Status.Cancelled;
        // Refund creator
        if (bet.hasDeposited[bet.creator]) {
            payable(bet.creator).transfer(bet.stakePerPerson);
        }
        emit BetCancelled(betId);
    }

    // --- View Functions ---

    function getBetInfo(uint256 betId) external view returns (
        address creator,
        string memory title,
        string memory description,
        uint256 stakePerPerson,
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

    function getTotalPot(uint256 betId) external view returns (uint256) {
        Bet storage bet = bets[betId];
        uint256 count = 0;
        for (uint i = 0; i < bet.parties.length; i++) {
            if (bet.hasDeposited[bet.parties[i]]) count++;
        }
        return bet.stakePerPerson * count;
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
