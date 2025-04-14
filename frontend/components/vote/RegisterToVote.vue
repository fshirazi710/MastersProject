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

        <button 
          class="btn primary" 
          :disabled="loading"
        >
          {{ loading ? 'Registering...' : 'Register To Vote' }}
        </button>
        <!-- <button class="btn primary">
          Register To Vote
        </button> -->
      </form>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  import { voteApi, holderApi } from '@/services/api'
  import { generateBLSKeyPair } from "../../services/cryptography";
  import Cookies from "js-cookie";
  
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

  const loading = ref(false);
  const isSecretHolder = ref('yes')
  const emit = defineEmits(['registration-successful']);

  const pubKey = ref(null);

  const generateKeyPair = async () => {
    if (loading.value) return;
    loading.value = true;
    const privateKeyCookie = `vote_${props.voteId}_privateKey`;
    const publicKeyCookie = `vote_${props.voteId}_publicKey`;
    const isHolderCookie = `vote_${props.voteId}_isHolder`;

    // Check if private key already exists for this vote
    if (Cookies.get(privateKeyCookie)) {
      // Check if public key already exists for this vote
      const existingPk = Cookies.get(publicKeyCookie);
      if (existingPk) {
          // Tell the user they've already registered.
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
    // console.log('Generated Private Key :', sk);
    // console.log('Generated Public Key:', publicKey);
    
    const privateKeyHex = sk.toString(16);
    const publicKeyHex = publicKey.toHex();
    // console.log('Private Key Hex:', privateKeyHex);
    // console.log("Public Key Hex:", publicKeyHex);
    

    // Store the private key in a cookie for this specific vote
    Cookies.set(privateKeyCookie, privateKeyHex, { expires: 365, secure: true, sameSite: "Strict" });
    // Store the public key in a cookie for this specific vote
    Cookies.set(publicKeyCookie, publicKeyHex, { expires: 365, secure: true, sameSite: "Strict" });
    // Store holder status (initially false, updated in storePublicKey)
    Cookies.set(isHolderCookie, 'false', { expires: 365, secure: true, sameSite: "Strict" });

    // Update the reactive pk variable
    pubKey.value = publicKeyHex;
    // console.log('pubKey.value before storePublicKey:', pubKey.value);

    // Proceed to store public key on backend
    storePublicKey();
  };

  // Method to store public key and potentially join as holder
  const storePublicKey = async () => {
    console.log("Entered the storePublicKey function in RegisterToVote.vue");
    console.log("what props contains:");
    console.log(props);
    
    if (!pubKey.value) {
      alert("Key pair not generated yet.");
      console.log("Key pair not generated yet.");
      return;
    }

    const isHolder = isSecretHolder.value === 'yes';
    const isHolderCookie = `vote_${props.voteId}_isHolder`;
    const publicKeyCookie = `vote_${props.voteId}_publicKey`;
    console.log("IsHolder: ", isHolder);
    console.log("isHolderCookie: ", isHolderCookie);
    console.log("publicKeyCookie: ", publicKeyCookie);


    console.log("props.voteID: ", props.voteId);
    console.log("public_key: ", pubKey.value);
    console.log("is_secret_holder: ", isHolder);

    // Update the holder status cookie
    Cookies.set(isHolderCookie, isHolder.toString(), { expires: 365, secure: true, sameSite: "Strict" });

    try {
      // Store public key (and holder status) on backend
      const response = await voteApi.storePublicKey(props.voteId, {
        public_key: pubKey.value, // Send hex string
        is_secret_holder: isHolder
      });

      console.log("Response after calling voteApi.storePublicKey:");
      console.log(response);

      // Join as holder on blockchain if chosen
      if (isHolder) {
        // console.log("Now calling joinAsSecretHolder");
        await joinAsSecretHolder(props.voteId, pubKey.value);
        // alert("Successfully registered as secret holder.");
      } else {
        // console.log("Not calling joinAsSecretHolder - did not select yes");
        // alert("Successfully registered as voter.");
      }
      
      // Emit event upon successful registration
      emit('registration-successful');
      loading.value = false;
    } catch (err) {
      console.error('Failed during registration:', err);
      // Reset cookies if registration failed?
      // Cookies.remove(publicKeyCookie);
      // Cookies.remove(isHolderCookie);
      // Cookies.remove(`vote_${props.voteId}_privateKey`); // Also remove private key
      alert(err.response?.data?.detail || err.message || 'Failed during registration. Please try again.');
    }
  }

  const joinAsSecretHolder = async (vote_id, public_key) => {
    try {
      // console.log("Now inside of joinAsSecretHolder");
      // Public key is already a hex string here
      const response = await holderApi.joinAsHolder(vote_id, { public_key: public_key }); // Pass as object
      alert("You have chosen to be a secret holder. You must return between 5:00 PM and 5:15 PM to submit your secret share. Failure to do so will result in no raffle tickets being awarded.")
      alert("You must use this same device and browser for all remaining steps.")
      // console.log("Response after calling joinAsHolder")
      // console.log(response)
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