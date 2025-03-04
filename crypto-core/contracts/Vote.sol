// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.2 <0.9.0;

/** 
 * @title Vote
 * @dev Implements voting creation and retrieval
 */
contract Vote {
    struct VoteStruct {
        uint256 id;
        string title;
        string description;
        uint256 startDate;
        uint256 endDate;
        string status;
        uint256 participantCount;
        string[] options;
    }

    mapping(uint256 => VoteStruct) public votes; // Mapping for easy lookup
    mapping(uint256 => address[]) public secretHolders; // Mapping for secret holders of each vote
    uint256 public voteCount;

    event VoteCreated(uint256 id, string title);
    event SecretHolderAdded(uint256 voteId, address secretHolder);

    function createVote(
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate,
        string memory status,
        uint256 participantCount,
        string[] memory options
    ) public returns (uint256) {
        votes[voteCount] = VoteStruct(voteCount, title, description, startDate, endDate, status, participantCount, options);
        emit VoteCreated(voteCount, title);
        voteCount++;
        return voteCount - 1;
    }

    function getVote(uint256 voteId) public view returns (
        uint256 id,
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate,
        string memory status,
        uint256 participantCount,
        string[] memory options
    ) {
        require(voteId < voteCount, "Vote does not exist");
        VoteStruct memory v = votes[voteId];
        return (v.id, v.title, v.description, v.startDate, v.endDate, v.status, v.participantCount, v.options);
    }

    function addSecretHolder(uint256 voteId, address secretHolder) public {
        require(voteId < voteCount, "Vote does not exist");
        secretHolders[voteId].push(secretHolder);
        emit SecretHolderAdded(voteId, secretHolder);
    }

    function getSecretHolders(uint256 voteId) public view returns (address[] memory) {
        require(voteId < voteCount, "Vote does not exist");
        return secretHolders[voteId];
    }
}
