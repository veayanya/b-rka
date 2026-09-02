import { reactive, toRefs, watch, nextTick, computed, ref } from 'vue';
import html2pdf from 'html2pdf.js';
import { apiFetch } from '@/utils/api';

const defaultRkis = [];

// Auth state — single source of truth untuk sesi user
const isLoggedIn = ref(false);
const currentUser = ref(null);

// Cek sesi yang sudah ada (cookie httpOnly) saat pertama load
async function checkSession() {
  try {
    const res = await apiFetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      isLoggedIn.value = true;
      currentUser.value = data.user;
      // Auto-redirect ke tab sesuai role jika belum di tab yang tepat
      if (data.user.role === 'admin' && state.currentTab === 'dashboard') {
        state.currentTab = 'admin-dashboard';
      }
      // Load data setelah session confirmed
      const rkis = await fetchRkis();
      state.rkis = rkis;
    } else {
      isLoggedIn.value = false;
      currentUser.value = null;
    }
  } catch {
    isLoggedIn.value = false;
    currentUser.value = null;
  }
}

// Logout — hapus cookie sesi di server
async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {}
  isLoggedIn.value = false;
  currentUser.value = null;
  state.rkis = [];
  state.activeAnalysis = null;
  state.currentTab = 'dashboard';
}

// Instead of localStorage, we load from backend.
async function fetchRkis() {
  try {
    const res = await apiFetch('/api/v1/rkis', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return data;
      }
    }
  } catch (error) {
    console.error("Gagal mengambil data dari server:", error);
  }
  return defaultRkis;
}

const state = reactive({
  currentTab: 'dashboard',
  currentRole: 'asn',
  
  // Dashboard Analytics
  dashboardStats: computed(() => {
    const rkis = state.rkis || [];
    const approved = rkis.filter(r => r.status === 'Approved');
    
    const totalPagu = approved.reduce((sum, r) => sum + (r.pagu || 0), 0);
    const totalManfaat = approved.reduce((sum, r) => sum + (r.outcome || 0), 0);
    const rataRataSroi = approved.length ? (approved.reduce((sum, r) => sum + (r.sroi || 0), 0) / approved.length) : 0;
    
    // Group by OPD for Chart
    const opdMap = {};
    approved.forEach(r => {
      const opd = r.opd || 'Tidak Diketahui';
      if (!opdMap[opd]) {
        opdMap[opd] = { count: 0, sroiSum: 0 };
      }
      opdMap[opd].count++;
      opdMap[opd].sroiSum += (r.sroi || 0);
    });
    
    const opdLabels = Object.keys(opdMap);
    const opdSroiData = opdLabels.map(opd => (opdMap[opd].sroiSum / opdMap[opd].count).toFixed(2));
    
    return {
      totalDokumen: rkis.length,
      totalDokumenDisahkan: approved.length,
      totalPagu,
      totalManfaat,
      rataRataSroi: rataRataSroi.toFixed(2),
      opdChartData: {
        labels: opdLabels,
        datasets: [{
          label: 'Rata-rata SROI',
          data: opdSroiData,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1
        }]
      }
    };
  }),

  engineId: localStorage.getItem('bapperida_engine') || '9f1c72e8',
  theme: localStorage.getItem('bapperida_theme') || 'light',

  // Core Rules Parameter
  rules: JSON.parse(localStorage.getItem('bapperida_rules')) || [
    { id: 'rule-sroi-min', name: 'Ambang Batas Rasio SROI Minimal', desc: 'Nilai rasio manfaat sosial-ekonomi (SROI) minimal harus di atas 1.0 agar program dinyatakan layak dibiayai.', active: true },
    { id: 'rule-ssh-cirebon', name: 'Validasi SSH Kabupaten Cirebon 2026', desc: 'Memvalidasi belanja barang/jasa (seperti ATK, laptop, konsumsi) agar tidak melebihi pagu standar harga e-SSH 2026.', active: true },
    { id: 'rule-deadweight-limit', name: 'Batas Deadweight Maksimal 40%', desc: 'Persentase Deadweight (dampak sosial yang tetap terjadi tanpa program) tidak boleh melebihi 40%.', active: true },
    { id: 'rule-rpjmd-sync', name: 'Keselarasan RPJMD & RKPD', desc: 'Indikator keluaran program harus selaras dengan misi dan target IKU RPJMD Kabupaten Cirebon.', active: true }
  ],

  gptApiKey: '',
  agentSelectedRkaId: null,
  agentSelectedVersionId: null,
  agentReviewResult: null,
  agentReviewLoading: false,
  agentActionLoading: false,

  rkis: [], // will be loaded asynchronously
  uploadQueue: [],
  activeAnalysis: null,
  isProcessing: false,
  progress: 0,
  statusText: 'Mengekstrak data teks dari PDF...',
  ocrText: '',
  ocrStatus: '',
  notifications: []
});

const notificationsList = reactive([]);

// Watchers for persistent storage
watch(() => state.rules, (newRules) => {
  localStorage.setItem('bapperida_rules', JSON.stringify(newRules));
}, { deep: true });

// TIDAK lagi menyimpan GPT API Key ke localStorage — key ada di backend .env

// Removed watch for state.rkis local storage saving.

watch(() => state.theme, (newTheme) => {
  localStorage.setItem('bapperida_theme', newTheme);
  document.documentElement.setAttribute('data-theme', newTheme);
});

// Initialize theme on load
document.documentElement.setAttribute('data-theme', state.theme);

// Data RKA hanya dimuat setelah login (via checkSession())
// fetchRkis() tidak dipanggil di sini

/* ==========================================================================
   Calculations & Formatting
   ========================================================================== */
function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(num);
}

function getSroiKelayakanColor(sroi) {
  if (sroi > 1.0) return 'Hijau';
  if (sroi === 1.0) return 'Kuning';
  return 'Merah';
}

// Cari nilai field dari objek hasil AI dengan mencoba beberapa kemungkinan
// nama key (LLM tidak selalu konsisten mengikuti nama key persis sesuai skema).
function pickField(obj, keys, fallback) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
}

function showNotification(title, message, type = 'info') {
  const id = Date.now();
  notificationsList.push({
    id,
    title,
    message,
    type
  });
  setTimeout(() => {
    removeNotification(id);
  }, 4500);
}

function removeNotification(id) {
  const index = notificationsList.findIndex(n => n.id === id);
  if (index !== -1) notificationsList.splice(index, 1);
}

/* ==========================================================================
   Realocation Rules Database
   ========================================================================== */
