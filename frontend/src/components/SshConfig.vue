<template>
  <div class="ssh-container">
    <div class="page-header">
      <span class="page-kicker">Pengaturan</span>
      <h2 class="page-title-lg">Konfigurasi SSH &amp; SBM</h2>
      <p class="page-desc">Kelola database Standar Satuan Harga (SSH) resmi untuk audit kepatuhan anggaran secara otomatis dan multi-tahun.</p>
    </div>

    <!-- Header Card -->
    <div class="card ssh-header-card">
      <div class="card-header" style="flex-wrap: wrap; gap: 16px; justify-content: space-between;">
        <div>
          <h2 class="card-title">
            <i data-lucide="database" class="icon-inline" style="color: var(--primary-color);"></i>
            Database SSH Multi-Tahun & Multi-Versi
          </h2>
          <span class="card-subtitle">
            Kelola database Standar Satuan Harga (SSH) resmi untuk audit kepatuhan otomatis multi-tahun.
          </span>
        </div>
        <div class="ssh-stats-summary" v-if="sshDatabases.length > 0">
          <span class="summary-badge">
            <i data-lucide="layers" style="width: 14px; height: 14px;"></i>
            {{ sshDatabases.length }} Database Terdaftar
          </span>
        </div>
      </div>
    </div>

    <!-- Main Config Area -->
    <div class="ssh-grid">
      <!-- Left Column: Upload Panel -->
      <div class="ssh-column">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title-sm">
              <i data-lucide="upload-cloud" class="icon-inline" style="color: var(--primary-color);"></i>
              Unggah SSH Baru
            </h3>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-inputs-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 600;">Tahun Anggaran</label>
                <input
                  type="text"
                  v-model="sshTahunInput"
                  placeholder="Contoh: 2026"
                  class="form-input text-center"
                  style="font-weight: 700;"
                />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 600;">Label Versi</label>
                <input
                  type="text"
                  v-model="sshVersiInput"
                  placeholder="Contoh: Murni, Revisi 1, v1.0"
                  class="form-input text-center"
                />
              </div>
            </div>

            <!-- Upload Zone -->
            <div
              class="large-upload-zone"
              @click="triggerSshUpload"
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="onFileDrop"
              :class="{ 'uploading': sshLoading, 'dragover': dragOver }"
              style="min-height: 180px; padding: 24px;"
            >
              <input
                type="file"
                ref="sshFileInput"
                accept=".pdf"
                style="display: none"
                @change="onSshPdfChange"
              />

              <div v-if="!sshLoading" class="upload-zone-content">
                <div class="upload-icon-wrapper" style="width: 60px; height: 60px; margin-bottom: 4px;">
                  <i data-lucide="file-text" style="width: 32px; height: 32px; color: var(--primary-color);"></i>
                </div>
                <h4 style="margin: 4px 0;">Pilih atau Seret PDF SSH</h4>
                <p class="upload-zone-sub" style="font-size: 0.8rem; max-width: 250px;">
                  Pindai dan ekstrak otomatis dengan AI Gemini
                </p>
              </div>

              <div v-else class="upload-zone-content">
                <div class="large-spinner" style="width: 36px; height: 36px;"></div>
                <h4 style="margin-top: 12px; font-size: 0.95rem;">{{ sshLoadingText }}</h4>
                <p class="upload-zone-sub" style="font-size: 0.75rem;">Proses ini memerlukan waktu beberapa detik</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Database Archive & Version History -->
      <div class="ssh-column">
        <div class="card" style="height: 100%; display: flex; flex-direction: column;">
          <div class="card-header" style="justify-content: space-between;">
            <h3 class="card-title-sm">
              <i data-lucide="archive" class="icon-inline" style="color: var(--info-color);"></i>
              Arsip & Riwayat Versi SSH
            </h3>
          </div>
          <div class="card-body archive-list-container" style="flex: 1; overflow-y: auto; max-height: 280px; padding: 12px;">
            <div v-if="sshDatabases.length === 0" class="empty-archive-msg">
              <i data-lucide="layers" style="width: 32px; height: 32px; opacity: 0.3; margin-bottom: 8px;"></i>
              <p>Belum ada arsip database SSH terunggah.</p>
            </div>
            <div v-else class="archive-items-list">
              <div
                v-for="db in sshDatabases"
                :key="db.id"
                class="archive-item-card"
                :class="{ 'selected': selectedDbId === db.id }"
                @click="selectDatabase(db.id)"
              >
                <div class="archive-card-header">
                  <div class="title-wrap">
                    <span class="year-badge">{{ db.tahun }}</span>
                    <span class="version-label">{{ db.versi || 'v1.0' }}</span>
                  </div>
                  <span class="status-indicator-badge" :class="db.status">
                    {{ db.status === 'active' ? 'Aktif' : 'Arsip' }}
                  </span>
                </div>
                <div class="archive-card-meta">
                  <div class="meta-line">
                    <i data-lucide="file" style="width: 12px; height: 12px;"></i>
                    <span>{{ db.filename || 'ssh-dokumen.pdf' }}</span>
                  </div>
                  <div class="meta-line">
                    <i data-lucide="calendar" style="width: 12px; height: 12px;"></i>
                    <span>{{ formatDate(db.tanggalUpload) }}</span>
                  </div>
                  <div class="meta-line">
                    <i data-lucide="list" style="width: 12px; height: 12px;"></i>
                    <span>{{ db.total_item || db.jumlahItem || 0 }} item terdaftar</span>
                  </div>
                </div>
                <div class="archive-card-actions" @click.stop>
                  <button @click="selectDatabase(db.id)" class="btn btn-secondary btn-xs">
                    <i data-lucide="eye" style="width: 12px; height: 12px;"></i> Lihat
                  </button>
                  <button v-if="db.status !== 'active'" @click="toggleActiveStatus(db.id)" class="btn btn-success-light btn-xs">
                    <i data-lucide="check" style="width: 12px; height: 12px;"></i> Aktifkan
                  </button>
                  <button @click="deleteDatabase(db.id)" class="btn-danger-link">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i> Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview Extracted Items Card (Shown after successful parsing before confirm saving) -->
    <div v-if="sshPreview.length > 0" class="card ssh-preview-card animate-fade-in" style="margin-top: 24px;">
      <div class="card-header preview-header-bg">
        <div>
          <h3 class="card-title" style="color: white;">
            <i data-lucide="sparkles" class="icon-inline"></i>
            Hasil Ekstraksi AI ({{ sshPreview.length }} Item Ditemukan)
          </h3>
          <span class="card-subtitle" style="color: rgba(255, 255, 255, 0.85);">
            Tinjau lalu klik simpan untuk mendaftarkan ke database tahun {{ sshTahunInput }} versi {{ sshVersiInput }}.
          </span>
        </div>
        <div class="action-buttons-group">
          <button @click="confirmSaveSsh" class="btn btn-success">
            <i data-lucide="save"></i> Simpan Database SSH
          </button>
          <button @click="sshPreview = []" class="btn btn-danger">
            Batal
          </button>
        </div>
      </div>
      <div class="card-body" style="padding: 0;">
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 50px; text-align: center;">No</th>
                <th>Nama Komponen / Uraian</th>
                <th style="text-align: center;">Kategori</th>
                <th style="text-align: right;">Harga Satuan</th>
                <th style="text-align: center;">Satuan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in sshPreview" :key="idx">
                <td style="text-align: center; color: var(--text-muted);">{{ idx + 1 }}</td>
                <td style="font-weight: 600; color: var(--text-primary);">{{ item.nama }}</td>
                <td style="text-align: center;">
                  <span class="ssh-badge" :class="'badge-' + item.kategori">{{ item.kategori }}</span>
                </td>
                <td style="text-align: right; font-weight: 700; color: var(--primary-color);">
                  Rp {{ formatRibuan(item.nilai) }}
                </td>
                <td style="text-align: center; color: var(--text-secondary);">{{ item.satuan }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Active SSH Items Database Display -->
    <div v-if="sshPreview.length === 0" class="card" style="margin-top: 24px;">
      <div class="card-header" style="flex-wrap: wrap; gap: 16px; justify-content: space-between;">
        <div>
          <h3 class="card-title">
            Daftar Item: SSH Cirebon {{ selectedDbMeta ? `${selectedDbMeta.tahun} (${selectedDbMeta.versi})` : '-' }}
          </h3>
          <span class="card-subtitle">Menampilkan rincian standar satuan harga untuk versi yang dipilih di atas</span>
        </div>
      </div>

      <!-- Search & Count row -->
      <div class="ssh-filter-row" v-if="selectedDbItems.length > 0">
        <div style="position: relative; flex: 1; max-width: 400px;">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Cari nama komponen SSH..."
            class="form-input"
            style="padding-left: 36px;"
          />
          <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: var(--text-muted);"></i>
        </div>
        <div class="filtered-count">
          Menampilkan <strong>{{ filteredSshItems.length }}</strong> dari <strong>{{ selectedDbItems.length }}</strong> item
        </div>
      </div>

      <div class="card-body" style="padding: 0;">
        <!-- Empty database state -->
        <div v-if="selectedDbItems.length === 0" class="ssh-empty-state">
          <div class="empty-icon-wrapper">
            <i data-lucide="database" style="width: 48px; height: 48px; opacity: 0.3;"></i>
          </div>
          <h3>Tidak Ada Data Detail</h3>
          <p>Silakan pilih database versi aktif di panel arsip atau unggah PDF SSH baru.</p>
        </div>

        <!-- Table list -->
        <div v-else class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">No</th>
                <th>Nama Komponen</th>
                <th style="text-align: center;">Kategori</th>
                <th style="text-align: right;">Harga Satuan</th>
                <th style="text-align: center;">Satuan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredSshItems.length === 0">
                <td colspan="5" style="text-align: center; padding: 32px; color: var(--text-muted);">
                  Tidak ditemukan item SSH yang cocok dengan pencarian Anda.
                </td>
              </tr>
              <tr v-else v-for="(item, idx) in paginatedSshItems" :key="idx">
                <td style="text-align: center; color: var(--text-muted);">
                  {{ (currentPage - 1) * itemsPerPage + idx + 1 }}
                </td>
                <td style="font-weight: 500; color: var(--text-primary);">{{ item.nama }}</td>
                <td style="text-align: center;">
                  <span class="ssh-badge" :class="'badge-' + item.kategori">{{ item.kategori }}</span>
                </td>
                <td style="text-align: right; font-weight: 700; color: var(--primary-color);">
                  Rp {{ formatRibuan(item.nilai) }}
                </td>
                <td style="text-align: center; color: var(--text-secondary);">{{ item.satuan || 'Porsi' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div class="ssh-pagination" v-if="filteredSshItems.length > itemsPerPage">
          <button
            class="btn btn-secondary btn-sm"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            Sebelumnya
          </button>
          <span class="page-indicator">Halaman {{ currentPage }} dari {{ totalPages }}</span>
          <button
            class="btn btn-secondary btn-sm"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { apiFetch } from '@/utils/api';

const sshDatabases = ref([]);
const selectedDbId = ref(null);
const selectedDbItems = ref([]);
const selectedDbMeta = ref(null);

const sshPreview = ref([]);
const sshLoading = ref(false);
const sshLoadingText = ref('Membaca PDF...');
const sshTahunInput = ref('');
const sshVersiInput = ref('');
const sshFileInput = ref(null);
const dragOver = ref(false);

const searchQuery = ref('');
const currentPage = ref(1);
const itemsPerPage = 10;
const uploadedFilename = ref('');

const formatRibuan = (n) => {
  if (!n) return '0';
  return Number(n).toLocaleString('id-ID');
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
};

const triggerSshUpload = () => {
  if (!sshLoading.value && sshFileInput.value) {
    sshFileInput.value.click();
  }
};

const onFileDrop = (e) => {
  dragOver.value = false;
  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    processSshFile(files[0]);
  }
};

const onSshPdfChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    processSshFile(file);
  }
};

