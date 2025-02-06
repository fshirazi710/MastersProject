<template>
  <div class="home">
    <section class="hero">
      <h1>Timed Release Crypto System</h1>
      <p class="subtitle">Secure time-locked message delivery on the blockchain</p>
      <div class="cta-buttons">
        <button class="btn primary">Get Started</button>
        <button class="btn secondary">Learn More</button>
      </div>
    </section>

    <section class="features">
      <h2>Key Features</h2>
      <div class="feature-grid">
        <div class="feature-card">
          <h3>Secure Messaging</h3>
          <p>End-to-end encrypted communication with time-lock capabilities</p>
        </div>
        <div class="feature-card">
          <h3>Time Lock</h3>
          <p>Set specific release times for your encrypted messages</p>
        </div>
        <div class="feature-card">
          <h3>Blockchain Powered</h3>
          <p>Leveraging blockchain technology for secure and transparent operations</p>
        </div>
        <div class="feature-card">
          <h3>User Control</h3>
          <p>Full control over your messages and release conditions</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  text-align: center;
}

.hero {
  padding: 4rem 2rem;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.subtitle {
  font-size: 1.2rem;
  color: #cccccc;
  margin-bottom: 2rem;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn {
  padding: 0.8rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: transform 0.2s;
}

.btn:hover {
  transform: translateY(-2px);
}

.primary {
  background-color: #00dc82;
  color: #1a1a1a;
}

.secondary {
  background-color: transparent;
  border: 2px solid #00dc82;
  color: #00dc82;
}

.features {
  padding: 2rem;
}

.features h2 {
  margin-bottom: 2rem;
  font-size: 2rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.feature-card {
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-card h3 {
  color: #00dc82;
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .hero h1 {
    font-size: 2rem;
  }
  
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style> 