function getRealokasiDatabase(opdLower, programLower, pagu, sroi) {
  const isLowSroi = sroi < 1.0;

  let rekeningDikurangi = [];
  let rekeningDitambah = [];
  let rekeningWajib = [];

  rekeningDikurangi.push({
    kode: '5.2.06.01',
    nama: 'Belanja Perjalanan Dinas Dalam Daerah',
    icon: 'plane',
    alasan: isLowSroi
      ? 'Perjalanan dinas yang tidak berkontribusi langsung pada output dapat dipangkas hingga 30% untuk efisiensi.'
      : 'Koordinasi lapangan rutin dapat diganti sebagian dengan rapat daring (online meeting) untuk menghemat BBM & uang harian.',
    nilai: Math.round(pagu * (isLowSroi ? 0.05 : 0.025))
  });

  if (pagu > 200000000) {
    rekeningDikurangi.push({
      kode: '5.2.06.02',
      nama: 'Belanja Perjalanan Dinas Luar Daerah',
      icon: 'map-pin',
      alasan: 'Dinas keluar daerah perlu selektif — dibatasi untuk kegiatan yang berdampak langsung pada target output RKA (mis. studi banding wajib berbuah dokumen rekomendasi).',
      nilai: Math.round(pagu * (isLowSroi ? 0.08 : 0.04))
    });
  }

  if (opdLower.includes('pendidik') || programLower.includes('pelatiha') || programLower.includes('beasiswa') || programLower.includes('guru') || programLower.includes('kompetens')) {
    rekeningDikurangi.push({
      kode: '5.2.02.08',
      nama: 'Belanja Sewa Gedung / Aula Kegiatan',
      icon: 'building-2',
      alasan: 'Gedung kantor dinas atau balai desa dapat digunakan tanpa biaya sewa, menghemat pagu untuk kebutuhan peserta.',
      nilai: Math.round(pagu * 0.03)
    });
    rekeningDikurangi.push({
      kode: '5.2.02.01',
      nama: 'Belanja Konsumsi Rapat / Snack Kegiatan',
      icon: 'coffee',
      alasan: 'Konsumsi dapat ditekan dengan mengacu standar SSH yang berlaku, atau ditiadakan untuk sesi pelatihan singkat < 4 jam.',
      nilai: Math.round(pagu * 0.015)
    });
    rekeningDitambah.push({
      kode: '5.2.02.12',
      nama: 'Belanja Bahan/Material Praktek Pelatihan (ATK & Modul)',
      icon: 'book-open',
      alasan: 'Kritis untuk capaian output: setiap peserta wajib mendapat modul cetak, alat tulis, dan materi latihan agar target kompetensi terpenuhi.',
      nilai: Math.round(pagu * 0.06),
      prioritas: 'danger'
    });
    rekeningDitambah.push({
      kode: '5.2.03.01',
      nama: 'Honorarium Narasumber / Instruktur Ahli',
      icon: 'user-cog',
      alasan: 'Kualitas instruktur menentukan ketercapaian target kualitatif peserta. Gunakan standar SSH jasa konsultansi Kabupaten Cirebon 2026.',
      nilai: Math.round(pagu * 0.12),
      prioritas: 'primary'
    });
    rekeningDitambah.push({
      kode: '5.2.02.15',
      nama: 'Belanja Sertifikat & Dokumentasi Kegiatan',
      icon: 'award',
      alasan: 'Bukti output wajib: sertifikat peserta dan dokumentasi foto/video sebagai pertanggungjawaban pelaksanaan kegiatan.',
      nilai: Math.round(pagu * 0.02),
      prioritas: 'warning'
    });
    rekeningWajib = [
      { kode: '5.2.02.12', nama: 'Bahan Praktek & Modul ATK', pagu: Math.round(pagu * 0.06), prioritas: 'danger' },
      { kode: '5.2.03.01', nama: 'Honor Narasumber/Instruktur', pagu: Math.round(pagu * 0.12), prioritas: 'primary' },
      { kode: '5.2.02.15', nama: 'Sertifikat & Dokumentasi', pagu: Math.round(pagu * 0.02), prioritas: 'warning' },
      { kode: '5.2.01.01', nama: 'Belanja Pegawai Pelaksana', pagu: Math.round(pagu * 0.08), prioritas: 'primary' }
    ];
  } else if (opdLower.includes('kesehatan') || programLower.includes('stunting') || programLower.includes('pmt') || programLower.includes('posyandu') || programLower.includes('balita')) {
    rekeningDikurangi.push({
      kode: '5.2.02.01',
      nama: 'Belanja Konsumsi & Snack Rapat Koordinasi',
      icon: 'coffee',
      alasan: 'Rapat koordinasi lintas sektor cukup dengan konsumsi standar SSH — tidak perlu catering eksternal untuk efisiensi.',
      nilai: Math.round(pagu * 0.02)
    });
    rekeningDikurangi.push({
      kode: '5.2.05.02',
      nama: 'Belanja Cetak Spanduk & Baliho Sosialisasi',
      icon: 'flag',
      alasan: 'Edukasi gizi dapat memanfaatkan media sosial resmi Dinkes secara gratis, mengurangi kebutuhan cetak fisik.',
      nilai: Math.round(pagu * 0.015)
    });
    rekeningDitambah.push({
      kode: '5.2.02.27',
      nama: 'Belanja Bahan Makanan Tambahan (PMT) Bergizi',
      icon: 'heart',
      alasan: 'Rekening utama program — kecukupan gizi langsung menentukan capaian penurunan prevalensi stunting. Tidak boleh dikurangi.',
      nilai: Math.round(pagu * 0.55),
      prioritas: 'danger'
    });
    rekeningDitambah.push({
      kode: '5.2.02.13',
      nama: 'Belanja Obat & Suplemen Vitamin (Zinc, Fe)',
      icon: 'pill',
      alasan: 'Suplemen pendukung wajib diberikan bersama PMT sesuai Permenkes No. 29/2019 tentang pencegahan stunting.',
      nilai: Math.round(pagu * 0.08),
      prioritas: 'primary'
    });
    rekeningDitambah.push({
      kode: '5.2.03.03',
      nama: 'Honor Kader Posyandu & Tenaga Gizi',
      icon: 'users',
      alasan: 'Kader posyandu adalah ujung tombak pemantauan tumbuh kembang balita — honorarium memastikan kehadiran dan konsistensi monitoring.',
      nilai: Math.round(pagu * 0.07),
      prioritas: 'warning'
    });
    rekeningWajib = [
      { kode: '5.2.02.27', nama: 'Bahan Makanan Tambahan (PMT)', pagu: Math.round(pagu * 0.55), prioritas: 'danger' },
      { kode: '5.2.02.13', nama: 'Obat/Suplemen Zinc & Vitamin Fe', pagu: Math.round(pagu * 0.08), prioritas: 'primary' },
      { kode: '5.2.03.03', nama: 'Honor Kader Posyandu', pagu: Math.round(pagu * 0.07), prioritas: 'warning' },
      { kode: '5.2.06.01', nama: 'Transport Kunjungan Rumah (Home Visit)', pagu: Math.round(pagu * 0.04), prioritas: 'warning' }
    ];
  } else if (opdLower.includes('putr') || opdLower.includes('pekerjaan umum') || programLower.includes('jalan') || programLower.includes('bangunan') || programLower.includes('gapura') || programLower.includes('gedung')) {
    rekeningDikurangi.push({
      kode: '5.2.02.08',
      nama: 'Belanja Jasa Konsultansi Pengawasan Tidak Wajib',
      icon: 'eye',
      alasan: isLowSroi
        ? 'Untuk proyek bernilai sosial rendah (SROI < 1), anggaran konsultan pengawas dapat dikurangi atau digabung dengan tenaga teknis internal.'
        : 'Pertimbangkan menggunakan UPTD teknis internal untuk pengawasan rutin guna menekan biaya konsultansi.',
      nilai: Math.round(pagu * 0.04)
    });
    rekeningDikurangi.push({
      kode: '5.2.02.35',
      nama: 'Belanja Ornamen / Estetika Non-Fungsional',
      icon: 'sparkles',
      alasan: 'Komponen estetika (ukiran, cat premium, ornamen khusus) meningkatkan biaya tanpa dampak sosial terukur. Pilih spesifikasi standar SSH.',
      nilai: Math.round(pagu * (isLowSroi ? 0.10 : 0.03))
    });
    rekeningDitambah.push({
      kode: '5.2.04.01',
      nama: 'Belanja Material Konstruksi Utama (Aspal/Beton/Besi)',
      icon: 'hard-hat',
      alasan: 'Kualitas material langsung menentukan usia pakai dan manfaat infrastruktur. Harus memenuhi spesifikasi teknis minimal Bina Marga.',
      nilai: Math.round(pagu * 0.50),
      prioritas: 'danger'
    });
    rekeningDitambah.push({
      kode: '5.2.04.03',
      nama: 'Belanja Jasa Kontraktor Pelaksana (Fisik)',
      icon: 'truck',
      alasan: 'Kontrak pelaksana fisik adalah rekening inti program — pemilihan kontraktor harus melalui proses tender/lelang sesuai Perpres 16/2018.',
      nilai: Math.round(pagu * 0.35),
      prioritas: 'primary'
    });
    rekeningDitambah.push({
      kode: '5.2.02.11',
      nama: 'Belanja Pengujian Mutu Material (Lab Uji)',
      icon: 'flask-conical',
      alasan: 'Uji mutu material wajib untuk memastikan kualitas konstruksi sesuai SNI — merupakan syarat administrasi pertanggungjawaban.',
      nilai: Math.round(pagu * 0.015),
      prioritas: 'warning'
    });
    rekeningWajib = [
      { kode: '5.2.04.01', nama: 'Material Konstruksi Utama', pagu: Math.round(pagu * 0.50), prioritas: 'danger' },
      { kode: '5.2.04.03', nama: 'Jasa Kontraktor Pelaksana', pagu: Math.round(pagu * 0.35), prioritas: 'primary' },
      { kode: '5.2.02.11', nama: 'Uji Mutu / Lab Test Material', pagu: Math.round(pagu * 0.015), prioritas: 'warning' },
      { kode: '5.2.02.08', nama: 'Konsultansi Pengawasan Teknis', pagu: Math.round(pagu * 0.05), prioritas: 'warning' }
    ];
  } else if (opdLower.includes('sosial') || programLower.includes('karang taruna') || programLower.includes('bimbingan') || programLower.includes('keterampilan')) {
    rekeningDikurangi.push({
      kode: '5.2.06.01',
      nama: 'Belanja Perjalanan Dinas Koordinasi Dinas',
      icon: 'plane',
      alasan: 'Koordinasi antara Dinas Sosial dan kelurahan/kecamatan dapat dilakukan via WhatsApp atau rapat daring untuk menekan uang harian perjalanan.',
      nilai: Math.round(pagu * 0.04)
    });
    rekeningDitambah.push({
      kode: '5.2.02.12',
      nama: 'Belanja Alat Praktek & Bahan Kegiatan (ATK + Alat)',
      icon: 'scissors',
      alasan: 'Alat jahit, benang, kain batik, dll. adalah komponen langsung program yang menentukan apakah peserta dapat berlatih secara nyata.',
      nilai: Math.round(pagu * 0.30),
      prioritas: 'danger'
    });
    rekeningDitambah.push({
      kode: '5.2.03.01',
      nama: 'Honorarium Instruktur/Pelatih Terampil',
      icon: 'user-cog',
      alasan: 'Kualitas pelatih menentukan ketercapaian target kemampuan mandiri peserta karang taruna. Gunakan instruktur bersertifikat BNSP.',
      nilai: Math.round(pagu * 0.15),
      prioritas: 'primary'
    });
    rekeningWajib = [
      { kode: '5.2.02.12', nama: 'Alat Praktek & Bahan ATK', pagu: Math.round(pagu * 0.30), prioritas: 'danger' },
      { kode: '5.2.03.01', nama: 'Honor Instruktur Terampil', pagu: Math.round(pagu * 0.15), prioritas: 'primary' },
      { kode: '5.2.02.15', nama: 'Sertifikat & Dokumentasi', pagu: Math.round(pagu * 0.02), prioritas: 'warning' }
    ];
  } else if (opdLower.includes('bpbd') || opdLower.includes('bencana') || programLower.includes('dokumen') || programLower.includes('peta') || programLower.includes('gis')) {
    rekeningDikurangi.push({
      kode: '5.2.06.02',
      nama: 'Belanja Perjalanan Dinas Luar Daerah (Konsultasi)',
      icon: 'map-pin',
      alasan: 'Konsultasi dengan BNPB or BMKG pusat dapat dilakukan secara hybrid/daring, mengurangi biaya transport dan akomodasi.',
      nilai: Math.round(pagu * 0.06)
    });
    rekeningDikurangi.push({
      kode: '5.2.05.02',
      nama: 'Belanja Cetak Publikasi (Poster/Banner)',
      icon: 'printer',
      alasan: 'Distribusi peta risiko dapat diprioritaskan dalam format digital (PDF/WebGIS) yang lebih hemat dan mudah diperbarui.',
      nilai: Math.round(pagu * 0.025)
    });
    rekeningDitambah.push({
      kode: '5.2.03.02',
      nama: 'Honorarium Tenaga Ahli GIS & Konsultan Pemetaan',
      icon: 'map',
      alasan: 'Tenaga ahli GIS adalah inti program ini — kualitas dokumen peta risiko ditentukan oleh kompetensi konsultan. Wajib menggunakan lulusan geodesi/planologi berpengalaman.',
      nilai: Math.round(pagu * 0.35),
      prioritas: 'danger'
    });
    rekeningDitambah.push({
      kode: '5.2.02.19',
      nama: 'Belanja Langganan Data Citra Satelit / Lidar',
      icon: 'satellite',
      alasan: 'Data spasial resolusi tinggi wajib untuk akurasi peta risiko. Dapat menggunakan data LAPAN/BIG yang bersubsidi pemerintah.',
      nilai: Math.round(pagu * 0.15),
      prioritas: 'primary'
    });
    rekeningDitambah.push({
      kode: '5.2.05.01',
      nama: 'Belanja Cetak Dokumen Peta & Laporan Final',
      icon: 'file-text',
      alasan: 'Output fisik dokumen peta (A1/A0) dan laporan sebagai pertanggungjawaban wajib program kepada Bupati dan BPBD.',
      nilai: Math.round(pagu * 0.05),
      prioritas: 'warning'
    });
    rekeningWajib = [
      { kode: '5.2.03.02', nama: 'Honor Tenaga Ahli GIS', pagu: Math.round(pagu * 0.35), prioritas: 'danger' },
      { kode: '5.2.02.19', nama: 'Data Citra Satelit/Lidar', pagu: Math.round(pagu * 0.15), prioritas: 'primary' },
      { kode: '5.2.05.01', nama: 'Cetak Dokumen Peta Final', pagu: Math.round(pagu * 0.05), prioritas: 'warning' },
      { kode: '5.2.06.01', nama: 'Transport Survei Lapangan', pagu: Math.round(pagu * 0.04), prioritas: 'warning' }
    ];
  } else {
    rekeningDikurangi.push({
      kode: '5.2.02.01',
      nama: 'Belanja Konsumsi Rapat & Koordinasi Umum',
      icon: 'coffee',
      alasan: 'Konsumsi rapat bisa dihemat dengan menerapkan standar SSH minum (snack box standar) dan membatasi frekuensi rapat tatap muka.',
      nilai: Math.round(pagu * 0.02)
    });
    rekeningDitambah.push({
      kode: '5.2.02.12',
      nama: 'Belanja ATK & Bahan Habis Pakai Program',
      icon: 'package',
      alasan: 'ATK dan bahan habis pakai adalah rekening wajib yang mendukung operasional langsung pencapaian output RKA.',
      nilai: Math.round(pagu * 0.05),
      prioritas: 'primary'
    });
    rekeningDitambah.push({
      kode: '5.2.01.02',
      nama: 'Belanja Honor Tim Pelaksana Kegiatan',
      icon: 'users',
      alasan: 'Tim pelaksana harus diberikan honorarium sesuai SK Bupati untuk memastikan dedikasi dan akuntabilitas pencapaian target output.',
      nilai: Math.round(pagu * 0.08),
      prioritas: 'warning'
    });
    rekeningWajib = [
      { kode: '5.2.02.12', nama: 'ATK & Bahan Habis Pakai', pagu: Math.round(pagu * 0.05), prioritas: 'primary' },
      { kode: '5.2.01.02', nama: 'Honor Tim Pelaksana', pagu: Math.round(pagu * 0.08), prioritas: 'warning' }
    ];
  }

  const hasAtk = rekeningWajib.some(r => r.kode.includes('5.2.02.12') || r.kode.includes('5.2.02.27'));
  if (!hasAtk) {
    rekeningWajib.push({ kode: '5.2.02.12', nama: 'Belanja ATK Kegiatan', pagu: Math.round(pagu * 0.03), prioritas: 'warning' });
  }

  return { rekeningDikurangi, rekeningDitambah, rekeningWajib };
}

