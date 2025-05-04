<template>
  <div class="results-display">
    <div v-if="error" class="error-message">
        Error loading results: {{ error }}
    </div>
    
    <!-- Display based on hint -->
    <div v-else-if="displayHint === 'slider'">
        <h4>Average Result</h4>
        <div class="average-result">{{ sliderAverageFormatted }}</div>
        <div v-if="sliderConfig && sliderConfig.min !== undefined && sliderConfig.max !== undefined">
            <input 
              type="range" 
              :min="sliderConfig.min" 
              :max="sliderConfig.max" 
              :value="sliderAverage" 
              disabled 
              class="total-votes-slider" 
            />
             <div class="total-votes-slider">
                (Based on {{ totalVotes }} votes)
             </div>
        </div>
       
        <h4>Vote Distribution</h4>
         <Bar
            v-if="chartDataLoaded"
            id="distribution-chart"
            :options="distributionChartOptions"
            :data="distributionChartData"
          />
         <div v-else>Loading chart data...</div>
    </div>

    <div v-else>
        <!-- Default bar chart display -->
        <div v-for="(count, option) in tallyResults" :key="option" class="result-item">
            <div class="result-header">{{ option }}</div>
            <div class="progress-bar">
                <div class="progress" :style="{ width: calculatePercentage(count) + '%' }"></div>
            </div>
            <div class="percentage">{{ count }} votes ({{ calculatePercentage(count) }}%)</div>
        </div>
         <div class="total-votes-display">
            Total Votes: {{ totalVotes }}
         </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const props = defineProps({
  tallyResults: { // Object like { option: count, ... }
    type: Object,
    required: true,
    default: () => ({})
  },
  totalVotes: {
    type: Number,
    required: true,
    default: 0
  },
  error: {
    type: String,
    default: null
  },
  displayHint: { // 'slider' or null/other
    type: String,
    default: null
  },
  sliderConfig: { // { min: number, max: number, step: number }
    type: Object,
    default: null
  },
  options: { // Array of options, needed for slider label sorting if keys aren't numeric
    type: Array,
    required: true, // Make required if needed for sorting non-numeric keys
    default: () => []
  }
});

const sliderAverage = ref(0);

// Calculate percentage for default bar display
const calculatePercentage = (count) => {
  if (props.totalVotes === 0) return 0;
  return ((count / props.totalVotes) * 100).toFixed(1);
};

// Calculate average for slider display
const calculateSliderAverage = () => {
    if (Object.keys(props.tallyResults).length === 0 || props.totalVotes === 0) {
        sliderAverage.value = 0; 
        return;
    }

    let weightedSum = 0;
    for (const optionStr in props.tallyResults) {
        // Attempt to convert option key to number for calculation
        const optionNum = Number(optionStr);
        const count = props.tallyResults[optionStr];

        // Ensure both option key is numeric and count is a number
        if (!isNaN(optionNum) && typeof count === 'number') {
            weightedSum += optionNum * count;
        } else {
            console.warn(`Skipping non-numeric option key or count during average calculation: ${optionStr}`);
        }
    }
    sliderAverage.value = props.totalVotes > 0 ? weightedSum / props.totalVotes : 0;
};

// Format slider average for display
const sliderAverageFormatted = computed(() => sliderAverage.value.toFixed(2));

// Watch for changes in results to recalculate slider average
watch(() => props.tallyResults, (newResults) => {
    if (props.displayHint === 'slider') {
        calculateSliderAverage();
    }
}, { immediate: true, deep: true }); // immediate ensures calculation on mount


// --- Chart.js Configuration --- 
const chartDataLoaded = ref(false);

