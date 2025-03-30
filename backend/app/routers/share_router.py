"""
Share router for managing secret shares in the system.
"""
from fastapi import APIRouter, Depends, HTTPException
from collections import defaultdict

from app.core.dependencies import get_blockchain_service, get_db
from app.core.error_handling import handle_blockchain_error
from app.schemas import (
    ShareSubmitRequest, 
    ShareVerificationRequest, 
    ShareVerificationResponse,
    StandardResponse,
    TransactionResponse
)
from app.core.config import (
    WALLET_ADDRESS,
    PRIVATE_KEY,
)
from app.services.blockchain import BlockchainService

import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shares", tags=["Shares"])

@router.post("/submit-share/{election_id}")
async def submit_share(election_id: int, data: dict, blockchain_service: BlockchainService = Depends(get_blockchain_service), db=Depends(get_db)):
    # Convert public key to bytes and then to hex
    public_key_bytes = bytes(data["public_key"].values())
    public_key_hex = "0x" + public_key_bytes.hex()
    
    is_share_released = await db.public_keys.find_one({"public_key": public_key_hex})
    logger.info(is_share_released)
    if is_share_released and "released_secret" in is_share_released:
        raise HTTPException(status_code=400, detail="secret share has already been released")
    
    submitted_shares = await blockchain_service.call_contract_function("getShares", election_id)
    existing_shares = {(share_tuple[0], share_tuple[1]) for share_tuple in submitted_shares}
    filtered_shares = [
        (share["vote_id"], share["share"]) 
        for share in data["shares"] 
        if (share["vote_id"], share["share"]) not in existing_shares
    ]

    if filtered_shares:
        vote_id = [share[0] for share in filtered_shares]
        share = [share[1] for share in filtered_shares]
        
        nonce = blockchain_service.w3.eth.get_transaction_count(WALLET_ADDRESS)

        estimated_gas = blockchain_service.contract.functions.submitShares(
            election_id,
            vote_id,
            public_key_hex,
            share
        ).estimate_gas({"from": WALLET_ADDRESS})

        submit_share_tx = blockchain_service.contract.functions.submitShares(
            election_id,
            vote_id,
            public_key_hex,
            share
        ).build_transaction({
            'from': WALLET_ADDRESS,
            'gas': estimated_gas,
            'gasPrice': blockchain_service.w3.eth.gas_price,
            'nonce': nonce,
        })

        # Sign and send the transaction
        signed_tx = blockchain_service.w3.eth.account.sign_transaction(submit_share_tx, PRIVATE_KEY)
        tx_hash = blockchain_service.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = blockchain_service.w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt.status == 1:
            filter_criteria = {"public_key": public_key_hex}
            update_field = {"$set": {"released_secret": True}}
            await db.public_keys.update_one(filter_criteria, update_field)
        else:
            raise HTTPException(status_code=500, detail="secret share failed to be stored on the blockchain")
    else:
        raise HTTPException(status_code=400, detail="secret share has already been released")


@router.get("/decryption-status/{election_id}")
async def decryption_status(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    shares = await blockchain_service.call_contract_function("getShares", election_id)
    
    votes = await blockchain_service.call_contract_function("getVotes", election_id)

    logger.info(shares)
    logger.info(votes)
    
    vote_shares = defaultdict(list)
    share_indexes = defaultdict(list)
    
    for vote_id, public_key, share, index in shares:
        vote_shares[vote_id].append(share)
        share_indexes[vote_id].append(index + 1)  # Optional, if you want to shift indexes by 1

    # Sort the shares and indexes for each vote_id based on indexes
    for vote_id in vote_shares:
        sorted_shares_indexes = sorted(zip(share_indexes[vote_id], vote_shares[vote_id]))
        sorted_indexes, sorted_shares = zip(*sorted_shares_indexes)

        share_indexes[vote_id] = list(sorted_indexes)
        vote_shares[vote_id] = list(sorted_shares)


@router.post("/verify", response_model=StandardResponse[ShareVerificationResponse])
async def verify_share(
    request: ShareVerificationRequest,
    blockchain_service: BlockchainService = Depends(get_blockchain_service)
):
    """Verify a share submission."""
    try:
        # Convert share tuple to list
        share_list = list(request.share)
        is_valid = await blockchain_service.verify_share_submission(
            vote_id=request.vote_id,
            holder_address=request.holder_address,
            share=share_list
        )
        
        return StandardResponse(
            success=True,
            message="Share verification successful" if is_valid else "Share verification failed",
            data=ShareVerificationResponse(
                valid=is_valid,
                holder_address=request.holder_address,
                vote_id=request.vote_id
            )
        )
    except Exception as e:
        logger.error(f"Error verifying share: {str(e)}")
        raise handle_blockchain_error("verify share", e)


@router.get("/get-shares/{election_id}")
async def get_shares(election_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    try:
        # Call the blockchain service to decrypt the vote
        shares = await blockchain_service.call_contract_function("getShares", election_id)
        
        # Create a dictionary to store the sorted shares and their corresponding indexes for each vote_id
        vote_shares = defaultdict(list)
        share_indexes = defaultdict(list)

        for vote_id, public_key, share, index in shares:
            vote_shares[vote_id].append(share)
            share_indexes[vote_id].append(index + 1)  # Optional, if you want to shift indexes by 1

        # Sort the shares and indexes for each vote_id based on indexes
        for vote_id in vote_shares:
            sorted_shares_indexes = sorted(zip(share_indexes[vote_id], vote_shares[vote_id]))
            sorted_indexes, sorted_shares = zip(*sorted_shares_indexes)

            share_indexes[vote_id] = list(sorted_indexes)
            vote_shares[vote_id] = list(sorted_shares)
            
        return share_indexes, vote_shares

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error decrypting vote: {str(e)}")
        raise handle_blockchain_error("decrypt vote", e)