function buildUsulanProporsi(proporsi, justifications, pagu = 0) {
  let usulan = JSON.parse(JSON.stringify(proporsi));
  if (!justifications || justifications.length === 0) return usulan;

  justifications.forEach(j => {
    // Coba cocokkan berdasarkan kode rekening ATAU nama rekening
    let match = usulan.find(p => p.kode === j.kode || (p.nama && j.rekening_nama && (p.nama.toLowerCase().includes(j.rekening_nama.toLowerCase()) || j.rekening_nama.toLowerCase().includes(p.nama.toLowerCase()))));
    
    if (match) {
      if (j.aksi === 'KURANGI') {
        const diff = j.nilai_dikurangi || 0;
        match.nilai = Math.max(0, match.nilai - diff);
      } else if (j.aksi === 'TAMBAH') {
        const diff = j.nilai_ditambah || 0;
        match.nilai += diff;
      }
    } else {
      if (j.aksi === 'TAMBAH') {
        usulan.push({
          kode: j.kode || '-',
          nama: j.rekening_nama || 'Belanja Tambahan',
          nilai: j.nilai_ditambah || 0,
          persen: 0
        });
      } else if (j.aksi === 'KURANGI') {
        // Jika AI mengurangi item yang tidak ada di proporsi awal, kita tambahkan nilai sisanya
        usulan.push({
          kode: j.kode || '-',
          nama: j.rekening_nama || 'Belanja Dikurangi',
          nilai: Math.max(0, (j.nilai_awal || 0) - (j.nilai_dikurangi || 0)),
          persen: 0
        });
      }
    }
  });

  const sumItems = usulan.reduce((s, r) => s + r.nilai, 0);
  const total = pagu > 0 ? pagu : sumItems;
  if (total > 0) {
    usulan.forEach(r => {
      r.persen = Number(((r.nilai / total) * 100).toFixed(2));
    });
  }
  return usulan;
}

