import { createApp } from 'vue';
import App from './App.vue';
import './assets/style.css';

// Set PDF.js worker source globally
if (typeof window !== 'undefined' && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

createApp(App).mount('#app');
