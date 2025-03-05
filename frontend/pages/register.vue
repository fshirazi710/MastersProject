<template>
    <div class="register">
        <h1>Register as Vote Organiser</h1>
        
        <form @submit.prevent="handleSubmit" class="form-container">
          <!-- Name input -->
          <div class="form-group">
            <label for="name">Full Name</label>
            <input
              type="text"
              id="name"
              v-model="registerationData.name"
              required
              class="form-input"
              placeholder="Enter your full name"
            >
          </div>
  
          <!-- Email input -->
          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              v-model="registerationData.email"
              required
              class="form-input"
              placeholder="Enter your email"
            >
          </div>
  
          <!-- Password input -->
          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              v-model="registerationData.password"
              required
              class="form-input"
              placeholder="Enter your password"
              minlength="8"
            >
            <p class="helper-text">Password must be at least 8 characters long</p>
          </div>
  
          <!-- Confirm Password input -->
          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              v-model="registerationData.confirmPassword"
              required
              class="form-input"
              placeholder="Confirm your password"
            >
          </div>
  
          <!-- Error message display -->
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
  
          <!-- Submit button -->
          <div class="form-actions">
            <button type="submit" class="btn primary" :disabled="isSubmitting">
              {{ isSubmitting ? 'Registering...' : 'Register' }}
            </button>
          </div>
  
          <!-- Login link -->
          <div class="form-footer">
            <p>Already have an account? <NuxtLink to="/login">Login</NuxtLink></p>
          </div>
        </form>
    </div>
</template>
  
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { config } from '../config'

const router = useRouter()
const errorMessage = ref('')
const isSubmitting = ref(false)

const registerationData = ref({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'vote-organiser' // Set default role
})

const validateForm = () => {
    errorMessage.value = ''
    if (registerationData.value.password !== registerationData.value.confirmPassword) {
        errorMessage.value = 'Passwords do not match'
        return false
    }
    if (registerationData.value.password.length < 8) {
        errorMessage.value = 'Password must be at least 8 characters long'
        return false
    }
    return true
}

const handleSubmit = async () => {
    if (!validateForm() || isSubmitting.value) {
        return
    }

    isSubmitting.value = true
    errorMessage.value = ''

    try {
        // Don't hash password here - it will be hashed securely in the backend
        const { confirmPassword, ...payload } = registerationData.value
        
        const response = await axios.post(`${config.api.baseURL}/register`, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
        
        if (response.data.message) {
            alert(response.data.message)
            router.push('/login')
        }
    } catch (error) {
        console.error('Registration error:', error)
        errorMessage.value = error.response?.data?.detail || 'Failed to register user. Please try again.'
    } finally {
        isSubmitting.value = false
    }
}
</script>
  
<style lang="scss" scoped>
@use '@/assets/styles/pages/register';

.error-message {
    color: #dc3545;
    margin: 10px 0;
    padding: 10px;
    border-radius: 4px;
    background-color: rgba(220, 53, 69, 0.1);
}

.form-actions {
    button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
}
</style> 