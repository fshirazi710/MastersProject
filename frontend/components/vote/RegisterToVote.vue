<template>
    <div class="voting-section">
      <h2>Register To Vote</h2>
      <!-- Encryption notice to inform users -->
      <div class="encryption-notice">
        <i class="lock-icon">🔒</i>
        <p>The key pair generated here is essential for casting your vote. Your key is stored in your browser, return here to cast your vote.</p>
      </div>
      <div class="encryption-notice">
        <i class="lock-icon">🔒</i>
        <p>You can choose to be a secret holder, which means you are a part of making sure your vote remains secure.
          If you choose to become a secret holder, you will need to release your private key at the specified time.
        </p>
      </div>

      <!-- Check if already a secret holder -->
      <div v-if="alreadySecretHolder" class="alert-box">
        You are already a secret holder for this vote.
      </div>

      <form v-if="alreadySecretHolder" @submit.prevent="unRegisterHolder" class="voting-form">
        <h3>Do you no longer want to be a secret holder for this election?</h3>
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
        <button class="btn primary">
          Unregister as a secret holder
        </button>
      </form>
    
      <!-- Voting form with radio options -->
      <form v-else @submit.prevent="generateKeyPair" class="voting-form">
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
        <button class="btn primary">
          Generate Key Pair
        </button>
      </form>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue'
  import { voteApi, holderApi } from '@/services/api'
  import { generateBLSKeyPair, getG1PointsFromPublicKey } from "../../services/cryptography";
  import Cookies from "js-cookie";
  
  const props = defineProps({
    voteId: {
      type: String,
      required: true
    }
  })
  
  const isSecretHolder = ref('yes')
  const pk = ref(null);
  const alreadySecretHolder = ref(false);

  // used to check if the user has already generated a keypair for this page
  const checkExistingPrivateKey = () => {
    const cookieLabel = `privateKey_${props.voteId}`;
    const existingKey = Cookies.get(cookieLabel);
    alreadySecretHolder.value = !!existingKey;  // Set to true if key exists
  };

  onMounted(checkExistingPrivateKey);

  const generateKeyPair = async () => {
    const { sk, pk: publicKey } = generateBLSKeyPair();

    //use vote id to make cookie unique to each election
    const cookieLabel = `privateKey_${props.voteId}`;

    // Store the private key in a cookie for 1 day
    Cookies.set(cookieLabel, sk.toString(16), { expires: 5, secure: true, sameSite: "Strict" });

    // Update the reactive pk variable to trigger UI update
    pk.value = publicKey.toHex(true);

    storePublicKey()
    window.location.reload() //reload the page once the key has been stored
  };

  // Method to generate voting token
  const storePublicKey = async () => {
    try {
      const response = await voteApi.storePublicKey(props.voteId, {
        public_key: pk.value,
        is_secret_holder: isSecretHolder.value === 'yes' ? true : false
      });

      if (isSecretHolder.value === 'yes') {
        const [pointX, pointY] = getG1PointsFromPublicKey(pk.value);
        joinAsSecretHolder(props.voteId, [pointX, pointY])
      }
      else {
        console.log("ERROR");
      }

      alert("TEMPORARY: Success");
    } catch (err) {
      console.error('Failed to store public key:', err);
      error.value = err.message || 'Failed to store public key. Please try again.';
    }
  }

  const joinAsSecretHolder = async (vote_id, public_key) => {
    try {
      console.log(public_key)
      console.log(public_key.map(share => share.toString()))
      const response = await holderApi.joinAsHolder(vote_id, public_key.map(share => share.toString()));
    } catch (err) {}
  }

  const unRegisterHolder = async () => {
    try {
      //unregister as a secret holder for this election
      const response = await holderApi.unJoinAsHolder(props.voteId);
      
      // Now remove the private key cookie
      const cookieLabel = `privateKey_${props.voteId}`;
      Cookies.remove(cookieLabel);

      // Update the UI to reflect the change (you can also reload the page if needed)
      alreadySecretHolder.value = false; // This will re-render the UI to show the non-secret-holder view
      pk.value = null;  // Clear the stored public key as well (if any)

      alert("You have successfully unregistered as a secret holder.");
      window.location.reload() //reload the page once sucessful
    } catch (err) {
      console.error('Failed to unregister as a secret holder:', err);
      alert("Failed to unregister. Please try again.");
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