<template>
  <div class="become-holder">
    <h1>Become a Secret Holder</h1>
    
    <div class="info-panel">
      <h2>What is a Secret Holder?</h2>
      <p>Secret holders are trusted participants who help secure the voting system. They hold cryptographic shares of the decryption key and can only decrypt votes when the voting period ends.</p>
      <p>To become a secret holder, you need to:</p>
      <ul>
        <li>Deposit ETH as a security bond</li>
        <li>Generate a cryptographic key pair</li>
        <li>Commit to releasing your key share when votes need to be decrypted</li>
      </ul>
    </div>
    
    <!-- Status message -->
    <div v-if="statusMessage" :class="['status-message', statusType]">
      {{ statusMessage }}
    </div>
    
    <!-- Loading indicator -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
    
    <!-- Registration form -->
    <div v-else class="registration-form">
      <h2>Register as a Secret Holder</h2>
      
      <div class="form-group">
        <label>Required Deposit:</label>
        <div class="deposit-amount">{{ requiredDeposit }} ETH</div>
      </div>
      
      <div class="form-group">
        <label>Your Public Key:</label>
        <div class="public-key">{{ publicKey.join(', ') }}</div>
        <button @click="generatePublicKey" class="btn secondary">Generate New Key</button>
      </div>
      
      <button 
        @click="joinAsHolder" 
        class="btn primary" 
        :disabled="isSubmitting"
      >
        <span v-if="isSubmitting">Processing...</span>
        <span v-else>Become a Secret Holder</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { holderApi } from '@/services/api'

const loading = ref(false)
const isSubmitting = ref(null)
const statusMessage = ref('')
const statusType = ref('')
const requiredDeposit = ref(0)
const publicKey = ref([0, 0])

// Generate a random public key (in a real app, this would be a proper cryptographic key)
const generatePublicKey = () => {
  publicKey.value = [
    Math.floor(Math.random() * 1000000000),
    Math.floor(Math.random() * 1000000000)
  ]
}

// Fetch the required deposit amount
const fetchRequiredDeposit = async () => {
  loading.value = true
  statusMessage.value = ''
  
  try {
    const response = await holderApi.getRequiredDeposit()
    requiredDeposit.value = response.data.data.required_deposit
    generatePublicKey()
  } catch (error) {
    statusMessage.value = 'Failed to fetch required deposit amount'
    statusType.value = 'error'
  } finally {
    loading.value = false
  }
}

// Join as a secret holder
const joinAsHolder = async () => {
  if (isSubmitting.value) return
  
  isSubmitting.value = true
  statusMessage.value = ''
  statusType.value = ''
  
  try {
    const response = await holderApi.joinAsHolder(publicKey.value, requiredDeposit.value)
    
    statusMessage.value = 'Successfully registered as a secret holder!'
    statusType.value = 'success'
  } catch (error) {
    statusMessage.value = error.response?.data?.detail || 'Failed to process registration'
    statusType.value = 'error'
  } finally {
    isSubmitting.value = false
  }
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

onMounted(() => {
  fetchRequiredDeposit()
})
</script>

<style lang="scss" scoped>
@use '@/assets/styles/pages/become-holder';
</style> 