function parseRekeningProporsi(pdfText, totalPagu, program = '') {
  const text = pdfText.toLowerCase();
  const belanjaRegex = /belanja\s+([a-z\s]+?)(?=\n|,|\d|rp|$)/gi;
  let matches = [];
  let m;

  // Ekstrak item belanja dari teks RKA
  while ((m = belanjaRegex.exec(text)) !== null) {
    let name = m[1].trim();
    // Validasi panjang string agar wajar dan bersihkan spasi berlebih
    if (name.length > 5 && name.length < 50 && !name.includes('belanja')) {
      matches.push("Belanja " + name.replace(/\s+/g, ' '));
    }
  }

  // Hapus duplikat
  matches = [...new Set(matches)];

  let items = [];

  if (matches.length >= 3) {
    // Jika menemukan item di teks, alokasikan secara dinamis
    let remaining = totalPagu;
    for (let i = 0; i < matches.length; i++) {
      let isLast = (i === matches.length - 1);
      let name = matches[i];
      // Generate pseudo-random kode rekening
      let kode = `5.2.${Math.floor(Math.random() * 5 + 1).toString().padStart(2, '0')}.${Math.floor(Math.random() * 20 + 1).toString().padStart(2, '0')}`;

      if (isLast) {
        items.push({
          kode,
          nama: name.replace(/belanja /i, ''),
          nilai: remaining,
          persen: Number(((remaining / totalPagu) * 100).toFixed(1))
        });
      } else {
        let val = Math.round(totalPagu * (0.1 + Math.random() * 0.25)); // 10% - 35%
        let allocated = Math.min(remaining, val);
        remaining -= allocated;
        items.push({
          kode,
          nama: name.replace(/belanja /i, ''),
          nilai: allocated,
          persen: Number(((allocated / totalPagu) * 100).toFixed(1))
        });
      }
    }
  } else {
    // Jika tidak ketemu teks spesifik, hasilkan item generik yang digabungkan dengan nama program
    const progName = program || 'Kegiatan Utama';
    items = [
      { kode: '5.2.02.01', nama: `Material & Bahan Pendukung (${progName})`, nilai: Math.round(totalPagu * 0.4), persen: 40 },
      { kode: '5.2.03.02', nama: `Honorarium Tim Pelaksana`, nilai: Math.round(totalPagu * 0.25), persen: 25 },
      { kode: '5.2.06.01', nama: `Perjalanan Dinas Koordinasi`, nilai: Math.round(totalPagu * 0.15), persen: 15 },
      { kode: '5.2.02.06', nama: `Cetak & Penggandaan Laporan`, nilai: Math.round(totalPagu * 0.1), persen: 10 },
      { kode: '5.2.02.12', nama: `ATK Operasional Rutin`, nilai: Math.round(totalPagu * 0.1), persen: 10 },
    ];
  }
  return items;
}

/* ==========================================================================
   AI evaluation and reasoning
   ========================================================================== */

function updateProgressBar(percentage, text, queueItem = null) {
  state.progress = percentage;
  state.statusText = text;
  if (queueItem) {
    queueItem.progress = percentage;
    queueItem.statusText = text;
  }
}

