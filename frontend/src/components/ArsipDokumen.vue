<template>
  <div class="arsip-container">

    <div class="page-header">
      <span class="page-kicker">Arsip Dokumen RKA</span>
      <h2 class="page-title-lg">Arsip Dokumen RKA</h2>
      <p class="page-desc">Kelola seluruh dokumen RKA yang telah diunggah dan dianalisis oleh layanan AI, lengkap dengan riwayat versi dan status.</p>
    </div>

    <!-- Header Card -->
    <div class="card arsip-header-card">
      <div class="card-header" style="flex-wrap: wrap; gap: 16px;">
        <div>
          <h2 class="card-title">
            <i data-lucide="folder-archive" class="icon-inline" style="color: var(--primary-color);"></i>
            Arsip Dokumen RKA Kabupaten Cirebon
          </h2>
          <span class="card-subtitle">Manajemen seluruh dokumen RKA yang telah diunggah dan dianalisis oleh layanan AI</span>
        </div>
        <button class="btn btn-primary" id="btn-upload-new-arsip" @click="goToUpload">
          <i data-lucide="upload-cloud"></i> Unggah Dokumen Baru
        </button>
      </div>

      <!-- Search & Filter Bar -->
      <div class="arsip-filter-bar">
        <div style="position: relative; flex: 1; min-width: 200px;">
          <input
            type="text"
            id="arsip-search"
            class="form-input"
            v-model="searchQuery"
            placeholder="Cari nama dokumen, OPD, atau ID..."
            style="padding-left: 38px;"
          >
          <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--text-muted);"></i>
        </div>
        <select class="form-input" id="arsip-filter-status" v-model="filterStatus" style="width: 180px;">
          <option value="all">Semua Status</option>
          <option value="Approved">Disahkan</option>
          <option value="Draft">Draf</option>
        </select>
        <div class="arsip-count-badge">
          <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
          {{ filteredRkis.length }} Dokumen
        </div>
      </div>

      <!-- Table -->
      <div class="card-body" style="padding: 0;">
        <div class="data-table-container">
          <table class="data-table arsip-table">
            <thead>
              <tr>
                <th>Nama Dokumen</th>
                <th>OPD / Satuan Kerja</th>
                <th style="text-align:center;">Tahun</th>
                <th>Tanggal Upload</th>
                <th style="text-align:center;">SROI</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:right;">Ukuran File</th>
                <th style="text-align:center;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <!-- Empty state -->
              <tr v-if="filteredRkis.length === 0">
                <td colspan="8" class="arsip-empty-state">
                  <div class="arsip-empty-content">
                    <i data-lucide="folder-open" style="width: 52px; height: 52px; opacity: 0.25; margin-bottom: 16px;"></i>
                    <p v-if="searchQuery || filterStatus !== 'all'">
                      Tidak ada dokumen yang cocok dengan filter yang dipilih.
                    </p>
                    <p v-else>
                      Belum ada dokumen RKA yang tersimpan dalam arsip.<br>
                      Mulai dengan mengunggah dokumen RKA pertama Anda.
                    </p>
                    <button
                      v-if="!searchQuery && filterStatus === 'all'"
                      class="btn btn-primary btn-sm"
                      style="margin-top: 16px;"
                      @click="goToUpload"
                    >
                      <i data-lucide="upload-cloud"></i> Unggah Dokumen Pertama
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Data rows -->
              <tr
                v-else
                v-for="item in filteredRkis"
                :key="item.id"
                class="arsip-row"
              >
                <!-- Nama Dokumen -->
                <td class="arsip-td-nama">
                  <div class="arsip-doc-name">{{ item.namaDokumen || item.program }}</div>
                  <div class="arsip-doc-sub">
                    <span>{{ item.id }} · {{ item.program }}</span>
                    <span v-if="item.versions && item.versions.length > 1" class="badge-ver-count">
                      {{ item.versions.length }} Versi
                    </span>
                  </div>
                </td>

                <!-- OPD -->
                <td class="arsip-td-opd">{{ item.opd }}</td>

                <!-- Tahun -->
                <td style="text-align:center; font-weight: 700; font-size: 0.88rem;">
                  {{ item.tahun || '2026' }}
                </td>

                <!-- Tanggal Upload -->
                <td class="arsip-td-date">{{ formatDate(item.tanggalUpload) }}</td>

                <!-- SROI Badge -->
                <td style="text-align:center;">
                  <span :class="['badge', getSroiBadgeClass(item.sroi)]">
                    {{ item.sroi }} · {{ getSroiLabel(item.sroi) }}
                  </span>
                </td>

                <!-- Status -->
                <td style="text-align:center;">
                  <span :class="['badge', getStatusBadgeClass(item.status)]">
                    {{ getStatusText(item.status) }}
                  </span>
                </td>

                <!-- Ukuran File -->
                <td style="text-align:right; font-size: 0.8rem; color: var(--text-secondary);">
                  {{ formatFileSize(item.ukuranFile) }}
                </td>

                <!-- Aksi -->
                <td style="text-align:center;">
                  <div class="arsip-actions">
                    <button
                      class="btn btn-secondary btn-sm arsip-btn-icon arsip-btn-agent"
                      @click="openInAgenticAi(item)"
                      title="Buka di Agentic AI Studio (Audit, Koreksi, Versioning)"
                    >
                      <i data-lucide="bot"></i>
                    </button>
                    <button
                      class="btn btn-secondary btn-sm arsip-btn-icon"
                      @click="viewItem(item)"
                      title="Lihat Hasil Analisis SROI"
                    >
                      <i data-lucide="eye"></i>
                    </button>
                    <button
                      class="btn btn-secondary btn-sm arsip-btn-icon"
                      @click="openEditModal(item)"
                      title="Edit Metadata"
                    >
                      <i data-lucide="pencil"></i>
                    </button>
                    <button
                      class="arsip-btn-danger"
                      @click="openDeleteModal(item)"
                      title="Hapus Dokumen"
                    >
                      <i data-lucide="trash-2"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ===================== MODAL: Delete Confirmation ===================== -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
          <div class="modal-box">
            <div class="modal-icon-wrap danger">
              <i data-lucide="alert-triangle"></i>
            </div>
            <h3 class="modal-title">Hapus Dokumen?</h3>
            <p class="modal-desc">
              Dokumen
              <strong>{{ deleteTarget?.namaDokumen || deleteTarget?.program }}</strong>
              akan dihapus dari arsip secara permanen.
            </p>
            <p class="modal-warning">Data yang telah dihapus tidak dapat dikembalikan.</p>
            <div class="modal-actions">
              <button class="btn btn-secondary modal-btn" id="btn-cancel-delete" @click="showDeleteModal = false">
                Batal
              </button>
              <button
                class="btn modal-btn modal-btn-danger"
                id="btn-confirm-delete"
                @click="confirmDelete"
              >
                <i data-lucide="trash-2"></i> Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===================== MODAL: Edit Metadata ===================== -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
          <div class="modal-box modal-wide">
            <h3 class="modal-title" style="text-align:left; margin-bottom: 4px;">
              <i data-lucide="pencil" style="width:18px;height:18px; vertical-align:middle; margin-right:6px; color: var(--primary-color);"></i>
              Edit Metadata Dokumen
            </h3>
            <p class="modal-desc" style="text-align:left; margin-bottom: 20px;">
              Ubah informasi dokumen tanpa mengubah isi file atau hasil analisis AI.
            </p>

            <div class="form-group">
              <label class="form-label" for="modal-nama-dokumen">Nama Dokumen</label>
              <input
                type="text"
                id="modal-nama-dokumen"
                class="form-input"
                v-model="editForm.namaDokumen"
                placeholder="Nama file atau judul dokumen RKA"
              >
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label class="form-label" for="modal-tahun">Tahun Anggaran</label>
                <input
                  type="number"
                  id="modal-tahun"
                  class="form-input"
                  v-model.number="editForm.tahun"
                  min="2020"
                  max="2035"
                >
              </div>
              <div class="form-group">
                <label class="form-label" for="modal-opd">OPD / Satuan Kerja</label>
                <input
                  type="text"
                  id="modal-opd"
                  class="form-input"
                  v-model="editForm.opd"
                  placeholder="Nama OPD atau SKPD"
                >
              </div>
            </div>

            <div class="modal-actions" style="margin-top: 8px;">
              <button class="btn btn-secondary modal-btn" id="btn-cancel-edit" @click="showEditModal = false">
                Batal
              </button>
              <button class="btn btn-primary modal-btn" id="btn-proceed-save" @click="openSaveConfirmModal">
                <i data-lucide="save"></i> Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===================== MODAL: Save Confirmation ===================== -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showSaveConfirmModal" class="modal-overlay" @click.self="showSaveConfirmModal = false">
          <div class="modal-box">
            <div class="modal-icon-wrap primary">
              <i data-lucide="save"></i>
            </div>
            <h3 class="modal-title">Simpan Perubahan?</h3>
            <p class="modal-desc">Perubahan metadata dokumen akan disimpan ke arsip.</p>
            <div class="modal-actions">
              <button class="btn btn-secondary modal-btn" id="btn-cancel-save" @click="cancelSave">
                Batal
              </button>
              <button class="btn btn-primary modal-btn" id="btn-confirm-save" @click="confirmEdit">
                <i data-lucide="check-circle-2"></i> Simpan
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useAnalysis } from '../composables/useAnalysis';

