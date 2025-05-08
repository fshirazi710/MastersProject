<template>
  <div class="home">
    <!-- Hero section - Main landing area -->
    <section class="hero">
      <h1>Timed Release Crypto System</h1>
      <p class="subtitle">Secure time-locked message delivery on the blockchain</p>
      <!-- Call to action buttons with navigation -->
      <div class="cta-buttons">
        <NuxtLink v-if="!store.loggedIn" to="/login" class="btn primary">Login</NuxtLink>
        <NuxtLink v-else to="/create-vote-session" class="btn primary">Create Vote Session</NuxtLink>
        <NuxtLink to="/faq" class="btn secondary">Learn More</NuxtLink>
      </div>
    </section>

    <!-- Features section - Highlight key functionality -->
    <section class="features">
      <h2>Key Features</h2>
      <!-- Feature cards grid -->
      <div class="feature-grid">
        <!-- Secure Voting feature -->
        <div class="feature-card" @click="navigateTo('/faq#security')">
          <h3>Secure Voting</h3>
          <p>End-to-end encrypted voting with time-lock capabilities</p>
        </div>
        
        <!-- Time Lock feature -->
        <div class="feature-card" @click="navigateTo('/faq#time-lock')">
          <h3>Time Lock</h3>
          <p>Set specific release times for vote results</p>
        </div>
        
        <!-- Blockchain feature -->
        <div class="feature-card" @click="navigateTo('/faq#blockchain')">
          <h3>Blockchain Powered</h3>
          <p>Leveraging blockchain technology for transparent voting</p>
        </div>
        
        <!-- User Control feature -->
        <div class="feature-card" @click="navigateTo('/faq#user-control')">
          <h3>User Control</h3>
          <p>Full control over your voting participation</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { store } from '../composables/authentication.js'; // Import the store
import { useRouter } from '#app/composables/router';

// Import navigateTo from Nuxt
const { navigateTo } = useRouter()

// Track feature card clicks for analytics
const trackFeatureClick = (feature) => {
  // TODO: Implement analytics tracking
  console.log(`Feature clicked: ${feature}`)
}

// Handle learn more click with section highlight
const handleLearnMore = (section) => {
  navigateTo({
    path: '/faq',
    hash: section
  })
}
</script>

<style lang="scss" scoped>
// Component-specific style overrides only
// Main styles are in _home.scss
.feature-card {
  cursor: pointer;
}
</style> 