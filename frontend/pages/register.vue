<template>
    <div class="register">
        <h1>Register</h1>
        
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
  
          <!-- Role Selection -->
          <div class="form-group">
            <label>Select Role</label>
            <div class="role-options">
              <div 
                class="role-card"
                :class="{ active: registerationData.role === 'secret-holder' }"
                @click="registerationData.role = 'secret-holder'"
              >
                <div class="role-icon">🔐</div>
                <h3>Secret Holder</h3>
                <p>Participate in securing vote results and earn rewards</p>
              </div>
              <div 
                class="role-card"
                :class="{ active: registerationData.role === 'vote-organiser' }"
                @click="registerationData.role = 'vote-organiser'"
              >
                <div class="role-icon">📊</div>
                <h3>Vote Organiser</h3>
                <p>Create and manage secure voting events</p>
              </div>
            </div>
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
            <button type="submit" class="btn primary">Register</button>
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
import bcrypt from 'bcryptjs'

const router = useRouter()
const errorMessage = ref('')

const registerationData = ref({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: ''
})

const validateForm = () => {
    if (!registerationData.value.role) {
        errorMessage.value = 'Please select a role'
        return false
    }
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
    if (!validateForm()) {
        return
    }

    try {
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(registerationData.value.password, salt)

        const registrationPayload = {
            ...registerationData.value,
            password: hashedPassword,
            confirmPassword: undefined // Remove confirmPassword from payload
        }

        axios.post("http://127.0.0.1:8000/register", registrationPayload)
        .then(response => {
            alert(response.data.message)
            router.push('/login')
        })
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to register user')
    }
}
</script>
  
<style lang="scss" scoped>
@use '@/assets/styles/pages/register';
</style> 