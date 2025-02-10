<template>
  <div class="create-vote">
    <h1>Create New Vote</h1>
    <!-- Main form container with submit handler -->
    <form @submit.prevent="handleSubmit" class="form-container">
      <!-- Vote title input -->
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

      <!-- Vote description textarea -->
      <div class="form-group">
        <label for="description">Description</label>
        <textarea 
          id="description" 
          v-model="voteData.description" 
          required 
          class="form-input"
        ></textarea>
      </div>

      <!-- Date selection row with two inputs -->
      <div class="form-row">
        <!-- Start date input -->
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

        <!-- End date input -->
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

      <!-- Dynamic voting options section -->
      <div class="form-group">
        <label>Options</label>
        <!-- List of voting options with remove buttons -->
        <div v-for="(option, index) in voteData.options" :key="index" class="option-row">
          <input 
            type="text" 
            v-model="voteData.options[index]" 
            :placeholder="'Option ' + (index + 1)"
            class="form-input"
          >
          <!-- Remove button (hidden for first two options) -->
          <button 
            type="button" 
            @click="removeOption(index)" 
            class="btn danger"
            v-if="voteData.options.length > 2"
          >
            Remove
          </button>
        </div>
        <!-- Add new option button -->
        <button 
          type="button" 
          @click="addOption" 
          class="btn secondary"
        >
          Add Option
        </button>
      </div>

      <!-- Form submit button -->
      <button type="submit" class="btn primary">Create Vote</button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter();

// Initialize form data with reactive reference
const voteData = ref({
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  options: ['', ''] // Start with 2 empty options (minimum required)
})

// Add a new empty option to the options array
const addOption = () => {
  voteData.value.options.push('')
}

// Remove an option at the specified index
const removeOption = (index) => {
  voteData.value.options.splice(index, 1)
}

const handleSubmit = () => {
  axios.post("http://127.0.0.1:8000/create-vote", voteData.value)
    .then(response => {
      alert(response.data.message)
      router.push('/active-votes')
    })
    console.log('Form submitted:', voteData.value)
}
</script>

<style lang="scss" scoped>
// Page container styles
// Uses variables from _variables.scss
.create-vote {
  max-width: $desktop;
  margin: 0 auto;
  padding: $spacing-lg;
}
</style> 