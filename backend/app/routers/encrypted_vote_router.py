"""
Encrypted Vote router for managing encrypted votes in the system.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from fastapi.responses import JSONResponse

from app.core.dependencies import get_blockchain_service, get_db
from app.core.error_handling import handle_blockchain_error, handle_validation_error
from app.core.config import (
    WALLET_ADDRESS,
    PRIVATE_KEY,
)
from app.schemas import (
    StandardResponse,
    TransactionResponse,
)
from app.schemas.encrypted_vote import PublicKeyValidateRequest

from app.services.blockchain import BlockchainService

import logging
import asyncio
import re # Import regex for hex checking
from binascii import unhexlify # Import for hex decoding
from web3.exceptions import ContractLogicError

# Configure logging
logger = logging.getLogger(__name__)

# Update Router Prefix and Tag
router = APIRouter(prefix="/encrypted-votes", tags=["Encrypted Votes"])


@router.post("/validate-public-key", response_model=StandardResponse[bool])
async def validate_public_key(request: PublicKeyValidateRequest, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Validates the provided BLS public key format."""
    public_key_hex = request.public_key
    logger.info(f"Validating public key format: {public_key_hex}")

    is_valid_format = False
    try:
        # Basic format check: Starts with '0x', followed by hex characters (adjust length check as needed for BLS keys)
        if isinstance(public_key_hex, str) and public_key_hex.startswith("0x") and len(public_key_hex) > 4 and re.fullmatch(r'0x[0-9a-fA-F]+', public_key_hex):
            is_valid_format = True # Placeholder: Real validation might involve checking against known keys or cryptographic properties
        else:
             logger.warning(f"Invalid format for public key: {public_key_hex}")

    except Exception as e:
        logger.error(f"Error during public key validation for {public_key_hex}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during key validation.")

    if not is_valid_format:
         # Return success=True, but data=False, as the endpoint worked but the key is invalid
         return StandardResponse(success=True, message="Public key format is not valid.", data=False)

    # If format is valid, return success=True and data=True
    # Note: This currently only checks format, not cryptographic validity or existence in a specific context
    return StandardResponse(
        success=True,
        message="Public key format validated successfully.",
        data=True 
    )