const fetchDatabases = async () => {
  try {
    const res = await apiFetch('/api/v1/ssh', { credentials: 'include' });
    if (res.ok) {
      sshDatabases.value = await res.json();
      
      // Select the first active database if none is selected
      if (sshDatabases.value.length > 0 && !selectedDbId.value) {
        const active = sshDatabases.value.find(s => s.status === 'active') || sshDatabases.value[0];
        selectDatabase(active.id);
      }
    }
  } catch (error) {
    console.error("Gagal memuat daftar database:", error);
  }
};

const selectDatabase = async (id) => {
  selectedDbId.value = id;
  selectedDbMeta.value = sshDatabases.value.find(s => s.id === id) || null;
  selectedDbItems.value = [];
  
  if (!id) return;
  try {
    const res = await apiFetch(`/api/v1/ssh/${id}`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      selectedDbItems.value = data.items || [];
      currentPage.value = 1;
      triggerLucide();
    }
  } catch (error) {
    console.error("Gagal memuat detail database SSH:", error);
  }
};

const toggleActiveStatus = async (id) => {
  try {
    const res = await apiFetch(`/api/v1/ssh/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'active' })
    });
    if (res.ok) {
      await fetchDatabases();
      // reload details
      if (selectedDbId.value === id) {
        await selectDatabase(id);
      }
      alert('Database SSH berhasil diaktifkan sebagai versi utama untuk tahun tersebut.');
    }
  } catch (error) {
    console.error("Gagal mengaktifkan database:", error);
  }
};

const deleteDatabase = async (id) => {
  if (!confirm('Apakah Anda yakin ingin menghapus database SSH versi ini dari arsip?')) return;
  try {
    const res = await apiFetch(`/api/v1/ssh/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (res.ok) {
      if (selectedDbId.value === id) {
        selectedDbId.value = null;
        selectedDbMeta.value = null;
        selectedDbItems.value = [];
      }
      await fetchDatabases();
      alert('Database SSH berhasil dihapus.');
    }
  } catch (error) {
    console.error("Gagal menghapus database:", error);
  }
};

const processSshFile = async (file) => {
  if (!file) return;
  if (!file.name.endsWith('.pdf')) {
    alert('Hanya file PDF yang diterima.');
    return;
  }

  const key = localStorage.getItem('GEMINI_API_KEY') || '';
  if (!key) {
    alert('Masukkan dan simpan API Key Gemini terlebih dahulu di bagian bawah sidebar.');
    return;
  }

  sshLoading.value = true;
  sshLoadingText.value = 'Membaca PDF SSH...';
  sshPreview.value = [];
  uploadedFilename.value = file.name;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const typedarray = new Uint8Array(arrayBuffer);
    const pdf = await window.pdfjsLib.getDocument(typedarray).promise;

    let textContent = '';
    const maxPages = Math.min(pdf.numPages, 30);
    for (let i = 1; i <= maxPages; i++) {
      sshLoadingText.value = `Membaca halaman ${i} dari ${pdf.numPages}...`;
      const page = await pdf.getPage(i);
      const text = await page.getTextContent();
      textContent += text.items.map(t => t.str).join(' ') + '\n';
    }

    if (!textContent.trim()) {
      throw new Error('Tidak dapat membaca teks dari PDF ini.');
    }

    sshLoadingText.value = 'AI sedang mengekstrak nilai SSH...';
    const tahun = sshTahunInput.value.trim() || new Date().getFullYear().toString();

    const response = await apiFetch('/api/v1/extract-ssh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key
      },
      credentials: 'include',
      body: JSON.stringify({ text: textContent, tahun })
    });

    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error || 'Gagal mengekstrak SSH');
    }

    if (!result.items || result.items.length === 0) {
      throw new Error('AI tidak menemukan item SSH di dokumen ini.');
    }

    sshPreview.value = result.items;
  } catch (err) {
    alert('Gagal: ' + err.message);
  } finally {
    sshLoading.value = false;
    if (sshFileInput.value) sshFileInput.value.value = '';
    triggerLucide();
  }
};

