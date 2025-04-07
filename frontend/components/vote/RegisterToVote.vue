<template>
    <div class="voting-section">
      <h2>Register To Vote</h2>
      <!-- Encryption notice to inform users -->
      <div class="encryption-notice">
        <i class="lock-icon">📝</i>
        <p>The key pair generated here is essential for casting your vote. Your key is stored in your browser, return here to cast your vote.</p>
      </div>
      <div class="encryption-notice">
        <i class="lock-icon">📝</i>
        <p>You can choose to be a secret holder, which means you are a part of making sure votes remain secure.
          If you choose to become a secret holder, you will need to release your private key at the end of the vote: {{props.endDate}}.
          Note: You will only have 15 minutes to release your secrets.
        </p>
      </div>
    
      <!-- Voting form with radio options -->
      <form @submit.prevent="generateKeyPair" class="voting-form">
        <h3>Would you like to be a secret holder?</h3>
        <div class="options-list">
          <label class="option-item">
            <input
              type="radio"
              v-model="isSecretHolder"
              value="yes"
              name="secret-holder-option"
              required
            >
            <div class="option-content">
              Yes
            </div>
          </label>
          <label class="option-item">
            <input
              type="radio"
              v-model="isSecretHolder"
              value="no"
              name="secret-holder-option"
              required
            >
            <div class="option-content">
              No
            </div>
          </label>
        </div>
        <div v-if="isSecretHolder === 'yes'" class="alert-box">
          <strong>Reward Pool: {{ rewardPool }} ETH</strong>
          <p></p>
          <strong>Required Deposit: {{ requiredDeposit }} ETH</strong>
        </div>
        <button @click="generateKeyPair()" class="btn primary">
          Register To Vote
        </button>
        <!-- New styled alert box for votingToken -->
        <div v-if="pk" class="alert-box">
          <strong>The Key Pair Needed To Vote Has Been Stored. Return to this page to Cast Your Vote Later</strong>
        </div>
      </form>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import axios from 'axios'
  import { generateBLSKeyPair } from "../../services/blsUtils";
  import Cookies from "js-cookie";

  const pk = ref(null); // Make pk reactive

  const generateKeyPair = async () => {
    const { sk, pk: publicKey } = generateBLSKeyPair();
    
    console.log("Private Key:", sk.toString(16));
    console.log("Public Key:", publicKey.toHex());

    // Store the private key in a cookie for 1 day
    Cookies.set("privateKey", sk.toString(16), { expires: 1, secure: true, sameSite: "Strict" });
    storePublicKey()

    // Update the reactive pk variable to trigger UI update
    pk.value = publicKey.toHex();
  };

  
  const props = defineProps({
    voteId: {
      type: String,
      required: true
    },

    endDate: {
      type: String,
      required: true
    }
  })
  
  const isSecretHolder = ref('yes')
  const pk = ref(null);

  const emit = defineEmits(['registration-successful']);

  const generateKeyPair = async () => {
    const privateKeyCookie = `vote_${props.voteId}_privateKey`;
    const publicKeyCookie = `vote_${props.voteId}_publicKey`;
    const isHolderCookie = `vote_${props.voteId}_isHolder`;

    // Check if private key already exists for this vote
    if (Cookies.get(privateKeyCookie)) {
      // Maybe just fetch the existing public key?
      const existingPk = Cookies.get(publicKeyCookie);
      if (existingPk) {
          pk.value = existingPk; // Use existing public key
          // Decide if we need to call storePublicKey again or just inform the user
          alert("You have already registered for this vote with this browser.");
          return; // Stop execution
      } else {
         // This case (private key exists but public key doesn't) shouldn't happen
         // but handle it just in case, maybe by regenerating.
         console.warn("Inconsistent state: Private key found but public key missing for this vote. Regenerating...");
         Cookies.remove(privateKeyCookie); // Remove potentially stale private key
      }
    }

    const { sk, pk: publicKey } = generateBLSKeyPair();
    const privateKeyHex = sk.toString(16);
    // Log the publicKey object to see what it actually is
    console.log('Inspecting publicKey object:', publicKey);
    const publicKeyHex = publicKey.toHex();

    // Store the private key in a cookie for this specific vote
    Cookies.set(privateKeyCookie, privateKeyHex, { expires: 365, secure: true, sameSite: "Strict" });
    // Store the public key in a cookie for this specific vote
    Cookies.set(publicKeyCookie, publicKeyHex, { expires: 365, secure: true, sameSite: "Strict" });
    // Store holder status (initially false, updated in storePublicKey)
    Cookies.set(isHolderCookie, 'false', { expires: 365, secure: true, sameSite: "Strict" });

    // Update the reactive pk variable
    pk.value = publicKeyHex; // Use the hex string

    // Proceed to store public key on backend
    storePublicKey();
  };

  // Method to store public key and potentially join as holder
  const storePublicKey = async () => {
    if (!pk.value) {
      alert("Key pair not generated yet.");
      return;
    }

    const isHolder = isSecretHolder.value === 'yes';
    const isHolderCookie = `vote_${props.voteId}_isHolder`;
    const publicKeyCookie = `vote_${props.voteId}_publicKey`;

    // Update the holder status cookie
    Cookies.set(isHolderCookie, isHolder.toString(), { expires: 365, secure: true, sameSite: "Strict" });

    try {
      // Store public key (and holder status) on backend
      const response = await voteApi.storePublicKey(props.voteId, {
        public_key: pk.value, // Send hex string
        is_secret_holder: isHolder
      });

      // Join as holder on blockchain if chosen
      if (isHolder) {
        await joinAsSecretHolder(props.voteId, pk.value);
        alert("Successfully registered as secret holder.");
      } else {
        alert("Successfully registered as voter.");
      }
      
      // Emit event upon successful registration
      emit('registration-successful');

    } catch (err) {
      console.error('Failed during registration:', err);
      // Reset cookies if registration failed?
      // Cookies.remove(publicKeyCookie);
      // Cookies.remove(isHolderCookie);
      // Cookies.remove(`vote_${props.voteId}_privateKey`); // Also remove private key
      alert(err.response?.data?.detail || err.message || 'Failed during registration. Please try again.');
      // Maybe reset pk.value = null; here?
    }
  }

  const joinAsSecretHolder = async (vote_id, public_key) => {
    try {
      // Public key is already a hex string here
      const response = await holderApi.joinAsHolder(vote_id, { public_key: public_key }); // Pass as object
    } catch (err) {
      console.error('Failed to join as secret holder:', err);
      // Log the detailed validation error from the backend response, stringified
      console.error('Join Holder Validation Error:', JSON.stringify(err.response?.data, null, 2)); 
      // If joining fails, should we revert the registration?
      // Maybe set the isHolder cookie back to false?
      // Cookies.set(`vote_${vote_id}_isHolder`, 'false', { expires: 365, secure: true, sameSite: "Strict" });
      alert(err.response?.data?.detail || err.message || 'Failed to join as secret holder. Please try again.');
      throw err; // Re-throw to prevent the success message in storePublicKey
    }
}
  </script>
  
  <style lang="scss" scoped>
  .alert-box {
    margin-top: 10px;
    padding: 10px;
    background-color: #f0f8ff;
    border: 1px solid #007bff;
    border-radius: 5px;
    color: #333;
    font-weight: bold;
    text-align: center;
  }
  </style>