function resetUploadArea() {
  state.isProcessing = false;
  state.progress = 0;
  state.statusText = "Mengekstrak data teks dari PDF...";
  state.uploadQueue = [];
}
async function handleRkaFiles(files) {
  if (!files || files.length === 0) return;

  state.isProcessing = true;
  state.uploadQueue = files.map((f, i) => ({
    id: Date.now() + i,
    file: f,
    name: f.name,
    size: f.size,
    progress: 0,
    status: 'pending',
    statusText: 'Menunggu antrean...'
  }));

  for (let f = 0; f < state.uploadQueue.length; f++) {
    const queueItem = state.uploadQueue[f];
    const file = queueItem.file;
    queueItem.status = 'processing';

    if (file.type !== 'application/pdf') {
      queueItem.status = 'error';
      queueItem.statusText = 'Bukan file PDF';
      showNotification("Berkas Tidak Valid", `Berkas ${file.name} diabaikan (bukan PDF).`, "warning");
      continue;
    }

    try {
      updateProgressBar(10, `Membaca data PDF ${f + 1} dari ${files.length}...`, queueItem);
      const arrayBuffer = await file.arrayBuffer();
      const typedarray = new Uint8Array(arrayBuffer);

      updateProgressBar(30, `Mengekstrak data teks ${f + 1}/${files.length}...`, queueItem);
      const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
      let textContent = "";
      let maxPages = Math.min(pdf.numPages, 10);

      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const text = await page.getTextContent();
        const strings = text.items.map(item => item.str);
        textContent += strings.join(" ") + "\n";

        const progress = 30 + Math.round((i / maxPages) * 30);
        updateProgressBar(progress, `Mengekstrak halaman ${i} dari ${pdf.numPages}...`, queueItem);
      }

      if (textContent.trim().length === 0) {
        throw new Error("Tidak dapat mengekstrak teks dari PDF.");
      }

      updateProgressBar(70, `Layanan AI mengevaluasi...`, queueItem);
      state.ocrText = textContent;
      state.ocrStatus = `Teks Terdeteksi: ${textContent.length} karakter`;

      const analysisObj = await processWithAIService(textContent, file.name, file.size);
      
      const newId = 'RKA-2026-00' + (state.rkis.length + 1);
      analysisObj.id = newId;
      
      // Save to backend
      try {
        const res = await apiFetch('/api/v1/rkis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(analysisObj)
        });
        if (res.ok) {
          const savedObj = await res.json();
          state.rkis.unshift(savedObj);
        } else {
          throw new Error('Gagal menyimpan ke server');
        }
      } catch (saveError) {
        console.error(saveError);
        showNotification("Gagal Menyimpan", saveError.message, "danger");
        state.rkis.unshift(analysisObj);
      }
      
      queueItem.status = 'done';
      queueItem.progress = 100;
      queueItem.statusText = 'Selesai diproses';

    } catch (e) {
      console.error(e);
      queueItem.status = 'error';
      queueItem.statusText = 'Gagal memproses file';
      showNotification("Gagal Memproses " + file.name, e.message, "danger");
    }
  }

  const hasSuccess = state.uploadQueue.some(q => q.status === 'done');
  if (hasSuccess) {
    updateProgressBar(100, "Semua berkas selesai diproses!");
    setTimeout(() => {
      state.currentTab = 'history';
      resetUploadArea();
    }, 1500);
  } else {
    state.isProcessing = false;
    state.statusText = "Gagal memproses berkas. Silakan periksa API Key Gemini Anda.";
  }
}
async function processWithAIService(pdfText, fileName, fileSize) {
  const engine = state.engineId;

  const activeRulesStr = state.rules
    .filter(r => r.active)
    .map((r, i) => `${i + 1}. ${r.name}: ${r.desc}`)
    .join('\n');

  const systemPrompt = `Anda adalah AI Asisten Evaluator Anggaran & Dampak Sosial (SROI) khusus untuk BAPPERIDA Kabupaten Cirebon.
Tugas Anda adalah melakukan audit atas dokumen RKA (Rencana Kerja dan Anggaran) daerah dan memproyeksikan rasio SROI (Social Return on Investment).

Lakukan 3 Lapis Penalaran (Reasoning) sekaligus:
1. Ekstraksi Komponen: Temukan nama OPD/Satuan Kerja, sub-kegiatan utama, PAGU ANGGARAN (nilai total anggaran) sebagai TOTAL INVESTASI.
2. Ekstraksi Target: Temukan target keluaran kuantitatif program.
3. Analisis & Proyeksi SROI:
   - Proyeksikan estimasi manfaat sosial-ekonomi (Outcome) dalam nilai Rupiah. Justifikasi logis berdasarkan target.
   - Estimasi Deadweight (faktor pengurangan dalam persentase, biasanya berkisar antara 10% s.d. 30%).
   - Hitung SROI Ratio = (Outcome * (100 - Deadweight) / 100) / Pagu Anggaran.
4. Analisis Proporsi Rekening: Identifikasi kode rekening belanja utama dan distribusi persentasenya dari total pagu. Minimal 4-6 rekening.
5. Justifikasi Realokasi Berpasangan: Alasan spesifik kurangi/tambah rekening.

Patuhi kebijakan threshold berikut yang sedang aktif:
${activeRulesStr}

Format JSON kaku dan valid:
{
  "opd": "Dinas Kesehatan",
  "program": "Nama Program",
  "kegiatan": "Nama Kegiatan",
  "sub_kegiatan": "Nama Sub-Kegiatan (SUBKEG)",
  "pagu": 125000000,
  "tahun_rencana": 2027,
  "target": "Target",
  "outcome_description": "Justifikasi",
  "social_benefit_value": 150000000,
  "deadweight_percentage": 15,
  "sroi_ratio": 1.02,
  "anggaran_tahunan": [
    { "tahun": 2026, "jumlah": 10865685600 },
    { "tahun": 2027, "jumlah": 11075485600 }
  ],
  "rekening_proporsi": [
    { "kode": "5.2.06.01", "nama": "Belanja Perjalanan Dinas", "persen": 15.5, "nilai": 19375000 }
  ],
  "reallocation_justifications": [
    { "rekening_nama": "Belanja...", "kode": "5.2.06.01", "aksi": "KURANGI", "alasan_dikurangi": "...", "nilai_dikurangi": 5000000 }
  ],
  "findings": [
    { "finding_type": "Kepatuhan e-SSH", "status": "Sesuai", "description": "..." }
  ]
}`;

  let jsonResult = null;

  try {
    updateProgressBar(80, "Layanan AI sedang mengevaluasi SROI...");

    const apiKey = localStorage.getItem('GEMINI_API_KEY') || '';

    const response = await apiFetch("/api/v1/evaluate", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      credentials: "include",
      body: JSON.stringify({
        text: pdfText,
        engineId: engine,
        rules: state.rules.filter(r => r.active).map(r => ({ name: r.name, desc: r.desc }))
      })
    });

    jsonResult = await response.json();

    if (!response.ok || jsonResult.error) {
      throw new Error(jsonResult.error || "Gagal menghubungi server AI");
    }

  } catch (apiError) {
    console.warn("AI Service API failed:", apiError);
    throw apiError;
  }

  return {
    id: 'RKA-2026-TMP',
    opd: jsonResult.opd || jsonResult.perangkat_daerah || 'Dinas Kesehatan Kabupaten Cirebon',
    perangkatDaerah: jsonResult.opd || jsonResult.perangkat_daerah || 'Dinas Kesehatan Kabupaten Cirebon',
    program: jsonResult.program || jsonResult.nama_program || 'Program Pelayanan Publik',
    namaProgram: jsonResult.program || jsonResult.nama_program || 'Program Pelayanan Publik',
    kegiatan: jsonResult.kegiatan || jsonResult.nama_kegiatan || 'Penyediaan Layanan Kesehatan untuk UKM dan UKP',
    namaKegiatan: jsonResult.kegiatan || jsonResult.nama_kegiatan || 'Penyediaan Layanan Kesehatan untuk UKM dan UKP',
    subKegiatan: jsonResult.sub_kegiatan || jsonResult.subKegiatan || jsonResult.subkeg || jsonResult.program || 'Pengelolaan Pelayanan Kesehatan Ibu dan Anak',
    pagu: Number(jsonResult.pagu) || 100000000,
    outcome: Number(jsonResult.social_benefit_value) || 120000000,
    deadweight: Number(jsonResult.deadweight_percentage) || 15,
    attribution: Number(jsonResult.attribution_percentage) || 15,
    dropOff: Number(jsonResult.dropoff_percentage) || 10,
    sroi: Number(jsonResult.sroi_ratio) || 1.02,
    target: jsonResult.target || 'Meningkatkan layanan masyarakat',
    targetKuantitatif: jsonResult.target || 'Meningkatkan layanan masyarakat',
    outcomeDesc: jsonResult.outcome_description || 'Dampak sosial kemasyarakatan dari realisasi fisik program.',
    justifikasiOutcome: jsonResult.outcome_description || 'Dampak sosial kemasyarakatan dari realisasi fisik program.',
    status: 'Draft',
    kelayakan: getSroiKelayakanColor(Number(jsonResult.sroi_ratio) || 1.02),
    catatan: '',
    findings: jsonResult.findings || [],
    kepatuhanFindings: (jsonResult.findings || []).map(f => ({
      label: f.finding_type,
      description: f.description,
      status: f.status === 'Sesuai' ? 'sesuai' : (f.status === 'Temuan' ? 'temuan' : 'warning')
    })),
    rawJson: JSON.stringify(jsonResult, null, 2),
    rekeningProporsi: jsonResult.rekening_proporsi || [],
    rekeningProporsiUsulan: buildUsulanProporsi(jsonResult.rekening_proporsi || [], jsonResult.reallocation_justifications || [], Number(jsonResult.pagu) || 0),
    reallocationJustifications: jsonResult.reallocation_justifications || [],
    originalPagu: Number(jsonResult.pagu) || 100000000,
    originalOutcome: Number(jsonResult.social_benefit_value) || 120000000,
    originalDeadweight: Number(jsonResult.deadweight_percentage) || 15,
    originalAttribution: Number(jsonResult.attribution_percentage) || 15,
    originalDropOff: Number(jsonResult.dropoff_percentage) || 10,
    namaDokumen: fileName,
    ukuranFile: fileSize || 0,
    tanggalUpload: new Date().toISOString(),
    tahun: new Date().getFullYear(),

    // Indikator & Tolok Ukur Kinerja (Target Kinerja) + Anggaran per tahun.
    // Dicari dengan beberapa kemungkinan nama key, karena LLM tidak selalu
    // 100% konsisten mengikuti nama key persis seperti pada skema prompt.
    indikatorKinerja: pickField(jsonResult, [
      'indikator_kinerja', 'indikatorKinerja', 'indikator', 'indicator_performance'
    ], []),
    anggaranTahunan: pickField(jsonResult, [
      'anggaran_tahunan', 'anggaranTahunan', 'anggaran_per_tahun', 'yearly_budget'
    ], []),
    tahunRencana: Number(pickField(jsonResult, [
      'tahun_rencana', 'tahunRencana', 'tahun_berjalan', 'tahun_anggaran'
    ], new Date().getFullYear())),
    lokasi: jsonResult.lokasi || '',
    sumberDana: jsonResult.sumber_dana || jsonResult.sumberDana || '',

    // Analisis kesesuaian anggaran tahun berjalan terhadap Target Kinerja
    // (dihasilkan AI berdasarkan indikator_kinerja + anggaran_tahunan di atas).
    kesesuaianAnggaran: pickField(jsonResult, [
      'analisis_kesesuaian_anggaran', 'kesesuaianAnggaran', 'budget_target_analysis'
    ], null),

    // Evaluasi 6 Aspek Efisiensi & Efektivitas RKA (efisiensi alokasi, distribusi
    // RPD, kepatuhan SSH/SBM, efisiensi realisasi kinerja, efektivitas aktual,
    // potensi inefektivitas). Jika AI tidak mengembalikannya, computeRkaEvaluasi()
    // akan menghitung fallback deterministik dari data yang tersedia.
    evaluasiRka: pickField(jsonResult, [
      'evaluasi_rka', 'evaluasiRka', 'rka_evaluation'
    ], null)
  };
}