const distributionChartData = computed(() => {
    chartDataLoaded.value = false; // Reset loading state
    if (props.displayHint !== 'slider' || !props.tallyResults || Object.keys(props.tallyResults).length === 0) {
        return { labels: [], datasets: [] };
    }
    
    // Sort labels numerically if possible, otherwise use default order
    const labels = Object.keys(props.tallyResults).sort((a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB; // Numeric sort
        } 
        return String(a).localeCompare(String(b)); // String sort as fallback
    });
    
    const data = labels.map(label => props.tallyResults[label] || 0);

    // Set loading state after data processing is complete
    // Use nextTick if necessary, but usually direct assignment is fine here
    chartDataLoaded.value = true; 

    return {
        labels: labels,
        datasets: [
            {
                label: 'Votes per Value',
                backgroundColor: '#4caf50', // Use theme variable if available
                borderColor: '#4caf50',
                borderWidth: 1,
                data: data
            }
        ]
    };
});

const distributionChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false, 
  scales: {
      y: {
          beginAtZero: true,
          ticks: { 
            stepSize: 1, // Ensure only integers are shown on y-axis
            precision: 0 // Explicitly set precision to 0
          },
          title: {
              display: true,
              text: 'Number of Votes'
          }
      },
      x: {
           title: {
              display: true,
              text: (props.sliderConfig && props.sliderConfig.label) || 'Selected Value' // Use label from config if provided
          }
      }
  },
  plugins: {
      legend: {
          display: false // Hide legend for single dataset
      },
       tooltip: {
            callbacks: {
                label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed.y !== null) {
                        // Ensure integer display in tooltip
                        label += Math.round(context.parsed.y) + (Math.round(context.parsed.y) === 1 ? ' vote' : ' votes');
                    }
                    return label;
                }
            }
        }
  }
});

</script>

<style lang="scss" scoped>
/* Styles adapted from _vote-results.scss and VoteResults.vue */
.results-display {
  display: flex;
  flex-direction: column;
  gap: 20px; /* $spacing-lg; */
  margin-top: 20px; /* Added margin */
}

.result-item {
  display: flex;
  flex-direction: column;
  align-items: stretch; 
  width: 100%;
  margin-bottom: 15px; /* $spacing-md; */
}

.result-header {
  font-weight: bold;
  margin-bottom: 5px; /* $spacing-xs; */
  text-align: left; 
  width: 100%; 
}

.progress-bar {
  width: 100%;
  height: 20px;
  background-color: #e9ecef; /* var(--background-alt); */
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 5px; /* $spacing-xs; */
  border: 1px solid #dee2e6; /* var(--border-color); */
}

.progress {
  height: 100%;
  background-color: #4caf50; /* var(--success); */
  transition: width 0.3s ease-in-out;
  border-radius: 10px; /* Match parent radius */
}

.percentage {
  font-size: 14px;
  color: #333;
  text-align: right; 
  width: 100%;
}

.error-message {
  color: #721c24; /* var(--danger-dark); */
  background-color: #f8d7da; /* var(--danger-light); */
  border: 1px solid #f5c6cb;
  padding: 10px 15px;
  border-radius: 4px; /* var(--border-radius); */
  text-align: center;
}

.total-votes-display {
    margin-top: 10px; /* $spacing-sm */
    font-weight: bold;
    text-align: center;
}

/* Slider specific styles */
.average-result {
    margin-top: 5px; /* $spacing-xs */
    font-size: 1.2em;
    font-weight: bold;
    text-align: center;
    padding: 10px; /* $spacing-sm; */
    background-color: #f8f9fa; /* var(--background-light); */
    border-radius: 4px; /* var(--border-radius); */
    border: 1px solid #dee2e6; /* var(--border-color); */
}

.total-votes-slider {
    margin-top: 5px; /* $spacing-xs; */
    font-size: 0.9em;
    text-align: center;
    color: #6c757d; /* var(--text-secondary); */
    width: 100%; /* Make range input full width */
    cursor: default; /* Indicate it's disabled */
}

/* Ensure chart has a defined height */
#distribution-chart {
    height: 300px; /* Adjust as needed */
    max-height: 400px;
    margin: 15px 0; /* $spacing-md 0; */
    width: 100%; /* Ensure chart takes full width */
}

h4 {
    text-align: center;
    margin-bottom: 10px; /* $spacing-sm */
    margin-top: 15px; /* $spacing-md */
    padding-bottom: 5px; /* $spacing-xs */
    border-bottom: 1px solid #dee2e6; /* var(--border-color); */
}

</style> 