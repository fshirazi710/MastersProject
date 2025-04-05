<template>
  <div class="custom-slider-wrapper">
    <input 
      type="range"
      :min="0"
      :max="steps.length - 1"
      :value="currentIndex"
      @input="handleInput"
      class="custom-slider-input"
    />
    <span class="custom-slider-value">{{ modelValue ?? '-' }}</span> 
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  modelValue: { // for v-model
    type: Number,
    default: null,
  },
  steps: { // Array of allowed numeric values (e.g., [1, 5, 10, 15, ...])
    type: Array,
    required: true,
    validator: (arr) => arr.every(item => typeof item === 'number'),
  },
});

const emit = defineEmits(['update:modelValue']);

// Internal state: the index of the currently selected step in the props.steps array
const currentIndex = ref(0);

// Find the initial index based on the initial modelValue
const findIndex = (value) => {
  if (value === null || props.steps.length === 0) return 0;
  const index = props.steps.indexOf(value);
  return index >= 0 ? index : 0; // Default to 0 if not found
};

// Initialize currentIndex when the component mounts or steps/modelValue changes initially
currentIndex.value = findIndex(props.modelValue);

// Watch for external changes to modelValue and update the internal index
watch(() => props.modelValue, (newValue) => {
  const newIndex = findIndex(newValue);
  if (newIndex !== currentIndex.value) {
    currentIndex.value = newIndex;
  }
});

// Watch for changes in the steps array (e.g., options loading dynamically)
watch(() => props.steps, (newSteps, oldSteps) => {
  // Re-evaluate the index if steps change, trying to keep the same value if possible
  if (JSON.stringify(newSteps) !== JSON.stringify(oldSteps)) {
     currentIndex.value = findIndex(props.modelValue);
     // If the previous value is no longer valid, emit an update with the new default
     if (props.modelValue !== null && !newSteps.includes(props.modelValue)) {
         emit('update:modelValue', newSteps[currentIndex.value]);
     }
  }
}, { deep: true });


// Handle input event from the range slider
const handleInput = (event) => {
  const newIndex = parseInt(event.target.value, 10);
  currentIndex.value = newIndex; // Update internal index state
  
  // Get the actual step value corresponding to the new index
  const actualValue = props.steps[newIndex];
  
  // Emit the update event with the actual step value for v-model
  emit('update:modelValue', actualValue);
};

</script>

<style scoped>
.custom-slider-wrapper {
  display: flex;
  align-items: center;
  gap: 15px; /* Spacing between slider and value display */
  margin: 20px 0; /* Add some vertical margin */
}

.custom-slider-input {
  flex-grow: 1; /* Allow slider to take up available space */
  cursor: pointer;
  /* Basic styling - can be customized further */
  appearance: none; 
  width: 100%;
  height: 8px;
  background: #ddd;
  border-radius: 5px;
  outline: none;
}

/* Styling for Chrome/Edge/Safari */
.custom-slider-input::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  background: #2196F3; /* Blue handle */
  border-radius: 50%;
  cursor: pointer;
}

/* Styling for Firefox */
.custom-slider-input::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #2196F3; /* Blue handle */
  border-radius: 50%;
  cursor: pointer;
  border: none; /* Remove default border */
}

.custom-slider-value {
  font-weight: bold;
  min-width: 30px; /* Ensure space for the value */
  text-align: right;
}
</style> 