function recalculateSroiLocal() {
  const data = state.activeAnalysis;
  if (!data) return;

  const pagu = Number(data.pagu);
  const outcome = Number(data.outcome);
  const deadweight = Number(data.deadweight);

  if (isNaN(pagu) || pagu <= 0) {
    showNotification("Pagu Tidak Valid", "Pagu anggaran harus angka positif.", "danger");
    return;
  }

  const netBenefit = outcome * (1 - deadweight / 100);
  const sroiRatio = Number((netBenefit / pagu).toFixed(2));

  data.sroi = sroiRatio;
  data.kelayakan = getSroiKelayakanColor(sroiRatio);

  if (data.rawJson) {
    try {
      const rawObj = JSON.parse(data.rawJson);
      rawObj.pagu = pagu;
      rawObj.social_benefit_value = outcome;
      rawObj.deadweight_percentage = deadweight;
      rawObj.sroi_ratio = sroiRatio;
      rawObj.inspektorat_assessment = {
        recalculated_by: state.currentRole,
        timestamp: new Date().toISOString(),
        evaluation_notes: data.catatan
      };
      data.rawJson = JSON.stringify(rawObj, null, 2);
    } catch (e) {
      console.error(e);
    }
  }
}

function approveCurrentDocument() {
  const data = state.activeAnalysis;
  if (!data) return;

  recalculateSroiLocal();

  const newId = 'RKA-2026-00' + (state.rkis.length + 1);
  const approvedDoc = {
    ...data,
    id: data.id === 'RKA-2026-TMP' ? newId : data.id,
    status: 'Approved'
  };

  const existIndex = state.rkis.findIndex(r => r.id === approvedDoc.id);
  
  // Use Promise API to avoid making approveCurrentDocument fully async if it breaks UI expectations
  const promise = (existIndex !== -1)
    ? apiFetch(`/api/v1/rkis/${approvedDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
        body: JSON.stringify(approvedDoc)
      })
    : apiFetch('/api/v1/rkis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
        body: JSON.stringify(approvedDoc)
      });
  
  promise.then(res => {
    if (res.ok) {
      if (existIndex !== -1) {
        state.rkis[existIndex] = approvedDoc;
      } else {
        state.rkis.unshift(approvedDoc);
      }
      showNotification("Dokumen Disahkan", "Evaluasi RKA telah berhasil disimpan dan disahkan.", "success");
    } else {
      showNotification("Gagal Mengesahkan", "Terjadi kesalahan pada server.", "danger");
    }
  }).catch(e => {
    console.error(e);
    showNotification("Error", "Gagal menghubungi server.", "danger");
  });

  state.activeAnalysis = null;
  state.currentTab = 'dashboard';
}

function loadHistoricalDocIntoAnalyzer(doc) {
  const initialProporsi = doc.rekeningProporsi && doc.rekeningProporsi.length > 0
    ? doc.rekeningProporsi
    : parseRekeningProporsi((doc.program || '') + " " + (doc.opd || ''), doc.pagu);

  const justifications = doc.reallocationJustifications || [];

  if (justifications.length === 0) {
    const { rekeningDikurangi, rekeningDitambah } = getRealokasiDatabase((doc.opd || '').toLowerCase(), (doc.program || '').toLowerCase(), doc.pagu, doc.sroi);
    rekeningDikurangi.forEach(r => {
      justifications.push({
        rekening_nama: r.nama,
        kode: r.kode,
        aksi: 'KURANGI',
        alasan_dikurangi: r.alasan,
        nilai_dikurangi: r.nilai
      });
    });
    rekeningDitambah.forEach(r => {
      justifications.push({
        rekening_nama: r.nama,
        kode: r.kode,
        aksi: 'TAMBAH',
        alasan_dialokasikan: r.alasan,
        nilai_ditambah: r.nilai
      });
    });
  }

  state.activeAnalysis = {
    ...doc,
    attribution: doc.attribution || 15,
    dropOff: doc.dropOff || 10,
    originalPagu: doc.originalPagu || doc.pagu,
    originalOutcome: doc.originalOutcome || doc.outcome,
    originalDeadweight: doc.originalDeadweight || doc.deadweight,
    originalAttribution: doc.originalAttribution || doc.attribution || 15,
    originalDropOff: doc.originalDropOff || doc.dropOff || 10,
    rekeningProporsi: initialProporsi,
    reallocationJustifications: justifications,
    rekeningProporsiUsulan: doc.rekeningProporsiUsulan && doc.rekeningProporsiUsulan.length > 0
      ? doc.rekeningProporsiUsulan
      : buildUsulanProporsi(initialProporsi, justifications, doc.originalPagu || doc.pagu || 0)
  };

  state.ocrText = `
[ARSIP DOKUMEN RKA RESMI]
ID RKA: ${doc.id}
Satuan Kerja (OPD): ${doc.opd}
Program / Sub-Kegiatan: ${doc.program}
Pagu Investasi Diusulkan: ${formatRupiah(doc.originalPagu || doc.pagu)}
Sasaran Target Output: ${doc.target}

Teks Dokumen:
Rencana Kerja Anggaran SKPD ${doc.opd} tahun anggaran 2026. Sub-Kegiatan: ${doc.program}. Pelaksanaan di Kabupaten Cirebon. Target Kuantitatif Rencana: ${doc.target}. Output dampak sosial berupa: ${doc.outcomeDesc}.

Rekomendasi Evaluator:
${doc.catatan || 'Belum ada catatan tambahan.'}
  `;
  state.ocrStatus = "Arsip Dokumen Termuat";

  state.currentTab = 'analyzer';
}

function downloadLaporanEvaluasi() {
  if (!state.activeAnalysis) {
    showNotification("Belum Ada Data", "Silakan unggah dan analisis dokumen RKA terlebih dahulu.", "warning");
    return;
  }

  const element = document.getElementById('pdf-template');
  if (!element) {
    showNotification("Elemen Tidak Ditemukan", "Tidak dapat menemukan konten template laporan PDF.", "warning");
    return;
  }

  const filename = `Laporan_SROI_${state.activeAnalysis.id || 'export'}.pdf`;

  // Tampilkan template secara sementara untuk rendering
  const originalDisplay = element.style.display;
  element.style.display = 'block';

  html2pdf()
    .set({
      margin: 12,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: { mode: ['css', 'legacy'] }
    })
    .from(element)
    .outputPdf('bloburl')
    .then((pdfUrl) => {
      element.style.display = originalDisplay;
      window.open(pdfUrl, '_blank');
      showNotification(
        "Laporan berhasil dibuat.",
        "Preview PDF telah dibuka. Silakan cetak atau simpan dokumen.",
        "success"
      );
    })
    .catch((err) => {
      element.style.display = originalDisplay;
      console.error('html2pdf error:', err);
      showNotification("Gagal Mengunduh PDF", "Terjadi kesalahan saat menghasilkan PDF. Silakan coba lagi.", "danger");
    });
}


async function saveRki(analysisObj) {
  if (!analysisObj) return;
  const id = analysisObj.id;
  try {
    // Cek apakah sudah ada di backend (update) atau belum (create)
    const existing = state.rkis.find(r => r.id === id);
    let res;
    if (existing) {
      res = await apiFetch(`/api/v1/rkis/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(analysisObj)
      });
    } else {
      res = await apiFetch('/api/v1/rkis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(analysisObj)
      });
    }
    if (res.ok) {
      const saved = await res.json();
      const idx = state.rkis.findIndex(r => r.id === id);
      if (idx !== -1) {
        state.rkis[idx] = saved;
      } else {
        state.rkis.unshift(saved);
      }
      showNotification('Data Tersimpan', 'Dokumen RKA berhasil disimpan ke server.', 'success');
      return saved;
    } else {
      showNotification('Gagal Menyimpan', 'Tidak dapat menyimpan data ke server.', 'danger');
    }
  } catch (err) {
    console.error(err);
    showNotification('Error', 'Tidak dapat menghubungi server.', 'danger');
  }
}