@router.post("/info/{vote_session_id}", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_encrypted_vote_info(vote_session_id: int, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Retrieve all submitted encrypted vote data for a specific vote session."""
    try:
        all_votes_data = []
        votes_from_chain = await blockchain_service.call_contract_function("getEncryptedVotes", vote_session_id)
        for index, vote_tuple in enumerate(votes_from_chain):
            all_votes_data.append({
                "id": vote_session_id,
                "vote_id": index,
                "ciphertext": vote_tuple[1],
                "g1r": vote_tuple[2],
                "g2r": vote_tuple[3],
                "alphas": vote_tuple[4],
                "voter": vote_tuple[5],
                "threshold": vote_tuple[6]
            })
        return StandardResponse(
            success=True,
            message=f"Successfully retrieved encrypted vote information for session {vote_session_id}",
            data=all_votes_data
        )
    except Exception as e:
        logger.error(f"Error getting encrypted vote information for session {vote_session_id}: {str(e)}")
        raise handle_blockchain_error("get encrypted vote information", e)


@router.post("/submit/{vote_session_id}", response_model=StandardResponse[TransactionResponse])
async def submit_encrypted_vote(vote_session_id: int, request: dict, blockchain_service: BlockchainService = Depends(get_blockchain_service)):
    """Submits an encrypted vote to the specified vote session."""

    # --- Validate Voter Address --- 
    voter_address = request.get("voter")
    if not voter_address or not isinstance(voter_address, str):
        raise HTTPException(status_code=422, detail="Missing or invalid 'voter' field (string expected).")
    try:
        voter_address = blockchain_service.w3.to_checksum_address(voter_address)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid voter address format.")

    # --- Check if Already Voted --- 
    votes_from_chain = await blockchain_service.call_contract_function("getEncryptedVotes", vote_session_id)
    if (any(entry[5] == voter_address for entry in votes_from_chain)):
        raise HTTPException(status_code=400, detail="Voter has already cast a vote in this session")

    # --- Validate Holder Addresses --- 
    holder_addresses_input = request.get("holderAddresses")
    if not holder_addresses_input or not isinstance(holder_addresses_input, list):
        raise HTTPException(status_code=422, detail="Missing or invalid 'holderAddresses' field (list expected).")
    holder_addresses_checksummed = []
    for addr_str in holder_addresses_input:
        if not isinstance(addr_str, str):
             raise HTTPException(status_code=422, detail=f"Invalid item type in 'holderAddresses' list (string expected). Item: {addr_str}")
        try:
            checksummed_addr = blockchain_service.w3.to_checksum_address(addr_str)
            holder_addresses_checksummed.append(checksummed_addr)
        except ValueError:
             raise HTTPException(status_code=422, detail=f"Invalid holder address format in list: {addr_str}")

    # --- Validate and Convert Required Fields for Contract Call --- 
    required_fields = ["ciphertext", "g1r", "g2r", "alphas", "threshold"]
    contract_args = {}
    for field in required_fields:
        if field not in request:
            raise HTTPException(status_code=422, detail=f"Missing required field: {field}")
        
        value = request[field]
        try:
            if field in ["ciphertext", "g1r", "g2r"]:
                # Convert hex string to bytes
                if not isinstance(value, str):
                    raise ValueError(f"Field '{field}' must be a hex string.")
                hex_value = value[2:] if value.startswith('0x') else value
                contract_args[field] = unhexlify(hex_value)
            elif field == "alphas":
                # Ensure it's a list of strings, convert each DECIMAL string to bytes (via int)
                if not isinstance(value, list):
                    raise ValueError("Field 'alphas' must be a list of strings.")
                alphas_bytes_list = [] # Changed variable name
                for alpha_str in value:
                    if not isinstance(alpha_str, str):
                         raise ValueError(f"Invalid item type in 'alphas' list (string expected). Item: {alpha_str}")
                    # Convert the decimal string to integer, then to bytes
                    try:
                        alpha_int = int(alpha_str) 
                        # Convert integer to 32 bytes (big-endian), adjust length if needed
                        byte_length = 32 
                        alpha_bytes = alpha_int.to_bytes(byte_length, byteorder='big', signed=False)
                        alphas_bytes_list.append(alpha_bytes) # Append bytes
                    except ValueError as inner_e:
                        logger.error(f"Failed to convert alpha string '{alpha_str}' to integer: {inner_e}")
                        raise ValueError(f"Invalid integer format in 'alphas' list for item: {alpha_str}")
                    except OverflowError as oe:
                        logger.error(f"Alpha value '{alpha_str}' is too large to fit into {byte_length} bytes: {oe}")
                        raise ValueError(f"Alpha value is too large: {alpha_str}")
                contract_args[field] = alphas_bytes_list # Now a list[bytes]
            elif field == "threshold":
                contract_args[field] = int(value) 
            else:
                contract_args[field] = value # Should not happen
        except (ValueError, TypeError) as e:
            logger.error(f"Validation/Conversion Error for field '{field}': {e}")
            raise HTTPException(status_code=422, detail=f"Invalid format or value for field: {field}. {e}")
        except Exception as e: 
             logger.error(f"Error processing field '{field}': {e}")
             raise HTTPException(status_code=422, detail=f"Error processing field: {field}. {e}")

    # --- Prepare Arguments for Contract Call --- 
    try:
        vote_session_id_int = int(vote_session_id)
    except (ValueError, TypeError):
         raise HTTPException(status_code=400, detail="Invalid vote_session_id format.")

    # Order must match contract function signature!
    # submitEncryptedVote(uint256 voteSessionId, address voter, address[] memory _holderAddresses, bytes memory ciphertext, bytes memory g1r, bytes memory g2r, bytes[] memory alpha, uint256 threshold)
    args_for_contract = [
        vote_session_id_int,               # uint256
        voter_address,                   # address (The actual voter from the request)
        holder_addresses_checksummed,    # address[]
        contract_args["ciphertext"],     # bytes
        contract_args["g1r"],            # bytes
        contract_args["g2r"],            # bytes
        contract_args["alphas"],         # NOW list[bytes]
        contract_args["threshold"]       # uint256
    ]

    # --- Estimate Gas and Send Transaction --- 
    try:
        nonce = await asyncio.to_thread(blockchain_service.w3.eth.get_transaction_count, WALLET_ADDRESS)

        logger.debug(f"Calling submitEncryptedVote with args: {args_for_contract}")
        # Gas estimation might raise ContractLogicError if require fails (e.g., already voted)
        estimated_gas = await asyncio.to_thread(
            blockchain_service.contract.functions.submitEncryptedVote(*args_for_contract).estimate_gas,
            {'from': WALLET_ADDRESS}
        )
        logger.info(f"Estimated gas for submitEncryptedVote: {estimated_gas}")

        create_vote_tx = blockchain_service.contract.functions.submitEncryptedVote(*args_for_contract).build_transaction({
            'from': WALLET_ADDRESS,
            'gas': estimated_gas + 50000, # Add buffer
            'gasPrice': await asyncio.to_thread(getattr, blockchain_service.w3.eth, 'gas_price'),
            'nonce': nonce,
        })

        signed_tx = blockchain_service.w3.eth.account.sign_transaction(create_vote_tx, PRIVATE_KEY)
        tx_hash = await asyncio.to_thread(blockchain_service.w3.eth.send_raw_transaction, signed_tx.raw_transaction)
        receipt = await asyncio.to_thread(blockchain_service.w3.eth.wait_for_transaction_receipt, tx_hash, timeout=180) # Increased timeout
        
    except ContractLogicError as e: # <-- Catch specific ContractLogicError first
        error_message = str(e)
        if "Voter already voted" in error_message:
            # Log as warning (less severe) without full traceback for this expected case
            logger.warning(f"Blocked attempt to double vote by {voter_address} in session {vote_session_id}: {error_message}") 
            raise HTTPException(status_code=400, detail="Voter has already cast a vote in this session.")
        elif "Vote Session not started" in error_message:
            # Log as warning for this potentially expected case too
            logger.warning(f"Blocked vote submission for inactive session {vote_session_id}: {error_message}")
            raise HTTPException(status_code=400, detail="Vote Session not started.")
        else:
            # Unexpected contract logic error, log full traceback
            logger.exception(f"Unexpected ContractLogicError during submitEncryptedVote for session {vote_session_id}: {e}")
            raise handle_blockchain_error("submit encrypted vote transaction (contract logic error)", e)

    except Exception as e: # <-- Catch other exceptions (network, timeout, etc.)
        logger.exception(f"Non-Contract blockchain transaction error during submitEncryptedVote for session {vote_session_id}: {e}")
        raise handle_blockchain_error("submit encrypted vote transaction (general error)", e)

    # --- Process Receipt --- 
    if receipt.status == 1:
        logger.info(f"Successfully submitted encrypted vote for session {vote_session_id}. Tx: {receipt.transactionHash.hex()}")
        return StandardResponse(
            success=True,
            message="Encrypted vote submitted successfully.",
            data=TransactionResponse(
                success=True,
                message="Encrypted vote submitted successfully.",
                transaction_hash=receipt.transactionHash.hex()
            )
        )
    else:
        revert_reason = "Encrypted vote submission transaction failed."
        try:
            tx = await asyncio.to_thread(blockchain_service.w3.eth.get_transaction, tx_hash)
            revert_data = await asyncio.to_thread(
                blockchain_service.w3.eth.call,
                {'to': tx['to'], 'from': tx['from'], 'value': tx['value'], 'data': tx['input']},
                tx['blockNumber'] - 1
            )
            if revert_data.startswith(b'\x08\xc3y\xa0'):
                 decoded_reason = await asyncio.to_thread(blockchain_service.w3.codec.decode, ['string'], revert_data[4:])
                 revert_reason += " Reason: " + decoded_reason[0]
        except Exception as e:
             logger.warning(f"Could not retrieve revert reason for encrypted vote tx {tx_hash.hex()}: {e}")

        logger.error(f"Encrypted vote submission transaction failed for session {vote_session_id}. Tx: {tx_hash.hex()}. Reason: {revert_reason}")
        raise HTTPException(status_code=500, detail=revert_reason)
