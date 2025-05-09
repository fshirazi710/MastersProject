<template>
  <div class="login-page">
    <div class="login-container">
      <h1>Login</h1>
      
      <!-- Error message -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      
      <form @submit.prevent="handleSubmit" class="login-form">
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
            placeholder="Enter your password"
          >
        </div>
        
        <button 
          type="submit" 
          class="btn primary" 
          :disabled="loading"
        >
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
      </form>
      
      <div class="register-link">
        Don't have an account? <router-link to="/register">Register</router-link>
      </div>
    </div>
  </div>
</template>
  
<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authApi } from '@/services/api'
import { store } from '@/composables/authentication.js'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const error = ref('')

// Form data
const formData = ref({
  email: '',
  password: ''
})

// Handle form submission
const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await authApi.login(formData.value)
    
    // Use the new setLoggedIn method
    store.setLoggedIn(response.data.data.token)
    
    // Redirect to the original destination or home page
    const redirectPath = route.query.redirect || '/'
    router.push(redirectPath)
  } catch (err) {
    console.error('Login failed:', err)
    error.value = err.response?.data?.detail || 'Login failed. Please check your credentials.'
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/pages/login';
</style> 