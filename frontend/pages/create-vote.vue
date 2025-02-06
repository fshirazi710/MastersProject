<template>
  <div class="create-vote">
    <h1>Create New Vote</h1>
    <form @submit.prevent="handleSubmit" class="form-container">
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

<style lang="scss" scoped>
.create-vote {
  max-width: $desktop;
  margin: 0 auto;
  padding: $spacing-lg;
}
</style> 