const {
  rkis,
  currentTab,
  loadHistoricalDocIntoAnalyzer,
  deleteRki,
  updateRkiMetadata,
  formatRupiah,
  openInAgenticAi
} = useAnalysis();

// ── Search & Filter ──────────────────────────────────────────────────
const searchQuery = ref('');
const filterStatus = ref('all');

const filteredRkis = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  return rkis.value.filter(item => {
    const matchesSearch = !q ||
      (item.namaDokumen || '').toLowerCase().includes(q) ||
      (item.opd || '').toLowerCase().includes(q) ||
      (item.program || '').toLowerCase().includes(q) ||
      (item.id || '').toLowerCase().includes(q);
    const matchesStatus = filterStatus.value === 'all' || item.status === filterStatus.value;
    return matchesSearch && matchesStatus;
  });
});

// ── Modal State ───────────────────────────────────────────────────────
const showDeleteModal     = ref(false);
const showEditModal       = ref(false);
const showSaveConfirmModal = ref(false);
const deleteTarget        = ref(null);
const editTarget          = ref(null);
const editForm            = ref({ namaDokumen: '', tahun: new Date().getFullYear(), opd: '' });

// ── Navigation ────────────────────────────────────────────────────────
const goToUpload = () => { currentTab.value = 'dashboard'; };
const viewItem   = (item) => { loadHistoricalDocIntoAnalyzer(item); };

