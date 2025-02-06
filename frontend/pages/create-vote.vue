<template>
  <div class="create-vote">
    <h1>Create New Vote</h1>
    <form @submit.prevent="handleSubmit" class="vote-form">
      <div class="form-group">
        <label for="title">Vote Title</label>
        <input 
          type="text" 
          id="title" 
          v-model="voteData.title" 
          required 
          class="form-input"
        >
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea 
          id="description" 
          v-model="voteData.description" 
          required 
          class="form-input"
        ></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="startDate">Start Date</label>
          <input 
            type="datetime-local" 
            id="startDate" 
            v-model="voteData.startDate" 
            required 
            class="form-input"
          >
        </div>

        <div class="form-group">
          <label for="endDate">End Date</label>
          <input 
            type="datetime-local" 
            id="endDate" 
            v-model="voteData.endDate" 
            required 
            class="form-input"
          >
        </div>
      </div>

      <div class="form-group">
        <label>Options</label>
        <div v-for="(option, index) in voteData.options" :key="index" class="option-row">
          <input 
            type="text" 
            v-model="voteData.options[index]" 
            :placeholder="'Option ' + (index + 1)"
            class="form-input"
          >
          <button 
            type="button" 
            @click="removeOption(index)" 
            class="btn danger"
            v-if="voteData.options.length > 2"
          >
            Remove
          </button>
        </div>
        <button 
          type="button" 
          @click="addOption" 
          class="btn secondary"
        >
          Add Option
        </button>
      </div>

      <button type="submit" class="btn primary">Create Vote</button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const voteData = ref({
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  options: ['', ''] // Start with 2 empty options
})

const addOption = () => {
  voteData.value.options.push('')
}

const removeOption = (index) => {
  voteData.value.options.splice(index, 1)
}

const handleSubmit = () => {
  // TODO: Implement form submission
  console.log('Form submitted:', voteData.value)
}
</script>

<style scoped>
.create-vote {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.vote-form {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

textarea.form-input {
  min-height: 100px;
  resize: vertical;
}

.option-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: transform 0.2s, opacity 0.2s;
}

.btn:hover {
  transform: translateY(-1px);
  opacity: 0.9;
}

.primary {
  background-color: #00dc82;
  color: #1a1a1a;
  width: 100%;
  margin-top: 1rem;
}

.secondary {
  background-color: #f5f5f5;
  color: #1a1a1a;
  border: 1px solid #ddd;
}

.danger {
  background-color: #ff4444;
  color: white;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style> 