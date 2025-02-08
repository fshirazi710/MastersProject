<template>
  <div class="faq-page">
    <h1>Frequently Asked Questions</h1>
    
    <!-- Security Section -->
    <section id="security" class="faq-section">
      <h2>Security</h2>
      <div class="faq-grid">
        <div class="faq-item">
          <h3>How is my vote kept secure?</h3>
          <p>Your vote is encrypted end-to-end using advanced cryptographic protocols. Only authorized parties can access the results after the voting period ends.</p>
        </div>
        <div class="faq-item">
          <h3>Who can see my vote?</h3>
          <p>Your vote remains encrypted and anonymous. Even system administrators cannot link votes to specific voters.</p>
        </div>
      </div>
    </section>

    <!-- Time Lock Section -->
    <section id="time-lock" class="faq-section">
      <h2>Time Lock System</h2>
      <div class="faq-grid">
        <div class="faq-item">
          <h3>How does time-locking work?</h3>
          <p>Votes are encrypted and locked until a predetermined time. The results can only be revealed when enough secret holders provide their keys.</p>
        </div>
        <div class="faq-item">
          <h3>What are secret holders?</h3>
          <p>Secret holders are trusted parties who each hold a portion of the key needed to decrypt the vote results.</p>
        </div>
      </div>
    </section>

    <!-- Additional sections... -->
  </div>
</template>

<script setup>
// Handle smooth scrolling to sections
onMounted(() => {
  if (window.location.hash) {
    const element = document.querySelector(window.location.hash)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }
})
</script> 