const confirmSaveSsh = async () => {
  const tahun = sshTahunInput.value.trim() || new Date().getFullYear().toString();
  const versi = sshVersiInput.value.trim() || 'v1.0';
  
  const payload = {
    tahun,
    versi,
    filename: uploadedFilename.value || 'ssh-manual-upload.pdf',
    total_item: sshPreview.value.length,
    status: 'active',
    items: sshPreview.value
  };

  try {
    const res = await apiFetch('/api/v1/ssh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      const saved = await res.json();
      sshPreview.value = [];
      sshVersiInput.value = '';
      alert(`Database SSH Tahun ${tahun} versi ${versi} berhasil disimpan ke server!`);
      selectedDbId.value = saved.id;
      await fetchDatabases();
      await selectDatabase(saved.id);
    } else {
      const err = await res.json();
      alert('Gagal menyimpan ke server: ' + (err.error || 'Unknown error'));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
};

const filteredSshItems = computed(() => {
  if (!searchQuery.value.trim()) {
    return selectedDbItems.value;
  }
  const query = searchQuery.value.toLowerCase();
  return selectedDbItems.value.filter(item => 
    item.nama && item.nama.toLowerCase().includes(query)
  );
});

const totalPages = computed(() => {
  return Math.ceil(filteredSshItems.value.length / itemsPerPage) || 1;
});

const paginatedSshItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredSshItems.value.slice(start, start + itemsPerPage);
});

