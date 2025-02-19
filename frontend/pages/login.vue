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

const router = useRouter()
const loginData = ref({
    email: '',
    password: ''
})
const handleSubmit = async () => {
    try {
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(loginData.value.password, salt)

        const loginPayload = {
            ...loginData.value,
            password: hashedPassword,
        }

        axios.post("http://127.0.0.1:8000/login", loginPayload)
        .then(response => {
            alert(response.data.message)
            router.push('/login')
        })
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to log user in')
    }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/pages/login';
</style> 