// ── Delete Flow ───────────────────────────────────────────────────────
const openDeleteModal = (item) => {
  deleteTarget.value = item;
  showDeleteModal.value = true;
  nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
};

const confirmDelete = () => {
  if (deleteTarget.value) {
    deleteRki(deleteTarget.value.id);
    showDeleteModal.value = false;
    deleteTarget.value = null;
  }
};

// ── Edit Flow ─────────────────────────────────────────────────────────
const openEditModal = (item) => {
  editTarget.value = item;
  editForm.value = {
    namaDokumen: item.namaDokumen || item.program || '',
    tahun:       item.tahun || new Date().getFullYear(),
    opd:         item.opd || ''
  };
  showEditModal.value = true;
  nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
};

const openSaveConfirmModal = () => {
  showEditModal.value = false;
  showSaveConfirmModal.value = true;
  nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
};

const cancelSave = () => {
  showSaveConfirmModal.value = false;
  showEditModal.value = true;
  nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
};

const confirmEdit = () => {
  if (editTarget.value) {
    updateRkiMetadata(editTarget.value.id, {
      namaDokumen: editForm.value.namaDokumen,
      tahun:       editForm.value.tahun,
      opd:         editForm.value.opd
    });
    showSaveConfirmModal.value = false;
    editTarget.value = null;
  }
};

// ── Formatting Helpers ────────────────────────────────────────────────
const formatDate = (isoStr) => {
  if (!isoStr) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit'
    }).format(new Date(isoStr));
  } catch {
    return isoStr;
  }
};

const formatFileSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getSroiBadgeClass = (sroi) => {
  if (sroi > 1.0) return 'badge-success';
  if (sroi === 1.0) return 'badge-warning';
  return 'badge-danger';
};

const getSroiLabel = (sroi) => {
  if (sroi > 1.0) return 'Layak';
  if (sroi === 1.0) return 'Impas';
  return 'Koreksi';
};

const getStatusBadgeClass = (status) => {
  if (status === 'Approved') return 'badge-success';
  return 'badge-primary';
};

const getStatusText = (status) => {
  if (status === 'Approved') return 'DISAHKAN';
  return 'DRAF';
};

// ── Lucide refresh ────────────────────────────────────────────────────
onMounted(() => {
  if (window.lucide) nextTick(() => window.lucide.createIcons());
});

watch([showDeleteModal, showEditModal, showSaveConfirmModal, filteredRkis], () => {
  nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
});
</script>

<style scoped>
.badge-ver-count {
  background: var(--info-glow);
  color: var(--info-hover);
  font-size: 10px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid var(--info-glow);
  display: inline-block;
  margin-left: 6px;
}

.arsip-btn-agent {
  color: var(--accent-color);
  background: var(--success-glow);
  border-color: var(--success-glow);
}

.arsip-btn-agent:hover {
  background: var(--accent-color);
  color: #ffffff;
}
</style>

