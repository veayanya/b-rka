<template>
  <div class="chart-wrapper-canvas" style="width: 100%; height: 100%; position: relative;">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import Chart from 'chart.js/auto';

const props = defineProps({
  type: {
    type: String,
    required: true
  },
  data: {
    type: Object,
    required: true
  },
  options: {
    type: Object,
    default: () => ({})
  }
});

const canvasRef = ref(null);
let chartInstance = null;

const createChart = () => {
  if (chartInstance) {
    chartInstance.destroy();
  }
  
  if (!canvasRef.value) return;
  
  chartInstance = new Chart(canvasRef.value, {
    type: props.type,
    data: props.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...props.options
    }
  });
};

watch(() => props.data, () => {
  createChart();
}, { deep: true });

watch(() => props.type, () => {
  createChart();
});

onMounted(() => {
  // Use a slight timeout to ensure container is fully sized
  setTimeout(() => {
    createChart();
  }, 50);
});

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>
