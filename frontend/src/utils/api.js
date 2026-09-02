// src/utils/api.js
// URL backend:
// - Backend sekarang berjalan terpisah di Render (bukan /api Vercel serverless).
// - Set VITE_API_BASE_URL di Vercel (Project Settings > Environment Variables),
//   contoh: https://nama-service-kamu.onrender.com
// - Kalau kosong (misal saat dev lokal dengan backend di localhost:3000), fallback
//   ke '' (relative), sesuaikan .env.local kalau perlu.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Default timeout untuk request biasa
const API_TIMEOUT_MS = 30000;
// AI/PDF endpoint membutuhkan lebih lama (Gemini fallback chain + parsing)
const AI_ENDPOINT_TIMEOUT_MS = 180000; // 3 menit
const AI_ENDPOINT_PATTERNS = ['/api/v1/evaluate', '/api/v1/extract-ssh', '/api/v1/agentic-ai/'];

export function apiFetch(path, options = {}) {
  const isAiEndpoint = AI_ENDPOINT_PATTERNS.some(p => path.startsWith(p));
  const timeoutMs = options.timeoutMs ?? (isAiEndpoint ? AI_ENDPOINT_TIMEOUT_MS : API_TIMEOUT_MS);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const { timeoutMs: _omit, credentials, ...fetchOptions } = options;

  // Path sudah dimulai dengan /api/... — digabung dengan base URL backend Render
  return fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    credentials: credentials ?? 'include', // wajib 'include' untuk cookie lintas domain (Vercel <-> Render)
    signal: controller.signal
  }).finally(() => clearTimeout(timeoutId));
}

// ── Deteksi "server sedang bangun" (Render free tier sleep) ────────────────
// Dipanggil sekali saat aplikasi pertama kali dibuka (lihat App.vue).
// Melakukan polling ke /api/health sampai backend benar-benar siap, sambil
// melaporkan progres lewat callback supaya UI bisa menampilkan pesan yang
// sesuai tanpa membuat pengguna mengira aplikasinya rusak/nge-hang.
//
// onStatus dipanggil dengan salah satu:
//   { phase: 'checking' }                 -> pengecekan awal (biasanya < 1 detik kalau server sudah aktif)
//   { phase: 'waking', elapsedMs }        -> lebih dari 3 detik, kemungkinan server baru bangun dari sleep
//   { phase: 'ready' }                    -> server sudah merespons normal
//   { phase: 'error', message }           -> gagal total setelah semua percobaan (jaringan mati / backend down)
export async function waitForBackendAwake(onStatus = () => {}) {
  const HEALTH_PATH = '/api/health';
  const MAX_WAIT_MS = 70000; // Render free tier butuh ~30-60 detik untuk bangun
  const POLL_INTERVAL_MS = 3000;
  const WAKING_THRESHOLD_MS = 3000; // di atas ini dianggap sedang "bangun", bukan sekadar latensi normal

  const startedAt = Date.now();
  onStatus({ phase: 'checking' });

  while (Date.now() - startedAt < MAX_WAIT_MS) {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= WAKING_THRESHOLD_MS) {
      onStatus({ phase: 'waking', elapsedMs });
    }
    try {
      const res = await fetch(`${API_BASE_URL}${HEALTH_PATH}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok || res.status === 503) {
        // 200 = server & DB siap. 503 = server hidup tapi DB belum konek —
        // tetap dianggap "server sudah bangun", biarkan halaman lanjut jalan.
        onStatus({ phase: 'ready' });
        return true;
      }
    } catch (err) {
      // fetch gagal (server masih tidur/starting) — lanjut polling
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  onStatus({ phase: 'error', message: 'Server tidak merespons setelah beberapa saat. Silakan coba muat ulang halaman.' });
  return false;
}
