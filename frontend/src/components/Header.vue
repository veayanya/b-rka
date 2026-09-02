<template>
  <header class="top-header">
    <div class="header-title-container">
      <button class="sidebar-toggle-btn" id="sidebar-toggle" aria-label="Toggle Sidebar" @click="toggleSidebar">
        <i data-lucide="menu"></i>
      </button>
      <div>
        <div class="header-breadcrumb" id="current-breadcrumb">
          BAPPER CLUB / {{ sectionLabel }}
        </div>
        <h1 class="header-title" id="current-page-title">{{ pageTitle }}</h1>
      </div>
    </div>

    <div class="header-actions">
      <!-- Current Date -->
      <span class="header-date">{{ today }}</span>

      <!-- Theme Toggle -->
      <button class="icon-button" id="theme-toggle" title="Ubah Tema" aria-label="Ubah Tema" @click="toggleTheme">
        <i :data-lucide="theme === 'light' ? 'sun' : 'moon'"></i>
      </button>

      <!-- Notifications -->
      <button class="icon-button" id="notifications-btn" title="Notifikasi" aria-label="Notifikasi">
        <i data-lucide="bell"></i>
        <span v-if="notificationsList && notificationsList.length > 0" class="notification-badge" id="notif-badge-count">
          {{ notificationsList.length }}
        </span>
      </button>

      <!-- Profile dengan role badge -->
      <div class="header-profile" @click="showProfileMenu = !showProfileMenu" style="position:relative;cursor:pointer;">
        <div :class="['header-profile-avatar', props.currentUser?.role === 'admin' ? 'avatar-admin' : '']">
          {{ userInitials }}
        </div>
        <div class="header-user-info">
          <span class="header-user-name">{{ props.currentUser?.name || 'Pengguna' }}</span>
          <span :class="['header-role-badge', props.currentUser?.role === 'admin' ? 'badge-admin' : 'badge-user']">
            {{ props.currentUser?.role === 'admin' ? '🛡️ Admin' : '👤 User' }}
          </span>
        </div>

        <!-- Dropdown -->
        <div v-if="showProfileMenu" class="profile-dropdown" @click.stop>
          <div class="profile-dropdown-info">
            <div class="pd-name">{{ props.currentUser?.name }}</div>
            <div class="pd-username">@{{ props.currentUser?.username }}</div>
          </div>
          <div class="profile-dropdown-divider"></div>
          <button class="pd-logout-btn" @click="handleLogout">
            <i data-lucide="log-out"></i>
            Logout
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onMounted, watch, ref } from 'vue';
import { useAnalysis } from '../composables/useAnalysis';

const props = defineProps({
  currentUser: { type: Object, default: null }
});

const emit = defineEmits(['logout']);

const { currentTab, theme, notificationsList } = useAnalysis();

const showProfileMenu = ref(false);

const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const pageMeta = {
  'admin-dashboard': { title: 'Admin Dashboard', section: 'Admin / Manajemen Sistem' },
  dashboard:         { title: 'Unggah RKA',        section: 'Unggah RKA' },
  analyzer:          { title: 'Analisis RKA',       section: 'Analisis RKA / Hasil Analisis' },
  'agentic-ai':      { title: 'Agentic AI RKA',     section: 'Agentic AI RKA' },
  ssh:               { title: 'Pengaturan SSH/SSH', section: 'Pengaturan / SSH & SSH' },
  history:           { title: 'Arsip Dokumen RKA',  section: 'Arsip Dokumen RKA' },
  config:            { title: 'Pengaturan',         section: 'Pengaturan' },
};

const pageTitle = computed(() => pageMeta[currentTab.value]?.title || 'Dashboard');
const sectionLabel = computed(() => pageMeta[currentTab.value]?.section || 'Dashboard');

const userInitials = computed(() => {
  const name = props.currentUser?.name || props.currentUser?.username || 'U';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
});

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light';
  if (window.lucide) setTimeout(() => window.lucide.createIcons(), 50);
};

const toggleSidebar = () => {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('open');
};

function handleLogout() {
  showProfileMenu.value = false;
  emit('logout');
}

// Tutup dropdown jika klik di luar
function onClickOutside(e) {
  if (!e.target.closest('.header-profile')) {
    showProfileMenu.value = false;
  }
}

onMounted(() => {
  if (window.lucide) window.lucide.createIcons();
  document.addEventListener('click', onClickOutside);
});

watch(theme, () => {
  if (window.lucide) setTimeout(() => window.lucide.createIcons(), 50);
});
</script>

<style scoped>
/* === Profile Avatar === */
.header-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.header-profile:hover {
  background: var(--bg-tertiary);
}

.header-profile-avatar {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.avatar-admin {
  background: linear-gradient(135deg, #0E6B5E, #DC7A2A) !important;
  color: white !important;
  border: none !important;
}

.header-user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
}

.header-user-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-role-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 8px;
}

.badge-admin { background: rgba(14,107,94,0.12); color: #0E6B5E; }
.badge-user  { background: var(--bg-tertiary); color: var(--text-muted); }

/* === Profile Dropdown === */
.profile-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  z-index: 1000;
  overflow: hidden;
  animation: dropdownFade 0.15s ease;
}

@keyframes dropdownFade {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.profile-dropdown-info {
  padding: 14px 16px;
}

.pd-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-primary);
}

.pd-username {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.profile-dropdown-divider {
  height: 1px;
  background: var(--border-color);
}

.pd-logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 600;
  color: #ef4444;
  transition: background 0.15s;
  text-align: left;
}

.pd-logout-btn i { width: 15px; height: 15px; }

.pd-logout-btn:hover {
  background: rgba(239,68,68,0.08);
}
</style>
