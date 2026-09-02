<template>
  <div class="login-root">
    <!-- Background animated shapes -->
    <div class="login-bg">
      <div class="bg-shape shape-1"></div>
      <div class="bg-shape shape-2"></div>
      <div class="bg-shape shape-3"></div>
    </div>

    <div class="login-container">
      <!-- Logo & Brand -->
      <div class="login-brand">
        <div class="login-logo-wrap">
          <img :src="logoBapperida" alt="Logo BAPPERIDA" class="login-logo" />
        </div>
        <div class="login-brand-text">
          <h1 class="login-title">RKA-ANALYZER-AI</h1>
          <p class="login-subtitle">Sistem Analisis Anggaran Berbasis AI<br><em>Bapperida Kabupaten Cirebon</em></p>
        </div>
      </div>

      <!-- Login Card -->
      <div class="login-card">
        <div class="login-card-header">
          <div class="login-icon-wrap">
            <i data-lucide="shield-check" class="login-icon"></i>
          </div>
          <h2>Masuk ke Sistem</h2>
          <p>Gunakan akun yang diberikan Administrator</p>
        </div>

        <form class="login-form" @submit.prevent="handleLogin">
          <!-- Username -->
          <div class="form-group" :class="{ 'has-error': errors.username }">
            <label for="login-username">
              <i data-lucide="user"></i>
              Username
            </label>
            <input
              id="login-username"
              v-model="form.username"
              type="text"
              placeholder="Masukkan username Anda"
              autocomplete="username"
              :disabled="loading"
              @input="errors.username = ''"
            />
            <span v-if="errors.username" class="field-error">{{ errors.username }}</span>
          </div>

          <!-- Password -->
          <div class="form-group" :class="{ 'has-error': errors.password }">
            <label for="login-password">
              <i data-lucide="lock"></i>
              Password
            </label>
            <div class="input-pw-wrap">
              <input
                id="login-password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Masukkan password Anda"
                autocomplete="current-password"
                :disabled="loading"
                @input="errors.password = ''"
              />
              <button type="button" class="pw-toggle" @click="showPassword = !showPassword" tabindex="-1">
                <i :data-lucide="showPassword ? 'eye-off' : 'eye'"></i>
              </button>
            </div>
            <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
          </div>

          <!-- Error Alert -->
          <div v-if="loginError" class="login-error-alert">
            <i data-lucide="alert-circle"></i>
            <span>{{ loginError }}</span>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="login-btn"
            :disabled="loading"
          >
            <span v-if="loading" class="btn-spinner">
              <i data-lucide="loader-2" class="spin-icon"></i>
              Memverifikasi...
            </span>
            <span v-else>
              <i data-lucide="log-in"></i>
              Masuk
            </span>
          </button>
        </form>

        <!-- Footer Info -->
        <div class="login-card-footer">
          <div class="security-badge">
            <i data-lucide="lock" style="width:12px;height:12px;"></i>
          </div>
        </div>
      </div>

      <!-- Bottom credit -->
      <p class="login-credit">Tim IT Bapperida &copy; {{ year }} — Bapperida Kab. Cirebon</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import logoBapperida from '@/assets/logo-bapperida.png';
import { apiFetch } from '@/utils/api';

const emit = defineEmits(['login-success']);

const form = ref({ username: '', password: '' });
const errors = ref({ username: '', password: '' });
const showPassword = ref(false);
const loading = ref(false);
const loginError = ref('');
const year = new Date().getFullYear();

function validate() {
  let ok = true;
  errors.value.username = '';
  errors.value.password = '';
  if (!form.value.username.trim()) {
    errors.value.username = 'Username wajib diisi.';
    ok = false;
  }
  if (!form.value.password) {
    errors.value.password = 'Password wajib diisi.';
    ok = false;
  }
  return ok;
}

async function handleLogin() {
  if (!validate()) return;
  loading.value = true;
  loginError.value = '';
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: form.value.username.trim(), password: form.value.password })
    });
    const data = await res.json();
    if (!res.ok) {
      loginError.value = data.error || 'Login gagal. Periksa username dan password.';
      return;
    }
    // Login sukses — emit event dengan data user
    emit('login-success', data.user);
  } catch (err) {
    loginError.value = err.name === 'AbortError'
      ? 'Server backend tidak merespons. Tunggu beberapa saat lalu coba lagi.'
      : 'Tidak dapat terhubung ke server. Pastikan backend sudah berjalan.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  nextTick(() => {
    if (window.lucide) window.lucide.createIcons();
  });
});
</script>

