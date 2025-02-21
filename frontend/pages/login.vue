<template>
    <div class="login">
        <h1>Login</h1>
        
        <form @submit.prevent="handleSubmit" class="form-container">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              v-model="loginData.email"
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
              v-model="loginData.password"
              required
              class="form-input"
              placeholder="Enter your password"
            >
          </div>
  
          <div class="form-actions">
            <button type="submit" class="btn primary">Login</button>
          </div>
  
          <div class="form-footer">
            <p>Don't have an account? <NuxtLink to="/register">Register</NuxtLink></p>
          </div>
        </form>
    </div>
</template>
  
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import {store} from '../authentication.js'


const router = useRouter()
const loginData = ref({
    email: '',
    password: ''
})

const handleSubmit = async () => {
  try {
    const loginPayload = { ...loginData.value };

    const response = await axios.post("http://127.0.0.1:8000/login", loginPayload, {
      withCredentials: true, // Ensure cookies are sent
    });

    // Store the JWT in local storage
    localStorage.setItem('token', response.data.token); // Assuming the token is returned in the response

    store.checkLoginStatus();  // Call the method to check login status

    alert(response.data.message);
    router.push('/active-votes'); // Redirect to a protected route
  } catch (error) {
    alert(error.response?.data?.detail || 'Failed to log user in');
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/pages/login';
</style> 