watch(searchQuery, () => {
  currentPage.value = 1;
});

const triggerLucide = () => {
  if (window.lucide) {
    setTimeout(() => window.lucide.createIcons(), 50);
  }
};

onMounted(async () => {
  sshTahunInput.value = '2026';
  sshVersiInput.value = 'v1.0';
  await fetchDatabases();
  triggerLucide();
});

watch(sshPreview, () => {
  triggerLucide();
});
</script>

<style scoped>
.ssh-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ssh-stats-summary {
  display: flex;
  align-items: center;
}

.summary-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid var(--border-color);
}

.ssh-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 24px;
}

@media (max-width: 992px) {
  .ssh-grid {
    grid-template-columns: 1fr;
  }
}

.large-upload-zone {
  border: 2px dashed var(--border-color-strong);
  border-radius: 12px;
  background-color: var(--bg-primary);
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.large-upload-zone:hover, .large-upload-zone.dragover {
  border-color: var(--primary-color);
  background-color: var(--info-glow);
}

.upload-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-icon-wrapper {
  background-color: var(--info-glow);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-zone-sub {
  color: var(--text-muted);
}

.large-spinner {
  border: 3px solid var(--border-color-strong);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Archive List styling */
.empty-archive-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-muted);
  text-align: center;
  font-size: 0.9rem;
}

.archive-items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.archive-item-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  background-color: var(--card-bg, #ffffff);
  cursor: pointer;
  transition: all 0.2s ease;
}

.archive-item-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(0,0,0,0.04);
}

