<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo-container">
        <img
          :src="logoBapperida"
          alt="Logo BAPPERIDA"
          class="logo-image"
        />
      </div>
      <div class="logo-text">
        <span class="logo-title">RKA-ANALYZER-AI</span>
        <span class="logo-subtitle">oleh Tim IT Bapperida</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <!-- Admin Dashboard (hanya terlihat oleh Admin) -->
      <a
        v-if="props.currentUser?.role === 'admin'"
        href="#"
        :class="['nav-item nav-item-admin', { active: currentTab === 'admin-dashboard' }]"
        @click.prevent="currentTab = 'admin-dashboard'"
      >
        <i data-lucide="shield"></i>
        <span>Admin Dashboard</span>
        <span class="admin-nav-badge">Admin</span>
      </a>

      <a href="#"
         :class="['nav-item', { active: currentTab === 'dashboard' }]"
         @click.prevent="currentTab = 'dashboard'">
        <i data-lucide="upload-cloud"></i>
        <span>Unggah Berkas RKA</span>
      </a>
      <a href="#"
         :class="['nav-item', { active: currentTab === 'analyzer' }]"
         @click.prevent="currentTab = 'analyzer'">
        <i data-lucide="cpu"></i>
        <span>AI RKA dengan Analisis SROI</span>
      </a>
      <a href="#"
         :class="['nav-item nav-item-agent', { active: currentTab === 'agentic-ai' }]"
         @click.prevent="currentTab = 'agentic-ai'">
        <i data-lucide="bot"></i>
        <span style="flex: 1;">Agentic AI RKA</span>
        <span class="agent-badge-pulse">AI</span>
      </a>
      <a href="#"
         :class="['nav-item', { active: currentTab === 'ssh' }]"
         @click.prevent="currentTab = 'ssh'">
        <i data-lucide="file-check"></i>
        <span>Pengaturan SSH</span>
      </a>
      <a href="#"
         :class="['nav-item', { active: currentTab === 'history' }]"
         @click.prevent="currentTab = 'history'">
        <i data-lucide="folder-archive"></i>
        <span>Arsip Dokumen RKA</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <!-- API Status Indicator (tampilkan status tanpa key) -->
      <div class="sidebar-section-label"><i data-lucide="wifi" style="width:11px;height:11px;"></i> Status API</div>
      <div class="api-status-row">
        <div class="api-dots-row">
          <span :class="['api-status-dot-mini', apiStatus.geminiKeySet ? 'dot-on' : 'dot-off']"></span>
          <span class="api-dot-label">Gemini{{ apiStatus.geminiKeySet ? ' ✓' : ' ✗' }}</span>
          <span :class="['api-status-dot-mini', apiStatus.openaiKeySet ? 'dot-on' : 'dot-off']" style="margin-left:8px;"></span>
          <span class="api-dot-label">OpenAI{{ apiStatus.openaiKeySet ? ' ✓' : ' ✗' }}</span>
        </div>
        <p v-if="!apiStatus.geminiKeySet || !apiStatus.openaiKeySet" class="api-not-config-msg">
          <i data-lucide="info" style="width:10px;height:10px;"></i>
          {{ props.currentUser?.role === 'admin' ? 'Konfigurasikan di Admin Dashboard → Konfigurasi API' : 'Hubungi Administrator untuk konfigurasi API.' }}
        </p>
      </div>

      <!-- User Profile & Logout -->
      <div class="user-profile">
        <div :class="['avatar', props.currentUser?.role === 'admin' ? 'avatar-admin-style' : '']">
          {{ userInitials }}
        </div>
        <div class="user-info">
          <span class="user-name">{{ props.currentUser?.name || 'Pengguna' }}</span>
          <span class="user-role">
            <span :class="['role-tag', props.currentUser?.role === 'admin' ? 'role-tag-admin' : 'role-tag-user']">
              {{ props.currentUser?.role === 'admin' ? '🛡️ Admin' : '👤 User' }}
            </span>
          </span>
        </div>
        <button class="logout-btn" @click="handleLogout" title="Logout">
          <i data-lucide="log-out"></i>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { onMounted, watch, ref, computed } from 'vue';
import { useAnalysis } from '../composables/useAnalysis';
import logoBapperida from '@/assets/logo-bapperida.png';
import { apiFetch } from '@/utils/api';

const props = defineProps({
  currentUser: { type: Object, default: null }
});

const emit = defineEmits(['logout']);

const { currentTab } = useAnalysis();

// API status (hanya status, bukan key asli)
const apiStatus = ref({ geminiKeySet: false, openaiKeySet: false });

async function loadApiStatus() {
  try {
    const res = await apiFetch('/api/auth/api-status', { credentials: 'include' });
    if (res.ok) apiStatus.value = await res.json();
  } catch {}
}

const userInitials = computed(() => {
  const name = props.currentUser?.name || props.currentUser?.username || 'U';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
});

function handleLogout() {
  emit('logout');
}

onMounted(() => {
  loadApiStatus();
  if (window.lucide) window.lucide.createIcons();
});

watch([currentTab], () => {
  if (window.lucide) {
    setTimeout(() => window.lucide.createIcons(), 50);
  }
});
</script>

<style scoped>
.logo-container {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.logo-image {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

/* Admin nav item */
.nav-item-admin {
  position: relative;
  background: linear-gradient(135deg, rgba(14,107,94,0.08), rgba(59,130,246,0.08)) !important;
  border: 1px solid rgba(14,107,94,0.2) !important;
  border-radius: 10px !important;
  margin-bottom: 4px;
}

.admin-nav-badge {
  background: linear-gradient(135deg, #0E6B5E, #DC7A2A);
  color: #ffffff;
  font-size: 9px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 10px;
  letter-spacing: 0.05em;
}

/* Nav Item Agentic AI Specific */
.nav-item-agent {
  position: relative;
}

.agent-badge-pulse {
  background: var(--gradient-brand);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 10px;
  letter-spacing: 0.05em;
  box-shadow: 0 2px 6px var(--primary-glow);
  animation: pulseBadge 2.5s infinite;
}

@keyframes pulseBadge {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.06); opacity: 0.9; }
}

/* === API Status === */
.api-status-row {
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  margin: 4px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.api-dots-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.api-status-dot-mini {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-on { background: #10b981; }
.dot-off { background: #ef4444; }

.api-dot-label {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 600;
}

.api-not-config-msg {
  font-size: 9.5px;
  color: var(--text-muted);
  line-height: 1.4;
  margin: 0;
  display: flex;
  gap: 4px;
  align-items: flex-start;
}

/* === User Profile === */
.user-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid var(--border-color);
  margin-top: 4px;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.avatar-admin-style {
  background: linear-gradient(135deg, #0E6B5E, #DC7A2A) !important;
  color: white !important;
  border: none !important;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}

.role-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 9.5px;
  font-weight: 700;
}

.role-tag-admin { background: rgba(14,107,94,0.12); color: #0E6B5E; }
.role-tag-user { background: var(--bg-tertiary); color: var(--text-muted); }

.logout-btn {
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
  flex-shrink: 0;
  transition: all 0.15s;
}

.logout-btn i { width: 14px; height: 14px; }

.logout-btn:hover {
  background: rgba(239,68,68,0.1);
  border-color: #ef4444;
  color: #ef4444;
}
</style>
