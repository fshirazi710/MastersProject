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
          <small class="form-hint">Password must be at least 8 characters long, contain uppercase, lowercase, and a number</small>
        </div>
        
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input 
            type="password" 
            id="confirmPassword" 
            v-model="confirmPassword" 
            required 
            class="form-input"
            placeholder="Confirm your password"
            minlength="8"
          >
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
const confirmPassword = ref('')

// Form data
const formData = ref({
  name: '',
  email: '',
  password: '',
  role: 'vote-organiser' // Fixed role for vote organizers
})

// Validate password requirements
const validatePassword = (password) => {
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  
  if (!hasUpperCase) {
    return "Password must contain at least one uppercase letter";
  }
  if (!hasLowerCase) {
    return "Password must contain at least one lowercase letter";
  }
  if (!hasDigit) {
    return "Password must contain at least one digit";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  
  return null;
}

// Handle form submission
const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  
  // Check if passwords match
  if (formData.value.password !== confirmPassword.value) {
    error.value = 'Passwords do not match';
    loading.value = false;
    return;
  }
  
  // Validate password requirements
  const passwordError = validatePassword(formData.value.password);
  if (passwordError) {
    error.value = passwordError;
    loading.value = false;
    return;
  }
  
  try {
    const response = await authApi.register(formData.value)
    
    alert('Registration successful! Please log in.')
    router.push('/login')
  } catch (err) {
    console.error('Registration failed:', err)
    // Format error message in a user-friendly way
    if (err.response?.data?.detail) {
      if (Array.isArray(err.response.data.detail)) {
        // Handle validation errors
        error.value = err.response.data.detail.map(err => err.msg).join('\n');
      } else {
        error.value = err.response.data.detail;
      }
    } else {
      error.value = 'Registration failed. Please try again.';
    }
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
    white-space: pre-line; /* Allow line breaks in error messages */
}

.form-hint {
    color: #6c757d;
    font-size: 0.85rem;
    margin-top: 0.25rem;
}

.form-actions {
    button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
}
</style> 