.archive-item-card.selected {
  border-color: var(--primary-color);
  background-color: var(--info-glow);
  border-width: 1.5px;
}

.archive-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.year-badge {
  background-color: var(--primary-color);
  color: white;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.version-label {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.status-indicator-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.status-indicator-badge.active {
  background-color: var(--success-glow);
  color: var(--success-hover);
}

.status-indicator-badge.archived {
  background-color: var(--bg-tertiary);
  color: var(--text-muted);
}

.archive-card-meta {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.meta-line {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archive-card-actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--border-color);
  padding-top: 8px;
  margin-top: 4px;
  justify-content: flex-end;
  align-items: center;
}

.btn-xs {
  padding: 4px 8px;
  font-size: 0.75rem;
  border-radius: 4px;
}

.btn-success-light {
  background-color: var(--success-glow);
  color: var(--success-hover);
  border: 1px solid var(--success-glow);
}

.btn-success-light:hover {
  background-color: var(--success-glow);
}

.btn-danger-link {
  background: none;
  border: none;
  color: var(--danger-color);
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.btn-danger-link:hover {
  text-decoration: underline;
}

/* Badges & Tables */
.preview-header-bg {
  background: linear-gradient(135deg, var(--info-color) 0%, var(--info-color) 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.action-buttons-group {
  display: flex;
  gap: 8px;
}

.ssh-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.badge-honorarium { background: var(--info-glow); color: var(--info-color); }
.badge-konsumsi { background: var(--warning-glow); color: var(--warning-color); }
.badge-perjalanan_dinas { background: var(--success-glow); color: var(--success-hover); }
.badge-sewa { background: var(--primary-glow); color: #4c1d95; }
.badge-atk { background: var(--danger-glow); color: var(--danger-color); }
.badge-cetak { background: var(--primary-glow); color: #9d174d; }
.badge-akomodasi { background: var(--info-glow); color: #075985; }
.badge-bahan { background: var(--success-glow); color: #064e3b; }
.badge-jasa { background: var(--success-glow); color: var(--success-color); }
.badge-lainnya { background: var(--bg-tertiary); color: var(--text-secondary); }

.ssh-filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
  gap: 12px;
}

.filtered-count {
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.ssh-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}

.empty-icon-wrapper {
  margin-bottom: 16px;
  color: var(--text-muted);
}

.ssh-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.page-indicator {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-secondary);
}
</style>