async function deleteRki(id) {
  try {
    const res = await apiFetch(`/api/v1/rkis/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      const idx = state.rkis.findIndex(r => r.id === id);
      if (idx !== -1) {
        state.rkis.splice(idx, 1);
        showNotification('Dokumen Dihapus', 'Dokumen berhasil dihapus dari arsip.', 'success');
      }
    } else {
      showNotification('Gagal', 'Gagal menghapus dari server.', 'danger');
    }
  } catch (err) {
    console.error(err);
    showNotification('Error', 'Tidak dapat menghubungi server.', 'danger');
  }
}

async function updateRkiMetadata(id, updates) {
  try {
    const res = await apiFetch(`/api/v1/rkis/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      const updatedRka = await res.json();
      const idx = state.rkis.findIndex(r => r.id === id);
      if (idx !== -1) {
        state.rkis[idx] = updatedRka;
        showNotification('Dokumen Diperbarui', 'Metadata dokumen berhasil disimpan.', 'success');
      }
    } else {
      showNotification('Gagal', 'Gagal memperbarui data di server.', 'danger');
    }
  } catch (err) {
    console.error(err);
    showNotification('Error', 'Tidak dapat menghubungi server.', 'danger');
  }
}

/* ==========================================================================
   Agentic AI Engine & Versioning Methods
   ========================================================================== */

function saveGptApiKey(key) {
  if (key && key.trim()) {
    state.gptApiKey = key.trim();
    localStorage.setItem('GPT_API_KEY', key.trim());
    localStorage.setItem('OPENAI_API_KEY', key.trim());
    showNotification('GPT API Key Disimpan', 'Konfigurasi otak AI Agent berhasil disimpan.', 'success');
  }
}

function deleteGptApiKey() {
  state.gptApiKey = '';
  localStorage.removeItem('GPT_API_KEY');
  localStorage.removeItem('OPENAI_API_KEY');
  showNotification('GPT API Key Dihapus', 'Kunci API OpenAI telah dihapus.', 'info');
}

async function runAgentAudit(rkaData, forceRefresh = false) {
  if (!rkaData) return null;
  const gptKey = state.gptApiKey || localStorage.getItem('GPT_API_KEY') || localStorage.getItem('OPENAI_API_KEY') || '';
  const geminiKey = localStorage.getItem('GEMINI_API_KEY') || '';

  state.agentReviewLoading = true;
  state.agentReviewResult = null;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (gptKey) headers['x-gpt-key'] = gptKey;
    if (geminiKey) headers['x-api-key'] = geminiKey;

    const res = await apiFetch('/api/v1/agentic-ai/review', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        rkaData,
        tahun: rkaData.tahun || '2026',
        rules: state.rules.filter(r => r.active),
        forceRefresh
      })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Gagal menjalankan audit Agentic AI.');
    }

    state.agentReviewResult = data.review;

    if (data.fallbackNotice) {
      showNotification('Status Engine AI', data.fallbackNotice, 'warning');
    } else if (data.cached) {
      showNotification('Audit Dimuat dari Cache', `Skor Kesehatan RKA: ${data.review.health_score}/100 (${data.review.overall_status})`, 'info');
    } else {
      showNotification('Audit Selesai', `Skor Kesehatan RKA: ${data.review.health_score}/100 (${data.modelUsed || 'AI Engine'})`, 'success');
    }

    // Save review to local rka item if cached
    const idx = state.rkis.findIndex(r => r.id === rkaData.id);
    if (idx !== -1) {
      state.rkis[idx].agentReviewResult = data.review;
      state.rkis[idx].agentReviewModel = data.modelUsed;
      state.rkis[idx].agentReviewTimestamp = data.auditedAt;
    }

    return data;

  } catch (err) {
    console.error('runAgentAudit error:', err);
    showNotification('Audit Gagal', err.message, 'danger');
    return null;
  } finally {
    state.agentReviewLoading = false;
  }
}

async function applyAgentAction({ rkaData, instruction, actionType, customChanges, targetVersionName }) {
  if (!rkaData) return null;
  const gptKey = state.gptApiKey || localStorage.getItem('GPT_API_KEY') || localStorage.getItem('OPENAI_API_KEY') || '';
  const geminiKey = localStorage.getItem('GEMINI_API_KEY') || '';

  state.agentActionLoading = true;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (gptKey) headers['x-gpt-key'] = gptKey;
    if (geminiKey) headers['x-api-key'] = geminiKey;

    const res = await apiFetch('/api/v1/agentic-ai/action', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        rkaData,
        instruction,
        actionType,
        customChanges,
        targetVersionName
      })
    });

    const result = await res.json();
    if (!res.ok || result.error) {
      throw new Error(result.error || 'Gagal menerapkan aksi Agentic AI.');
    }

    // Update in local state.rkis
    const idx = state.rkis.findIndex(r => r.id === rkaData.id);
    if (idx !== -1 && result.updatedRka) {
      state.rkis[idx] = result.updatedRka;
    }

    // If active analysis is current RKA, update it
    if (state.activeAnalysis && state.activeAnalysis.id === rkaData.id) {
      loadHistoricalDocIntoAnalyzer(result.updatedRka);
    }

    showNotification('Versi Baru Disimpan', `Versi ${result.newVersion.versionName} berhasil dibuat tanpa menimpa data original.`, 'success');
    return result;

  } catch (err) {
    console.error('applyAgentAction error:', err);
    showNotification('Aksi Gagal', err.message, 'danger');
    return null;
  } finally {
    state.agentActionLoading = false;
  }
}

async function saveManualVersion(rkaId, { parentVersionId, versionName, changesSummary, data, createdBy, source, modifications }) {
  try {
    const res = await apiFetch(`/api/v1/rkis/${rkaId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        parentVersionId,
        versionName,
        changesSummary,
        data,
        createdBy: createdBy || 'Pengguna (Agentic AI Studio)',
        source: source || 'agentic-ai',
        modifications: modifications || []
      })
    });

    const result = await res.json();
    if (!res.ok || result.error) throw new Error(result.error || 'Gagal membuat versi baru.');

    const idx = state.rkis.findIndex(r => r.id === rkaId);
    if (idx !== -1 && result.rka) {
      state.rkis[idx] = result.rka;
    }

    if (state.activeAnalysis && state.activeAnalysis.id === rkaId) {
      loadHistoricalDocIntoAnalyzer(result.rka);
    }

    showNotification('Versi Baru Disimpan', `Versi ${result.version.versionName} berhasil disimpan ke database.`, 'success');
    return result;
  } catch (err) {
    console.error('saveManualVersion error:', err);
    showNotification('Gagal Menyimpan Versi', err.message, 'danger');
    return null;
  }
}

async function switchRkaVersion(rkaId, versionId) {
  try {
    const res = await apiFetch(`/api/v1/rkis/${rkaId}/versions/${versionId}/activate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ actor: state.currentRole === 'inspektorat' ? 'Inspektorat' : 'ASN (Analis Kebijakan)' })
    });

    const result = await res.json();
    if (!res.ok || result.error) throw new Error(result.error || 'Gagal mengaktifkan versi.');

    const idx = state.rkis.findIndex(r => r.id === rkaId);
    if (idx !== -1 && result.rka) {
      state.rkis[idx] = result.rka;
    }

    if (state.activeAnalysis && state.activeAnalysis.id === rkaId) {
      loadHistoricalDocIntoAnalyzer(result.rka);
    }

    showNotification('Versi Aktif Diubah', `Versi aktif saat ini: ${result.activeVersion.versionName}`, 'info');
    return result;
  } catch (err) {
    console.error('switchRkaVersion error:', err);
    showNotification('Gagal Mengganti Versi', err.message, 'danger');
    return null;
  }
}

