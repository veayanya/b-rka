<template>
  <div class="dashboard-container">
    <div class="page-header">
      <span class="page-kicker">Unggah Dokumen</span>
      <p class="page-desc">Unggah dokumen RKA untuk memulai proses audit anggaran, ekstraksi indikator kinerja, dan proyeksi SROI berbasis AI.</p>
    </div>
    <div style="width: 100%; margin: 12px 0 0;">
      <UploadSection />
    </div>
  </div>
</template>

<script setup>
import { onMounted, nextTick } from 'vue';
import UploadSection from './UploadSection.vue';

onMounted(() => {
  if (window.lucide) {
    nextTick(() => window.lucide.createIcons());
  }
});
</script>

