// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TimeLockEncryption {
    mapping(uint256 => address) public committee;
    mapping(address => CommitteeMember) public publicKeys;
    mapping(address => RewardRecord[]) public uncollectedRewards;
    uint256 public globalLatestConfirmedTime = 0;
    TimeLockTransaction[] public transactions;
    uint256 public transactionCounter = 0;
    mapping(uint256 => mapping(address => bool)) public shareSubmitted;
    mapping(uint256 => DisputedShare[]) public disputedShares;
    uint256 public committeeSize = 0;
    uint256 public indexCount = 1;
    uint256 public GAS_ESTIMATION = 0.007 ether; // this should be constant or dynamically set basted on ETH prices and fees

    // these should not be constant but set upon vote creation
    uint256 public constant DEPOSIT_AMOUNT = 1 ether;
    uint256 public constant MAX_COMMITTEE_SIZE = 3;
    uint256 public constant THRESHOLD = 2;
    uint256 public constant FIXED_REWARD = 0.00022 ether;
    uint256 public constant TIME_TO_CONFIRM = 86400;

    address public owner;

    struct CommitteeMember {
        bytes publicKey;
        uint256 index;
    }

    struct RewardRecord {
        uint256 timestamp;
        uint256 amount;
    }

    struct TimeLockTransaction {
        uint256 id;
        uint256 decryptionTime;
        uint256 sharesReceived;
    }

    struct DisputedShare {
        address reporter;
        address member;
    }

    event transactionReceived(uint256 id, uint256 decryptionTime, bytes g1r, bytes g2r, bytes[] alphas);
    event shareRecieved(uint256 member, uint256 transactionID, bytes secretShare);
    event memberJoined(address member, uint256 index, bytes publicKey);
    event memberExited(uint256 member_index);

    modifier onlyCommittee() {
        require(publicKeys[msg.sender].index != 0, "Caller is not a committee member");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    modifier CommitteeInPlace() {
        require(committeeSize == MAX_COMMITTEE_SIZE, "Committee is not in place");
        _;
    }


    constructor() {
        owner = msg.sender;
    }
    // destroys the contract aka the vote, perhaps this should return money to everyone, not just send it all to the owner?
    function destroy(address payable recipient) external onlyOwner {
        selfdestruct(recipient);
    }

    function joinCommittee(bytes memory publicKey) public payable {
        require(committeeSize < MAX_COMMITTEE_SIZE, "Committee is full");
        require(publicKeys[msg.sender].index == 0, "Caller is already in the committee");
        require(msg.value >= DEPOSIT_AMOUNT, "Not enough deposit");

        publicKeys[msg.sender] = CommitteeMember(publicKey, indexCount);
        committee[indexCount] = msg.sender;
        emit memberJoined(msg.sender, indexCount, publicKey);

        ++committeeSize;
        ++indexCount;
    }
    // we should change it so if someone exits before the start of the vote they get their deposit back
    // and if they exit after they do not and their deposit will fuel rewards for others
    function exitCommittee() public onlyCommittee {
        bool allowExit = true;
        
        // TODO: delegation requirement
        require(allowExit, "You still have tasks, please finish existing tasks or delegate tasks.");
        removeFromCommittee(msg.sender);
        returnDeposit(msg.sender);
    }

    function removeFromCommittee(address member) internal{
        emit memberExited(publicKeys[member].index);
        committee[publicKeys[member].index] = address(0);
        delete publicKeys[member];

        --committeeSize;
    }

    function returnDeposit(address member) internal {
        payable(member).transfer(DEPOSIT_AMOUNT);
    }
    // this efectively starts the vote, sets the decryption time and the secret params (g1r g2r and alphas)
    // can only happen if committee is full. Perhaps the values of reward, threshold gas etc should be set here
    function sendTimeLockTransaction(uint256 decryptionTime, bytes memory g1r, bytes memory g2r, bytes[] memory alphas) public payable CommitteeInPlace(){
        require(decryptionTime > block.timestamp, "Decryption time must be in the future");
        require(msg.value >= (FIXED_REWARD + GAS_ESTIMATION) * THRESHOLD, "Not enough fee");

        uint256 transactionID = transactionCounter;
        transactions.push(TimeLockTransaction(transactionID, decryptionTime, 0));
        // emit event that agents are listening to
        emit transactionReceived(transactionID, decryptionTime, g1r, g2r, alphas);
        transactionCounter++;
    }

    function submitShare(uint256 transactionID, bytes memory secretShare) public onlyCommittee {
        require(block.timestamp >= transactions[transactionID].decryptionTime, "Decryption time not reached"); // perhaps in this case the sender should be penalied

        // emit event for agents
        emit shareRecieved(publicKeys[msg.sender].index, transactionID, secretShare);
        if (!shareSubmitted[transactionID][msg.sender]) {
            // The member has never submitted a share for this transaction before.
            shareSubmitted[transactionID][msg.sender] = true;
            transactions[transactionID].sharesReceived++;
            if (transactions[transactionID].sharesReceived <= THRESHOLD) { // this only rewards the first T holders who submit, we may wanna change this
                uncollectedRewards[msg.sender].push(RewardRecord(block.timestamp, (FIXED_REWARD + GAS_ESTIMATION)));
            }
        }
    }

    function disputeShare(uint256 transactionID, uint256 member_index) public onlyCommittee { // an agent calims a share was invalid
        require(transactionID < transactions.length, "Invalid transaction ID");
        require(committee[member_index] != address(0), "Disputed member is not in the committee");

        // Check if the caller has already reported the member for this transaction
        for (uint256 i = 0; i < disputedShares[transactionID].length; i++) {
            require(
                !(disputedShares[transactionID][i].reporter == msg.sender && disputedShares[transactionID][i].member == committee[member_index]),
                "Caller has already reported this member for this transaction"
            );
        }

        disputedShares[transactionID].push(DisputedShare(msg.sender, committee[member_index]));

        uint256 disputeCount = 0; // count number of disputed shares this memeber submitted
        for (uint256 i = 0; i < disputedShares[transactionID].length; i++) {
            if (disputedShares[transactionID][i].member == committee[member_index]) {
                disputeCount++;
            }
        }

        if (disputeCount >= THRESHOLD) { // if more than T holders disputed this holders shares penalize the holder
            // punish malicious agent
            removeFromCommittee(committee[member_index]);

            // reward honest agents
            for (uint256 i = 0; i < disputedShares[transactionID].length; i++) {
                if (disputedShares[transactionID][i].member == committee[member_index]) {
                    // perhaps instead of a fixed reward for honesty distribute the malicious agents deposit to the disputers
                    uncollectedRewards[disputedShares[transactionID][i].reporter].push(RewardRecord(block.timestamp, (FIXED_REWARD + GAS_ESTIMATION)));
                }
            }

            // delete share
            transactions[transactionID].sharesReceived--;
        }
    }

    function collectRewards() public onlyCommittee {
        uint256 rewardsToCollect = 0;
        uint256 confirmedTimestamp = block.timestamp - TIME_TO_CONFIRM;
        uint256 remainingIndex = 0;

        for (uint256 i = 0; i < uncollectedRewards[msg.sender].length; i++) {
            if (uncollectedRewards[msg.sender][i].timestamp <= confirmedTimestamp) {
                rewardsToCollect += uncollectedRewards[msg.sender][i].amount;
            } 
            else {
                if (remainingIndex != i) {
                    uncollectedRewards[msg.sender][remainingIndex] = uncollectedRewards[msg.sender][i];
                }
                remainingIndex++;
            }
        }

        require(rewardsToCollect > 0, "No rewards to collect");

        // Resize the array
        uint256 lengthToRemove = uncollectedRewards[msg.sender].length - remainingIndex;
        for (uint256 i = 0; i < lengthToRemove; i++) {
            uncollectedRewards[msg.sender].pop();
        }

        payable(msg.sender).transfer(rewardsToCollect);
    }
}