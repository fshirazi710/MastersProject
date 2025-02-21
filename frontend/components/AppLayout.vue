<template>
  <div class="app-container">
    <header class="header">
      <nav class="nav">
        <div class="logo">
          <NuxtLink to="/" class="logo-link">
            <h1>TRC System</h1>
          </NuxtLink>
        </div>
        <div class="nav-links">
          <NuxtLink to="/" class="nav-link">Home</NuxtLink>
          <NuxtLink v-if="!store.loggedIn" to="/login" class="nav-link">Login</NuxtLink>
          <NuxtLink v-if="store.loggedIn" to="/create-vote" class="nav-link">Create Vote</NuxtLink>
          <NuxtLink v-if="store.loggedIn" to="/active-votes" class="nav-link">Active Votes</NuxtLink>
          <NuxtLink v-if="store.loggedIn" to="/become-holder" class="nav-link">Become a Holder</NuxtLink>
          <NuxtLink v-if="store.loggedIn" @click="handleLogout" class="nav-link">Logout</NuxtLink>
        </div>
      </nav>
    </header>
    <main class="main">
      <slot />
    </main>
    <footer class="footer">
      <p>&copy; 2024 Timed Release Crypto System</p>
    </footer>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {store} from '../authentication.js'

const router = useRouter();

// Handle logout
const handleLogout = () => {
  store.logout();  // Call the logout method in the store
  router.push('/login');  // Redirect to login page
};

// Check login status on mount
onMounted(() => {
  store.checkLoginStatus();  // Call the method to check login status
});
</script>


<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background-color: #1a1a1a;
  padding: 1rem 2rem;
}

.nav {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo h1 {
  color: #00dc82;
  margin: 0;
  font-size: 1.5rem;
}

.logo-link {
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 1.5rem;
}

.nav-link {
  color: #ffffff;
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.nav-link:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #00dc82;
}

.main {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.footer {
  background-color: #1a1a1a;
  color: #ffffff;
  text-align: center;
  padding: 1rem;
  margin-top: auto;
}

@media (max-width: 768px) {
  .nav {
    flex-direction: column;
    gap: 1rem;
  }
  
  .nav-links {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style> 