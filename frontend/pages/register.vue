<template>
  <div class="register-page">
    <div class="register-container">
      <h1>Create an Account</h1>
      
      <!-- Error message -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      
      <form @submit.prevent="handleSubmit" class="register-form">
        <div class="form-group">
          <label for="name">Full Name</label>
          <input 
            type="text" 
            id="name" 
            v-model="formData.name" 
            required 
            class="form-input"
            placeholder="Enter your full name"
          >
        </div>
        
        <div class="form-group">
          <label for="email">Email</label>
          <input 
            type="email" 
            id="email" 
            v-model="formData.email" 
            required 
            class="form-input"
            placeholder="Enter your email"
          >
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input 
            type="password" 
            id="password" 
            v-model="formData.password" 
            required 
            class="form-input"
            placeholder="Create a password"
            minlength="8"
          >
          <small class="form-hint">Password must be at least 8 characters long</small>
        </div>
        
        <div class="form-group">
          <label for="role">Role</label>
          <select 
            id="role" 
            v-model="formData.role" 
            required 
            class="form-select"
          >
            <option v-for="role in roles" :key="role.value" :value="role.value">
              {{ role.label }}
            </option>
          </select>
        </div>
        
        <button 
          type="submit" 
          class="btn primary" 
          :disabled="loading"
        >
          {{ loading ? 'Registering...' : 'Register' }}
        </button>
      </form>
      
      <div class="login-link">
        Already have an account? <router-link to="/login">Login</router-link>
      </div>
    </div>
  </div>
</template>
  
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/services/api'

const router = useRouter()
const loading = ref(false)
const error = ref('')

// Form data
const formData = ref({
  name: '',
  email: '',
  password: '',
  role: 'voter' // Default role
})

// Available roles
const roles = [
  { value: 'voter', label: 'Voter' },
  { value: 'holder', label: 'Secret Holder' }
]

// Handle form submission
const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await authApi.register(formData.value)
    
    alert('Registration successful! Please log in.')
    router.push('/login')
  } catch (err) {
    console.error('Registration failed:', err)
    error.value = err.response?.data?.detail || 'Registration failed. Please try again.'
  } finally {
    loading.value = false
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