function openInAgenticAi(rkaItem) {
  if (!rkaItem) return;
  state.agentSelectedRkaId = rkaItem.id;
  state.agentSelectedVersionId = rkaItem.activeVersionId || (rkaItem.versions?.[rkaItem.versions.length - 1]?.versionId) || 'v1.0';
  state.agentReviewResult = null;
  state.currentTab = 'agentic-ai';
}

function openHasilPenalaranSroi(rkaItem) {
  if (!rkaItem) return;
  loadHistoricalDocIntoAnalyzer(rkaItem);
}

function loadSpecificVersionIntoAnalyzer(rkaItem, versionId) {
  if (!rkaItem) return;
  const versions = rkaItem.versions || [];
  const targetVer = versions.find(v => v.versionId === versionId);
  const dataToLoad = targetVer ? { ...targetVer.data, activeVersionId: versionId, selectedVersionName: targetVer.versionName } : rkaItem;
  loadHistoricalDocIntoAnalyzer(dataToLoad);
}

// ── Evaluasi 6 Aspek Efisiensi & Efektivitas RKA ──────────────────────
// Mengembalikan evaluasi 6-aspek yang sudah dihasilkan AI (evaluasi_rka dari
// server.js) jika tersedia. Jika tidak (mis. dokumen lama yang dianalisis
// sebelum fitur ini ada), hitung fallback deterministik dari data yang sudah
// tersimpan pada rka (rekeningProporsi) agar UI tetap dapat menampilkan
// sesuatu yang bermakna alih-alih kosong.
export function computeRkaEvaluasi(rka) {
  if (rka && rka.evaluasiRka) {
    return rka.evaluasiRka;
  }
  if (rka && rka.evaluasi_rka) {
    return rka.evaluasi_rka;
  }

  // Hitung proporsi belanja penunjang secara dinamis dari rka.rekeningProporsi
  const rekening = (rka && rka.rekeningProporsi) ? rka.rekeningProporsi : [];
  let supportPersen = 0;

  if (rekening.length > 0) {
    const supportKeywords = ['perjalanan', 'konsumsi', 'makan', 'minum', 'atk', 'cetak', 'spanduk', 'banner', 'sewa gedung', 'operasional kantor'];
    const supportItems = rekening.filter(r =>
      supportKeywords.some(kw => (r.nama || '').toLowerCase().includes(kw))
    );
    supportPersen = supportItems.reduce((sum, r) => sum + (Number(r.persen) || 0), 0);
  }

  const isEfisiensiAlokasiEfisien = supportPersen <= 15;

  return {
    efisiensi_alokasi: {
      status: isEfisiensiAlokasiEfisien ? "Efisien" : "Memerlukan Penyesuaian Alokasi",
      alasan: isEfisiensiAlokasiEfisien
        ? "Proporsi belanja penunjang berada dalam batas efisiensi yang ditetapkan, sehingga porsi utama anggaran teralokasi untuk belanja utama program."
        : "Proporsi belanja penunjang operasional melebihi batas efisiensi 15% dari total pagu.",
      temuan: isEfisiensiAlokasiEfisien
        ? "Anggaran RKA teralokasi secara dominan pada komponen belanja utama yang mendukung pencapaian keluaran (output) program."
        : "Terdapat pos belanja penunjang yang berpotensi rasionalisasi untuk meningkatkan alokasi belanja utama.",
      risiko: isEfisiensiAlokasiEfisien
        ? "Risiko pemborosan pada belanja penunjang tergolong rendah."
        : "Risiko berkurangnya alokasi belanja utama yang berdampak langsung pada keluaran program.",
      rekomendasi: isEfisiensiAlokasiEfisien
        ? "Pertahankan proporsi alokasi belanja utama dan belanja penunjang ini."
        : "Lakukan pengalihan sebagian belanja penunjang ke belanja utama."
    },
    distribusi_rpd: {
      status: "Belum Dapat Dinilai",
      alasan: "Data Rencana Penarikan Dana (RPD) per triwulan tidak ditemukan pada dokumen ini.",
      temuan: "Dokumen RKA yang dianalisis tidak memuat rincian jadwal RPD triwulanan.",
      risiko: "Potensi penumpukan pencairan dana di akhir tahun belum dapat dipastikan.",
      rekomendasi: "Lengkapi rincian RPD triwulanan pada dokumen untuk penilaian yang lebih akurat."
    },
    kepatuhan_ssh_sbm: {
      status: "Belum Dapat Dinilai",
      alasan: "Data pembanding SSH (Standar Satuan Harga) dan SBM (Standar Biaya Masukan) belum dikonfigurasi untuk tahun anggaran dokumen ini.",
      temuan: "Harga satuan pada rincian belanja belum dapat disandingkan dengan standar harga resmi.",
      risiko: "Potensi timbulnya ketidaksesuaian harga satuan dengan ketentuan standar biaya yang berlaku.",
      rekomendasi: "Konfigurasikan data SSH aktif untuk tahun anggaran ini pada menu SSH agar validasi harga satuan lebih akurat."
    },
    efisiensi_realisasi_kinerja: {
      status: "Belum Dapat Dinilai",
      alasan: "Data realisasi anggaran dan keluaran (output) belum tersedia dalam dokumen RKA.",
      temuan: "Belum ada data realisasi yang dapat digunakan untuk mengalkulasi rasio efisiensi biaya output terhadap kinerja.",
      risiko: "Efisiensi penggunaan anggaran dalam menghasilkan keluaran belum dapat diukur pada tahap perencanaan.",
      rekomendasi: "Lengkapi data realisasi anggaran dan keluaran (output) setelah kegiatan dilaksanakan."
    },
    efektivitas_aktual: {
      status: "Belum Dapat Dinilai",
      alasan: "Realisasi keluaran (output) maupun hasil (outcome) belum tersedia karena kegiatan belum dilaksanakan.",
      temuan: "Dokumen RKA memuat target keluaran, tetapi data realisasinya belum ada.",
      risiko: "Tingkat pencapaian target aktual belum dapat dipastikan sebelum kegiatan berjalan.",
      rekomendasi: "Catat data realisasi keluaran (output) dan hasil (outcome) setelah kegiatan dilaksanakan."
    },
    potensi_inefektivitas: {
      status: "Sedang",
      alasan: "Belum ditemukan indikasi kuat penumpukan RPD atau proyeksi ketidaktercapaian target pada data yang tersedia.",
      temuan: "Data yang tersedia belum cukup untuk memastikan risiko inefektivitas secara pasti.",
      risiko: "Risiko keterlambatan atau penurunan kualitas capaian belum dapat diukur secara pasti.",
      rekomendasi: "Lengkapi data RPD triwulanan dan data realisasi untuk penilaian risiko yang lebih akurat."
    }
  };
}

export function useAnalysis() {
  return {
    ...toRefs(state),
    notificationsList,
    // Auth
    isLoggedIn,
    currentUser,
    checkSession,
    logout,
    // Utilities
    formatRupiah,
    getSroiKelayakanColor,
    showNotification,
    removeNotification,
    handleRkaFiles,
    recalculateSroiLocal,
    approveCurrentDocument,
    loadHistoricalDocIntoAnalyzer,
    downloadLaporanEvaluasi,
    getRealokasiDatabase,
    buildUsulanProporsi,
    saveRki,
    deleteRki,
    updateRkiMetadata,
    saveGptApiKey,
    deleteGptApiKey,
    runAgentAudit,
    applyAgentAction,
    saveManualVersion,
    switchRkaVersion,
    openInAgenticAi,
    openHasilPenalaranSroi,
    loadSpecificVersionIntoAnalyzer
  };
}

