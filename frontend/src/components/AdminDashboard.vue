<template>
  <div class="admin-dashboard">
    <!-- Top Banner -->
    <div class="admin-topbar">
      <div class="admin-topbar-left">
        <div class="admin-brand-badge">
          <div class="admin-icon-circle">
            <i data-lucide="shield" class="admin-brand-icon"></i>
          </div>
          <div>
            <div class="admin-brand-title">Admin Dashboard</div>
            <div class="admin-brand-sub">Manajemen User, Status API, &amp; Konfigurasi Sistem</div>
          </div>
        </div>
      </div>
      <div class="admin-topbar-right">
        <span class="admin-badge">
          <i data-lucide="crown"></i> Administrator
        </span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="admin-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['admin-tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        <i :data-lucide="tab.icon"></i>
        {{ tab.label }}
      </button>
    </div>

    <!-- ── TAB: STATISTIK ──────────────────────────────────────────────── -->
    <div v-if="activeTab === 'stats'" class="admin-content">
      <div v-if="statsLoading" class="admin-loading">
        <i data-lucide="loader-2" class="spin-anim"></i> Memuat statistik...
      </div>
      <div v-else class="stats-grid">
        <!-- User Stats -->
        <div class="stat-card stat-blue">
          <div class="stat-icon-wrap"><i data-lucide="users"></i></div>
          <div class="stat-info">
            <div class="stat-label">Total User</div>
            <div class="stat-value">{{ stats.users?.userCount || 0 }} <span class="stat-sub">/ {{ stats.users?.userLimit || 60 }}</span></div>
            <div class="stat-desc">{{ stats.users?.activeCount || 0 }} aktif</div>
          </div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-icon-wrap"><i data-lucide="file-text"></i></div>
          <div class="stat-info">
            <div class="stat-label">Dokumen RKA</div>
            <div class="stat-value">{{ stats.rka?.total || 0 }}</div>
            <div class="stat-desc">{{ stats.rka?.approved || 0 }} disetujui</div>
          </div>
        </div>
        <div class="stat-card stat-purple">
          <div class="stat-icon-wrap"><i data-lucide="database"></i></div>
          <div class="stat-info">
            <div class="stat-label">Database SSH</div>
            <div class="stat-value">{{ stats.ssh?.count || 0 }}</div>
            <div class="stat-desc">Standar Satuan Harga</div>
          </div>
        </div>
        <div class="stat-card stat-amber">
          <div class="stat-icon-wrap"><i data-lucide="coins"></i></div>
          <div class="stat-info">
            <div class="stat-label">Total Pagu RKA</div>
            <div class="stat-value">{{ formatPagu(stats.rka?.totalPagu) }}</div>
            <div class="stat-desc">Seluruh dokumen</div>
          </div>
        </div>
      </div>

      <!-- API Status Cards -->
      <div class="section-title"><i data-lucide="wifi"></i> Status Koneksi API</div>
      <div class="api-status-grid">
        <div :class="['api-status-card', stats.api?.geminiSet ? 'api-ok' : 'api-off']">
          <div class="api-status-icon">
            <i :data-lucide="stats.api?.geminiSet ? 'check-circle-2' : 'x-circle'"></i>
          </div>
          <div class="api-status-info">
            <div class="api-name">✨ Gemini API</div>
            <div class="api-use">Analisis RKA &amp; Ekstraksi SSH</div>
            <span :class="['api-pill', stats.api?.geminiSet ? 'pill-on' : 'pill-off']">
              {{ stats.api?.geminiSet ? 'Terkonfigurasi' : 'Belum Dikonfigurasi' }}
            </span>
          </div>
        </div>
        <div :class="['api-status-card', stats.api?.openaiSet ? 'api-ok' : 'api-off']">
          <div class="api-status-icon">
            <i :data-lucide="stats.api?.openaiSet ? 'check-circle-2' : 'x-circle'"></i>
          </div>
          <div class="api-status-info">
            <div class="api-name">🤖 OpenAI API</div>
            <div class="api-use">Chatbot Copilot &amp; Agentic AI</div>
            <span :class="['api-pill', stats.api?.openaiSet ? 'pill-on' : 'pill-off']">
              {{ stats.api?.openaiSet ? 'Terkonfigurasi' : 'Belum Dikonfigurasi' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── TAB: MANAJEMEN USER ─────────────────────────────────────────── -->
    <div v-if="activeTab === 'users'" class="admin-content">
      <!-- Header Row -->
      <div class="users-header-row">
        <div class="section-title" style="margin:0"><i data-lucide="users"></i> Daftar User</div>
        <div class="users-header-actions">
          <span class="user-count-badge">{{ users.filter(u => u.role === 'user').length }} / {{ userStats.userLimit || 60 }} User</span>
          <button class="btn-admin-primary" @click="openAddUser" :disabled="users.filter(u=>u.role==='user').length >= (userStats.userLimit || 60)">
            <i data-lucide="user-plus"></i> Tambah User
          </button>
        </div>
      </div>

      <!-- Search -->
      <div class="user-search-wrap">
        <i data-lucide="search"></i>
        <input v-model="searchUser" type="text" placeholder="Cari user berdasarkan nama atau username..." class="user-search-input" />
      </div>

      <!-- Table -->
      <div class="users-table-wrap">
        <table class="users-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Login Terakhir</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredUsers.length === 0">
              <td colspan="8" class="no-data">Tidak ada user ditemukan.</td>
            </tr>
            <tr v-for="(user, idx) in filteredUsers" :key="user.id" :class="{ 'row-admin': user.role === 'admin' }">
              <td>{{ idx + 1 }}</td>
              <td>
                <div class="user-name-cell">
                  <div :class="['user-avatar-sm', user.role === 'admin' ? 'avatar-admin' : 'avatar-user']">
                    {{ initials(user.name) }}
                  </div>
                  <div>
                    <div class="user-full-name">{{ user.name }}</div>
                    <div class="user-id-sm">{{ user.id }}</div>
                  </div>
                </div>
              </td>
              <td><code class="username-code">{{ user.username }}</code></td>
              <td>{{ user.email || '—' }}</td>
              <td>
                <span :class="['role-badge', user.role === 'admin' ? 'role-admin' : 'role-user']">
                  <i :data-lucide="user.role === 'admin' ? 'crown' : 'user'"></i>
                  {{ user.role === 'admin' ? 'Admin' : 'User' }}
                </span>
              </td>
              <td>
                <span :class="['status-badge', user.isActive ? 'status-active' : 'status-inactive']">
                  {{ user.isActive ? 'Aktif' : 'Nonaktif' }}
                </span>
              </td>
              <td class="last-login-cell">{{ formatDate(user.lastLogin) }}</td>
              <td>
                <div class="row-actions" v-if="user.role !== 'admin'">
                  <button class="btn-row-edit" @click="openEditUser(user)" title="Edit User">
                    <i data-lucide="pencil"></i>
                  </button>
                  <button
                    class="btn-row-toggle"
                    @click="toggleUserActive(user)"
                    :title="user.isActive ? 'Nonaktifkan' : 'Aktifkan'"
                  >
                    <i :data-lucide="user.isActive ? 'user-x' : 'user-check'"></i>
                  </button>
                  <button class="btn-row-delete" @click="confirmDeleteUser(user)" title="Hapus User">
                    <i data-lucide="trash-2"></i>
                  </button>
                </div>
                <span v-else class="row-protected">
                  <i data-lucide="shield" style="width:14px;height:14px;"></i>
                  Dilindungi
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── TAB: KONFIGURASI API ──────────────────────────────────────────── -->
    <div v-if="activeTab === 'api'" class="admin-content">
      <div class="api-config-info-banner">
        <i data-lucide="shield-check"></i>
        <div>
          <strong>Keamanan API Key</strong><br>
          API Key disimpan di file <code>.env</code> di server backend — <strong>tidak pernah dikirim ke browser pengguna</strong>. Hanya Admin yang dapat mengkonfigurasi API Key di sini.
        </div>
      </div>

      <div class="api-config-grid">
        <!-- Gemini Key -->
        <div class="api-config-card">
          <div class="api-config-header">
            <div class="api-config-icon gemini-gradient">✨</div>
            <div>
              <div class="api-config-name">Google Gemini API Key</div>
              <div class="api-config-desc">Digunakan untuk Analisis RKA &amp; Ekstraksi SSH</div>
            </div>
          </div>
          <div class="api-current-status">
            <span :class="['api-pill', apiConfig.gemini?.isSet ? 'pill-on' : 'pill-off']">
              <i :data-lucide="apiConfig.gemini?.isSet ? 'check' : 'x'"></i>
              {{ apiConfig.gemini?.isSet ? 'Terkonfigurasi' : 'Belum Dikonfigurasi' }}
            </span>
            <span v-if="apiConfig.gemini?.masked" class="api-masked">{{ apiConfig.gemini.masked }}</span>
          </div>
          <div class="api-input-section">
            <label>{{ apiConfig.gemini?.isSet ? 'Perbarui' : 'Masukkan' }} Gemini API Key:</label>
            <div class="api-key-input-wrap">
              <input
                v-model="geminiKeyInput"
                :type="showGeminiKey ? 'text' : 'password'"
                placeholder="AIzaSy... (Google Gemini API Key)"
                class="api-key-input"
              />
              <button type="button" @click="showGeminiKey = !showGeminiKey" class="key-toggle-btn">
                <i :data-lucide="showGeminiKey ? 'eye-off' : 'eye'"></i>
              </button>
            </div>
            <div class="api-key-hint">Dapatkan API Key gratis di <a href="https://aistudio.google.com" target="_blank">aistudio.google.com</a></div>
          </div>
          <button class="btn-save-key btn-gemini" @click="saveGeminiKey" :disabled="!geminiKeyInput || savingGemini">
            <i :data-lucide="savingGemini ? 'loader-2' : 'save'" :class="{ 'spin-anim': savingGemini }"></i>
            {{ savingGemini ? 'Menyimpan...' : 'Simpan Gemini Key' }}
          </button>
        </div>

        <!-- OpenAI Key -->
        <div class="api-config-card">
          <div class="api-config-header">
            <div class="api-config-icon openai-gradient">🤖</div>
            <div>
              <div class="api-config-name">OpenAI API Key</div>
              <div class="api-config-desc">Digunakan untuk Chatbot Copilot &amp; Agentic AI</div>
            </div>
          </div>
          <div class="api-current-status">
            <span :class="['api-pill', apiConfig.openai?.isSet ? 'pill-on' : 'pill-off']">
              <i :data-lucide="apiConfig.openai?.isSet ? 'check' : 'x'"></i>
              {{ apiConfig.openai?.isSet ? 'Terkonfigurasi' : 'Belum Dikonfigurasi' }}
            </span>
            <span v-if="apiConfig.openai?.masked" class="api-masked">{{ apiConfig.openai.masked }}</span>
          </div>
          <div class="api-input-section">
            <label>{{ apiConfig.openai?.isSet ? 'Perbarui' : 'Masukkan' }} OpenAI API Key:</label>
            <div class="api-key-input-wrap">
              <input
                v-model="openaiKeyInput"
                :type="showOpenaiKey ? 'text' : 'password'"
                placeholder="sk-proj-... (OpenAI API Key)"
                class="api-key-input"
              />
              <button type="button" @click="showOpenaiKey = !showOpenaiKey" class="key-toggle-btn">
                <i :data-lucide="showOpenaiKey ? 'eye-off' : 'eye'"></i>
              </button>
            </div>
            <div class="api-key-hint">Dapatkan API Key di <a href="https://platform.openai.com" target="_blank">platform.openai.com</a></div>
          </div>
          <button class="btn-save-key btn-openai" @click="saveOpenaiKey" :disabled="!openaiKeyInput || savingOpenai">
            <i :data-lucide="savingOpenai ? 'loader-2' : 'save'" :class="{ 'spin-anim': savingOpenai }"></i>
            {{ savingOpenai ? 'Menyimpan...' : 'Simpan OpenAI Key' }}
          </button>
        </div>
      </div>

      <!-- Success/Error message -->
      <div v-if="apiSaveMsg" :class="['api-save-msg', apiSaveMsgType]">
        <i :data-lucide="apiSaveMsgType === 'success' ? 'check-circle-2' : 'alert-circle'"></i>
        {{ apiSaveMsg }}
      </div>
    </div>

    <!-- ══ MODAL: Tambah / Edit User ══════════════════════════════════════ -->
    <div v-if="showUserModal" class="modal-overlay" @click.self="closeUserModal">
      <div class="modal-box">
        <div class="modal-header">
          <h3>{{ editingUser ? 'Edit User' : 'Tambah User Baru' }}</h3>
          <button class="modal-close-btn" @click="closeUserModal"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <div class="mform-group">
            <label>Nama Lengkap *</label>
            <input v-model="userForm.name" type="text" placeholder="Nama lengkap pengguna" class="mform-input" />
            <span v-if="formErrors.name" class="mfield-error">{{ formErrors.name }}</span>
          </div>
          <div class="mform-group">
            <label>Username *</label>
            <input v-model="userForm.username" type="text" placeholder="Username unik (tanpa spasi)" class="mform-input" :disabled="!!editingUser" />
            <span v-if="formErrors.username" class="mfield-error">{{ formErrors.username }}</span>
          </div>
          <div class="mform-group">
            <label>Email</label>
            <input v-model="userForm.email" type="email" placeholder="email@bapperida.go.id" class="mform-input" />
          </div>
          <div class="mform-group">
            <label>{{ editingUser ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *' }}</label>
            <div class="api-key-input-wrap">
              <input v-model="userForm.password" :type="showFormPw ? 'text' : 'password'" placeholder="Min. 6 karakter" class="mform-input" />
              <button type="button" @click="showFormPw = !showFormPw" class="key-toggle-btn">
                <i :data-lucide="showFormPw ? 'eye-off' : 'eye'"></i>
              </button>
            </div>
            <span v-if="formErrors.password" class="mfield-error">{{ formErrors.password }}</span>
          </div>
          <div class="mform-group">
            <label>Status Akun</label>
            <select v-model="userForm.isActive" class="mform-input">
              <option :value="true">Aktif</option>
              <option :value="false">Nonaktif</option>
            </select>
          </div>
          <div v-if="modalError" class="modal-error-alert">
            <i data-lucide="alert-circle"></i> {{ modalError }}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-modal-cancel" @click="closeUserModal">Batal</button>
          <button class="btn-modal-save" @click="saveUser" :disabled="savingUser">
            <i :data-lucide="savingUser ? 'loader-2' : 'save'" :class="{ 'spin-anim': savingUser }"></i>
            {{ savingUser ? 'Menyimpan...' : (editingUser ? 'Simpan Perubahan' : 'Buat User') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══ MODAL: Konfirmasi Hapus ════════════════════════════════════════ -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-box modal-sm">
        <div class="modal-header">
          <h3>Konfirmasi Hapus</h3>
          <button class="modal-close-btn" @click="showDeleteConfirm = false"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <p>Apakah Anda yakin ingin menghapus user <strong>{{ deleteTarget?.name }}</strong> (<code>{{ deleteTarget?.username }}</code>)?</p>
          <p class="delete-warning"><i data-lucide="alert-triangle"></i> Tindakan ini tidak dapat dibatalkan.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-modal-cancel" @click="showDeleteConfirm = false">Batal</button>
          <button class="btn-modal-delete" @click="executeDelete" :disabled="deletingUser">
            <i :data-lucide="deletingUser ? 'loader-2' : 'trash-2'" :class="{ 'spin-anim': deletingUser }"></i>
            {{ deletingUser ? 'Menghapus...' : 'Hapus User' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { apiFetch } from '@/utils/api';

// ── Data ──────────────────────────────────────────────────────────────────
const activeTab = ref('stats');
const tabs = [
  { id: 'stats', label: 'Statistik & Status', icon: 'bar-chart-3' },
  { id: 'users', label: 'Manajemen User', icon: 'users' },
  { id: 'api',   label: 'Konfigurasi API', icon: 'key-round' }
];

const stats = ref({});
const statsLoading = ref(true);
const users = ref([]);
const userStats = ref({});
const searchUser = ref('');

const apiConfig = ref({ gemini: {}, openai: {} });
const geminiKeyInput = ref('');
const openaiKeyInput = ref('');
const showGeminiKey = ref(false);
const showOpenaiKey = ref(false);
const savingGemini = ref(false);
const savingOpenai = ref(false);
const apiSaveMsg = ref('');
const apiSaveMsgType = ref('success');

const showUserModal = ref(false);
const editingUser = ref(null);
const userForm = ref({ name: '', username: '', email: '', password: '', isActive: true });
const formErrors = ref({});
const showFormPw = ref(false);
const savingUser = ref(false);
const modalError = ref('');

const showDeleteConfirm = ref(false);
const deleteTarget = ref(null);
const deletingUser = ref(false);

// ── Computed ──────────────────────────────────────────────────────────────
const filteredUsers = computed(() => {
  const q = searchUser.value.toLowerCase();
  return users.value.filter(u =>
    !q || u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────
function formatPagu(val) {
  if (!val) return 'Rp 0';
  if (val >= 1e12) return `Rp ${(val/1e12).toFixed(1)} T`;
  if (val >= 1e9) return `Rp ${(val/1e9).toFixed(1)} M`;
  if (val >= 1e6) return `Rp ${(val/1e6).toFixed(0)} Jt`;
  return `Rp ${Number(val).toLocaleString('id-ID')}`;
}

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function showApiMsg(msg, type = 'success') {
  apiSaveMsg.value = msg;
  apiSaveMsgType.value = type;
  setTimeout(() => { apiSaveMsg.value = ''; }, 4000);
}

// ── API Calls ─────────────────────────────────────────────────────────────
async function loadStats() {
  statsLoading.value = true;
  try {
    const res = await apiFetch('/api/admin/stats', { credentials: 'include' });
    if (res.ok) stats.value = await res.json();
  } finally {
    statsLoading.value = false;
  }
}

async function loadUsers() {
  try {
    const res = await apiFetch('/api/admin/users', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      users.value = data.users || [];
      userStats.value = data.stats || {};
    }
  } catch {}
}

async function loadApiConfig() {
  try {
    const res = await apiFetch('/api/admin/api-config', { credentials: 'include' });
    if (res.ok) apiConfig.value = await res.json();
  } catch {}
}

async function saveGeminiKey() {
  if (!geminiKeyInput.value.trim()) return;
  savingGemini.value = true;
  try {
    const res = await apiFetch('/api/admin/api-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ geminiKey: geminiKeyInput.value.trim() })
    });
    const data = await res.json();
    if (res.ok) {
      showApiMsg('Gemini API Key berhasil disimpan di server!');
      geminiKeyInput.value = '';
      await loadApiConfig();
      await loadStats();
    } else {
      showApiMsg(data.error || 'Gagal menyimpan.', 'error');
    }
  } finally {
    savingGemini.value = false;
    refreshIcons();
  }
}

async function saveOpenaiKey() {
  if (!openaiKeyInput.value.trim()) return;
  savingOpenai.value = true;
  try {
    const res = await apiFetch('/api/admin/api-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ openaiKey: openaiKeyInput.value.trim() })
    });
    const data = await res.json();
    if (res.ok) {
      showApiMsg('OpenAI API Key berhasil disimpan di server!');
      openaiKeyInput.value = '';
      await loadApiConfig();
      await loadStats();
    } else {
      showApiMsg(data.error || 'Gagal menyimpan.', 'error');
    }
  } finally {
    savingOpenai.value = false;
    refreshIcons();
  }
}

// ── User Management ───────────────────────────────────────────────────────
function openAddUser() {
  editingUser.value = null;
  userForm.value = { name: '', username: '', email: '', password: '', isActive: true };
  formErrors.value = {};
  modalError.value = '';
  showFormPw.value = false;
  showUserModal.value = true;
  nextTick(() => refreshIcons());
}

function openEditUser(user) {
  editingUser.value = user;
  userForm.value = { name: user.name, username: user.username, email: user.email || '', password: '', isActive: user.isActive };
  formErrors.value = {};
  modalError.value = '';
  showFormPw.value = false;
  showUserModal.value = true;
  nextTick(() => refreshIcons());
}

function closeUserModal() {
  showUserModal.value = false;
  editingUser.value = null;
}

function validateUserForm() {
  const errs = {};
  if (!userForm.value.name.trim()) errs.name = 'Nama lengkap wajib diisi.';
  if (!editingUser.value && !userForm.value.username.trim()) errs.username = 'Username wajib diisi.';
  if (!editingUser.value && !userForm.value.password) errs.password = 'Password wajib diisi.';
  if (userForm.value.password && userForm.value.password.length < 6) errs.password = 'Password minimal 6 karakter.';
  formErrors.value = errs;
  return Object.keys(errs).length === 0;
}

async function saveUser() {
  if (!validateUserForm()) return;
  savingUser.value = true;
  modalError.value = '';
  try {
    let res, data;
    if (editingUser.value) {
      const updates = { name: userForm.value.name, email: userForm.value.email, isActive: userForm.value.isActive };
      if (userForm.value.password) updates.password = userForm.value.password;
      res = await apiFetch(`/api/admin/users/${editingUser.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
    } else {
      res = await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...userForm.value, role: 'user' })
      });
    }
    data = await res.json();
    if (!res.ok) { modalError.value = data.error || 'Gagal menyimpan.'; return; }
    closeUserModal();
    await loadUsers();
    await loadStats();
  } finally {
    savingUser.value = false;
    refreshIcons();
  }
}

async function toggleUserActive(user) {
  try {
    await apiFetch(`/api/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isActive: !user.isActive })
    });
    await loadUsers();
  } catch {}
}

function confirmDeleteUser(user) {
  deleteTarget.value = user;
  showDeleteConfirm.value = true;
  nextTick(() => refreshIcons());
}

async function executeDelete() {
  if (!deleteTarget.value) return;
  deletingUser.value = true;
  try {
    await apiFetch(`/api/admin/users/${deleteTarget.value.id}`, { method: 'DELETE', credentials: 'include' });
    showDeleteConfirm.value = false;
    deleteTarget.value = null;
    await loadUsers();
    await loadStats();
  } finally {
    deletingUser.value = false;
    refreshIcons();
  }
}

function refreshIcons() {
  nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
}

watch(activeTab, () => refreshIcons());

onMounted(async () => {
  await Promise.all([loadStats(), loadUsers(), loadApiConfig()]);
  refreshIcons();
});
</script>

<style scoped>
.admin-dashboard {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 100%;
  background: var(--bg-primary);
}

/* === TOPBAR === */
.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 28px 16px;
  border-bottom: 1px solid var(--border-color);
}

.admin-topbar-left {
  display: flex;
  align-items: center;
}

.admin-brand-badge {
  display: flex;
  align-items: center;
  gap: 14px;
}

.admin-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #0E6B5E, #DC7A2A);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(14,107,94,0.35);
}

.admin-brand-icon {
  color: white;
  width: 20px;
  height: 20px;
}

.admin-brand-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}

.admin-brand-sub {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.admin-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: linear-gradient(135deg, #0E6B5E, #DC7A2A);
  color: white;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 700;
}

.admin-badge i { width: 13px; height: 13px; }

/* === TABS === */
.admin-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 28px 0;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.admin-tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: none;
  background: none;
  border-radius: 8px 8px 0 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.18s;
}

.admin-tab-btn i { width: 15px; height: 15px; }

.admin-tab-btn.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
  background: var(--bg-primary);
}

.admin-tab-btn:hover:not(.active) {
  color: var(--text-secondary);
  background: var(--bg-tertiary);
}

/* === CONTENT === */
.admin-content {
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.admin-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 40px 0;
  justify-content: center;
}

.spin-anim {
  animation: spinAnim 1s linear infinite;
}

@keyframes spinAnim {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* === STATS GRID === */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  gap: 14px;
  padding: 20px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  align-items: center;
  transition: transform 0.15s, box-shadow 0.15s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}

.stat-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon-wrap i { width: 22px; height: 22px; color: white; }

.stat-blue .stat-icon-wrap { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.stat-green .stat-icon-wrap { background: linear-gradient(135deg, #10b981, #059669); }
.stat-purple .stat-icon-wrap { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
.stat-amber .stat-icon-wrap { background: linear-gradient(135deg, #f59e0b, #d97706); }

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-sub {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-muted);
}

.stat-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* === SECTION TITLE === */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-title i { width: 15px; height: 15px; color: var(--primary-color); }

/* === API STATUS === */
.api-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.api-status-card {
  display: flex;
  gap: 14px;
  padding: 20px;
  border-radius: 14px;
  border: 2px solid;
  align-items: flex-start;
  transition: transform 0.15s;
}

.api-status-card:hover { transform: translateY(-2px); }

.api-ok {
  background: rgba(16, 185, 129, 0.07);
  border-color: rgba(16, 185, 129, 0.3);
}

.api-off {
  background: rgba(239, 68, 68, 0.07);
  border-color: rgba(239, 68, 68, 0.3);
}

.api-status-icon i {
  width: 28px;
  height: 28px;
}

.api-ok .api-status-icon i { color: #10b981; }
.api-off .api-status-icon i { color: #ef4444; }

.api-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.api-use {
  font-size: 0.77rem;
  color: var(--text-muted);
  margin: 3px 0 8px;
}

.api-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 700;
}

.api-pill i { width: 10px; height: 10px; }

.pill-on { background: rgba(16,185,129,0.15); color: #059669; }
.pill-off { background: rgba(239,68,68,0.15); color: #dc2626; }

/* === USERS TABLE === */
.users-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.users-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-count-badge {
  padding: 5px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.btn-admin-primary {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 18px;
  background: linear-gradient(135deg, #0E6B5E, #DC7A2A);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.83rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
  box-shadow: 0 4px 14px rgba(14,107,94,0.3);
}

.btn-admin-primary i { width: 15px; height: 15px; }
.btn-admin-primary:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.btn-admin-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.user-search-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.user-search-wrap i { width: 16px; height: 16px; color: var(--text-muted); flex-shrink: 0; }

.user-search-input {
  flex: 1;
  border: none;
  background: none;
  font-size: 0.88rem;
  color: var(--text-primary);
  outline: none;
}

.users-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.83rem;
}

.users-table thead tr {
  background: var(--bg-secondary);
}

.users-table th {
  padding: 11px 14px;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  white-space: nowrap;
}

.users-table td {
  padding: 11px 14px;
  border-top: 1px solid var(--border-color);
  color: var(--text-secondary);
  vertical-align: middle;
}

.users-table .row-admin {
  background: rgba(14,107,94,0.04);
}

.users-table tr:hover:not(:first-child) {
  background: var(--bg-hover, rgba(0,0,0,0.02));
}

.no-data {
  text-align: center;
  padding: 40px !important;
  color: var(--text-muted);
}

.user-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar-sm {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 800;
  flex-shrink: 0;
}

.avatar-admin { background: linear-gradient(135deg, #0E6B5E, #DC7A2A); color: white; }
.avatar-user { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color); }

.user-full-name { font-weight: 600; color: var(--text-primary); font-size: 0.85rem; }
.user-id-sm { font-size: 0.69rem; color: var(--text-muted); }

.username-code {
  font-family: monospace;
  font-size: 0.8rem;
  background: var(--bg-tertiary);
  padding: 2px 7px;
  border-radius: 5px;
  color: var(--text-secondary);
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 700;
}
.role-badge i { width: 10px; height: 10px; }

.role-admin { background: rgba(14,107,94,0.15); color: #0E6B5E; }
.role-user { background: var(--bg-tertiary); color: var(--text-secondary); }

.status-badge {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 700;
}
.status-active { background: rgba(16,185,129,0.12); color: #059669; }
.status-inactive { background: rgba(239,68,68,0.12); color: #dc2626; }

.last-login-cell { font-size: 0.78rem; }

.row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-row-edit, .btn-row-toggle, .btn-row-delete {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.btn-row-edit i, .btn-row-toggle i, .btn-row-delete i { width: 13px; height: 13px; }

.btn-row-edit:hover { background: rgba(14,107,94,0.1); border-color: #0E6B5E; color: #0E6B5E; }
.btn-row-toggle:hover { background: rgba(245,158,11,0.1); border-color: #f59e0b; color: #f59e0b; }
.btn-row-delete:hover { background: rgba(239,68,68,0.1); border-color: #ef4444; color: #ef4444; }

.row-protected {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: var(--text-muted);
  padding: 4px 8px;
  background: rgba(14,107,94,0.08);
  border-radius: 6px;
}

/* === API CONFIG === */
.api-config-info-banner {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 16px 20px;
  background: rgba(14,107,94,0.08);
  border: 1px solid rgba(14,107,94,0.2);
  border-radius: 12px;
  font-size: 0.83rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.api-config-info-banner i { width: 20px; height: 20px; color: #0E6B5E; flex-shrink: 0; margin-top: 2px; }
.api-config-info-banner code { background: var(--bg-tertiary); padding: 1px 5px; border-radius: 4px; font-size: 0.8rem; }

.api-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.api-config-card {
  padding: 24px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.api-config-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.api-config-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}

.gemini-gradient { background: linear-gradient(135deg, #4285f4, #34a853); }
.openai-gradient { background: linear-gradient(135deg, #00a67e, #007a5e); }

.api-config-name { font-weight: 700; font-size: 0.95rem; color: var(--text-primary); }
.api-config-desc { font-size: 0.77rem; color: var(--text-muted); margin-top: 2px; }

.api-current-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-masked {
  font-family: monospace;
  font-size: 0.8rem;
  background: var(--bg-tertiary);
  padding: 3px 8px;
  border-radius: 5px;
  color: var(--text-secondary);
}

.api-input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.api-input-section label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.api-key-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.api-key-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  border: 1px solid var(--border-color-strong, var(--border-color));
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--text-primary);
  background: var(--bg-secondary);
  outline: none;
  box-sizing: border-box;
  font-family: monospace;
}

.api-key-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(14,107,94,0.15);
}

.key-toggle-btn {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
}

.key-toggle-btn i { width: 15px; height: 15px; }

.api-key-hint {
  font-size: 0.73rem;
  color: var(--text-muted);
}

.api-key-hint a {
  color: var(--primary-color);
  text-decoration: none;
}

.btn-save-key {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px;
  border: none;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 700;
  color: white;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
}

.btn-save-key:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.btn-save-key:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-save-key i { width: 16px; height: 16px; }

.btn-gemini { background: linear-gradient(135deg, #4285f4, #34a853); }
.btn-openai { background: linear-gradient(135deg, #00a67e, #007a5e); }

.api-save-msg {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
}

.api-save-msg i { width: 16px; height: 16px; }

.api-save-msg.success {
  background: rgba(16,185,129,0.1);
  border: 1px solid rgba(16,185,129,0.3);
  color: #059669;
}

.api-save-msg.error {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  color: #dc2626;
}

/* === MODAL === */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-box {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  width: 100%;
  max-width: 460px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.3);
  overflow: hidden;
}

.modal-sm { max-width: 380px; }

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.modal-close-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.modal-close-btn i { width: 14px; height: 14px; }

.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-body p { color: var(--text-secondary); font-size: 0.88rem; margin: 0; }

.mform-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mform-group label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.mform-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.88rem;
  color: var(--text-primary);
  background: var(--bg-secondary);
  outline: none;
  box-sizing: border-box;
}

.mform-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(14,107,94,0.12);
}

.mfield-error { font-size: 0.73rem; color: #ef4444; }

.modal-error-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.82rem;
}

.modal-error-alert i { width: 14px; height: 14px; }

.delete-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem !important;
  color: #f59e0b !important;
  margin-top: 4px !important;
}

.delete-warning i { width: 14px; height: 14px; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.btn-modal-cancel {
  padding: 8px 20px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-modal-cancel:hover { background: var(--bg-hover, #f1f5f9); }

.btn-modal-save {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 20px;
  background: linear-gradient(135deg, #0E6B5E, #DC7A2A);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
  box-shadow: 0 3px 10px rgba(14,107,94,0.3);
}

.btn-modal-save:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-modal-save i { width: 14px; height: 14px; }

.btn-modal-delete {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 20px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-modal-delete:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-modal-delete i { width: 14px; height: 14px; }
</style>