<style scoped>
/* === ROOT & BACKGROUND === */
.login-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c1445 100%);
  position: relative;
  overflow: hidden;
  font-family: 'Outfit', 'Inter', sans-serif;
}

.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.15;
  animation: floatShape 8s ease-in-out infinite;
}

.shape-1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, #0E6B5E, #3FA593);
  top: -150px; left: -100px;
  animation-delay: 0s;
}
.shape-2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, #0E6B5E, #2E9587);
  bottom: -100px; right: -80px;
  animation-delay: -3s;
}
.shape-3 {
  width: 300px; height: 300px;
  background: radial-gradient(circle, #DC7A2A, #F0A860);
  top: 40%; left: 50%;
  animation-delay: -5s;
}

@keyframes floatShape {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20px, -30px) scale(1.05); }
}

/* === CONTAINER === */
.login-container {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  width: 100%;
  max-width: 420px;
  padding: 24px;
}

/* === BRAND HEADER === */
.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.login-logo-wrap {
  width: 72px; height: 72px;
  background: rgba(255,255,255,0.12);
  border: 2px solid rgba(255,255,255,0.2);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(14,107,94,0.3);
}

.login-logo {
  width: 52px; height: 52px;
  object-fit: contain;
}

.login-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.5px;
  margin: 0;
}

.login-subtitle {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.65);
  line-height: 1.5;
  margin: 0;
}

/* === CARD === */
.login-card {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  padding: 36px 32px;
  backdrop-filter: blur(20px);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1);
}

.login-card-header {
  text-align: center;
  margin-bottom: 28px;
}

.login-icon-wrap {
  width: 52px; height: 52px;
  background: linear-gradient(135deg, #0E6B5E, #DC7A2A);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 20px rgba(14,107,94,0.4);
}

.login-icon {
  color: white;
  width: 24px;
  height: 24px;
}

.login-card-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 6px;
}

.login-card-header p {
  font-size: 0.82rem;
  color: rgba(255,255,255,0.5);
  margin: 0;
}

/* === FORM === */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(255,255,255,0.8);
  letter-spacing: 0.3px;
}

.form-group label i {
  width: 13px;
  height: 13px;
  color: #3FA593;
}

.form-group input {
  width: 100%;
  padding: 12px 14px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 10px;
  font-size: 0.92rem;
  color: #ffffff;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  outline: none;
}

.form-group input::placeholder {
  color: rgba(255,255,255,0.3);
}

.form-group input:focus {
  border-color: #0E6B5E;
  box-shadow: 0 0 0 3px rgba(14,107,94,0.25);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group.has-error input {
  border-color: #f87171;
}

.input-pw-wrap {
  position: relative;
}

.input-pw-wrap input {
  padding-right: 44px;
}

.pw-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255,255,255,0.4);
  padding: 2px;
  display: flex;
  align-items: center;
}

.pw-toggle i {
  width: 16px;
  height: 16px;
}

.pw-toggle:hover { color: rgba(255,255,255,0.8); }

.field-error {
  font-size: 0.75rem;
  color: #f87171;
}

/* === ERROR ALERT === */
.login-error-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 10px;
  color: #fca5a5;
  font-size: 0.82rem;
  animation: shakeAlert 0.4s ease;
}

.login-error-alert i {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

@keyframes shakeAlert {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}

/* === LOGIN BUTTON === */
.login-btn {
  width: 100%;
  padding: 13px;
  background: linear-gradient(135deg, #0E6B5E, #DC7A2A);
  border: none;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 700;
  color: white;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
  box-shadow: 0 4px 20px rgba(14,107,94,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(14,107,94,0.5);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-btn i {
  width: 18px;
  height: 18px;
}

.btn-spinner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spin-icon {
  animation: spinIcon 1s linear infinite;
}

@keyframes spinIcon {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* === CARD FOOTER === */
.login-card-footer {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid rgba(255,255,255,0.08);
  text-align: center;
}

.security-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.4);
}

/* === CREDIT === */
.login-credit {
  font-size: 0.73rem;
  color: rgba(255,255,255,0.3);
  text-align: center;
  margin: 0;
}
</style>
