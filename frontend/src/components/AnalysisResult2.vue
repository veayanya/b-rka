<template>
  <div class="sroi-result">

    <!-- ══════════ 1. HEADER ANALISIS (SUBKEG, PERANGKAT DAERAH, PROGRAM, KEGIATAN, TAHUN & PAGU ANGGARAN) ══════════ -->
    <div class="rka-hero" style="margin-bottom: 20px;">
      <!-- 1. SUBKEG -->
      <div class="rka-hero-row">
        <div class="rka-hero-label">SUBKEG</div>
        <div class="rka-hero-main-val">{{ analysis.subKegiatan || analysis.program || '-' }}</div>
      </div>

      <!-- 2. PERANGKAT DAERAH -->
      <div class="rka-hero-row">
        <div class="rka-hero-label">PERANGKAT DAERAH</div>
        <div class="rka-hero-main-val">{{ analysis.opd || analysis.perangkatDaerah || '-' }}</div>
      </div>

      <!-- 3. DUAL COLUMN: LEFT (PROGRAM, KEGIATAN, PAGU ANGGARAN) & RIGHT (TAHUN ANGGARAN CARD) -->
      <div class="rka-hero-split-grid">
        
        <!-- Kolom Kiri -->
        <div class="rka-hero-col-left">
          <div class="rka-hero-item">
            <div class="rka-hero-label">PROGRAM</div>
            <div class="rka-hero-text-val">{{ analysis.namaProgram || analysis.program || '-' }}</div>
          </div>

          <div class="rka-hero-item">
            <div class="rka-hero-label">KEGIATAN</div>
            <div class="rka-hero-text-val">{{ analysis.kegiatan || analysis.namaKegiatan || '-' }}</div>
          </div>

          <div class="rka-hero-item">
            <div class="rka-hero-label">PAGU ANGGARAN</div>
            <div class="rka-hero-text-val rka-pagu-val">{{ formatRupiah(analysis.pagu) }}</div>
          </div>
        </div>

        <!-- Kolom Kanan: TAHUN ANGGARAN & KOMPARASI TAHUN SEBELUMNYA -->
        <div class="rka-hero-col-right">
          <div class="rka-hero-label" style="margin-bottom: 8px;">TAHUN ANGGARAN</div>

          <div class="tahun-anggaran-box">
            <div class="tab-header-row">
              <span class="tab-year-title">TAHUN {{ currentYearCard.tahun }}</span>
              <span class="tab-year-badge">TAHUN BERJALAN</span>
            </div>
            <div class="tab-amount-num">{{ formatRupiah(currentYearCard.jumlah) }}</div>
            <div class="tab-delta-info" :class="currentYearCard.deltaClass">
              <span v-if="currentYearCard.hasDelta">
                <span class="tab-arrow">{{ currentYearCard.arrow }}</span>
                {{ currentYearCard.deltaLabel }} dari Tahun {{ currentYearCard.prevTahun }} ({{ currentYearCard.deltaPercent }}%)
              </span>
              <span v-else class="tab-neutral-info">
                Alokasi Definitif Tahun Anggaran {{ currentYearCard.tahun }}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ══════════ TOP GRID: RATIO CARD + CHARTS ══════════ -->
    <div class="sroi-top-grid">

      <!-- Left column -->
      <div class="sroi-left-col">
        <div class="sroi-ratio-card" :class="feasibility.tone">
          <div class="sroi-ratio-top">
            <span class="sroi-ratio-eyebrow">Rasio Kelayakan Dampak (SROI Ratio)</span>
            <span class="sroi-status-pill">{{ feasibility.label }}</span>
          </div>
          <div class="sroi-ratio-value">{{ sroi.toFixed(2) }}</div>
          <div class="sroi-ratio-formula">Rasio SROI = (Outcome − Deadweight) / Investasi</div>
          <p class="sroi-ratio-desc">
            Nilai proyeksi dampak sosial-ekonomi (Outcome)
            {{ sroi >= 1 ? 'lebih besar dari' : 'belum sebanding dengan' }}
            uang APBD yang dikeluarkan.
          </p>
        </div>

        <div class="sroi-stats-grid">
          <div class="sroi-stat-card">
            <div class="stat-label">Investasi RKA (Pagu)</div>
            <div class="stat-value">{{ formatRupiah(analysis.pagu) }}</div>
          </div>
          <div class="sroi-stat-card">
            <div class="stat-label">Proyeksi Manfaat (Outcome)</div>
            <div class="stat-value">{{ formatRupiah(analysis.outcome) }}</div>
          </div>
          <div class="sroi-stat-card">
            <div class="stat-label">Faktor Deadweight</div>
            <div class="stat-value deadweight">{{ analysis.deadweight }}%</div>
          </div>
          <div class="sroi-stat-card">
            <div class="stat-label">Nilai Manfaat Bersih</div>
            <div class="stat-value positive">{{ formatRupiah(netBenefit) }}</div>
          </div>
        </div>
        <div class="efficiency-summary-card">
          <div class="efficiency-title"><span class="icon">💡</span> Status Efisiensi per Rekening</div>
          <div class="efficiency-list">
            <div
              v-for="(item, i) in efficiencyList"
              :key="i"
              class="efficiency-list-item"
              :class="{ 'is-open': openRekeningIndexes.has(i) }"
              role="button"
              tabindex="0"
              :aria-expanded="openRekeningIndexes.has(i)"
              @click="toggleRekeningDetail(i)"
              @keydown.enter="toggleRekeningDetail(i)"
              @keydown.space.prevent="toggleRekeningDetail(i)"
            >
              <div class="efficiency-list-row">
                <span class="efficiency-item-name">{{ item.nama }}</span>
                <span class="efficiency-item-status" :class="item.class">
                  {{ item.icon }} {{ item.status }}
                </span>
                <span class="efficiency-item-chevron">{{ openRekeningIndexes.has(i) ? '▲' : '▼' }}</span>
              </div>
              <div v-if="openRekeningIndexes.has(i)" class="efficiency-item-reason">
                {{ item.alasan }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column: pie charts -->
      <div class="sroi-right-col">
        <div class="sroi-chart-panel">
          <h3><span class="chart-icon">◔</span> Distribusi Dana Anggaran RKA (Awal vs Usulan AI)</h3>

          <div class="pie-block">
            <div class="pie-block-title"><span>📄</span> Awal (PDF)</div>
            <div class="pie-canvas-wrap"><canvas ref="pieAwalEl"></canvas></div>
            <ul class="pie-legend">
              <li v-for="(item, i) in awalData" :key="'a'+i">
                <span class="dot" :style="{ background: palette[i % palette.length] }"></span>
                {{ item.nama }} ({{ item.persen }}%)
              </li>
            </ul>
          </div>

          <div class="pie-block">
            <div class="pie-block-title"><span>✨</span> Usulan AI</div>
            <div class="pie-canvas-wrap"><canvas ref="pieUsulanEl"></canvas></div>
            <ul class="pie-legend">
              <li v-for="(item, i) in usulanData" :key="'u'+i">
                <span class="dot" :style="{ background: palette[i % palette.length] }"></span>
                {{ item.nama }} ({{ item.persen }}%)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════ TAB: TEMUAN AUDIT & TARGET ══════════ -->
    <div class="tab-panel">
      <div class="info-box target-box">
        <div class="info-box-label"><span>🎯</span> Target Kuantitatif Output RKA</div>
        <div class="info-box-text">{{ analysis.targetKuantitatif }}</div>
      </div>

      <div class="info-box justifikasi-box">
        <div class="info-box-label"><span>🧭</span> Justifikasi Outcome</div>
        <div class="info-box-text">{{ analysis.justifikasiOutcome }}</div>
      </div>

      <div class="kepatuhan-section">
        <div class="kepatuhan-title">Rincian Temuan Kepatuhan &amp; SSH:</div>
        <div
          v-for="(k, i) in analysis.kepatuhanFindings"
          :key="i"
          class="kepatuhan-item"
          :class="k.status"
        >
          <span class="kepatuhan-icon">{{ k.status === 'sesuai' ? '✓' : '✕' }}</span>
          <div>
            <div class="kepatuhan-label">
              {{ k.label }} ({{ k.status === 'sesuai' ? 'Sesuai' : 'Tidak Sesuai' }})
            </div>
            <div class="kepatuhan-desc">{{ k.description }}</div>
          </div>
        </div>
      </div>

      <div class="realokasi-grid">
        <div class="realokasi-col kurangi">
          <div class="realokasi-header">
            <span>⊖</span> Kenapa Harus Dikurangi?
          </div>
          <div v-for="(j, i) in kurangiList" :key="'k'+i" class="realokasi-card">
            <div class="realokasi-top">
              <span class="realokasi-kode">{{ j.kode }}</span>
              <div class="realokasi-nilai-group" style="display: flex; align-items: center; gap: 8px;">
                <span class="realokasi-nilai-awal" v-if="j.nilai_awal" style="text-decoration: line-through; color: #888; font-size: 0.85em;">{{ formatRupiah(j.nilai_awal) }}</span>
                <span class="realokasi-nilai minus">-{{ formatRupiah(j.nilai_dikurangi) }}</span>
              </div>
            </div>
            <div class="realokasi-nama">{{ j.rekening_nama }}</div>
            <div class="realokasi-alasan">{{ j.alasan_dikurangi }}</div>
          </div>
          <p v-if="!kurangiList.length" class="realokasi-empty">Tidak ada rekomendasi pengurangan.</p>
        </div>

        <div class="realokasi-col tambah">
          <div class="realokasi-header">
            <span>⊕</span> Kenapa Harus Dialokasikan ke Sini?
          </div>
          <div v-for="(j, i) in tambahList" :key="'t'+i" class="realokasi-card">
            <div class="realokasi-top">
              <span class="realokasi-kode">{{ j.kode }}</span>
              <div class="realokasi-nilai-group" style="display: flex; align-items: center; gap: 8px;">
                <span class="realokasi-nilai-awal" v-if="j.nilai_awal" style="color: #888; font-size: 0.85em;">Awal: {{ formatRupiah(j.nilai_awal) }}</span>
                <span class="realokasi-nilai plus">+{{ formatRupiah(j.nilai_ditambah) }}</span>
              </div>
            </div>
            <div class="realokasi-nama">{{ j.rekening_nama }}</div>
            <div class="realokasi-alasan">{{ j.alasan_dialokasikan }}</div>
          </div>
          <p v-if="!tambahList.length" class="realokasi-empty">Tidak ada rekomendasi penambahan.</p>
        </div>
      </div>
    </div>



  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import {
  Chart,
  ArcElement,
  Tooltip,
  Legend,
  PieController,
} from 'chart.js';

Chart.register(ArcElement, Tooltip, Legend, PieController);

// ── Props ────────────────────────────────────────────────────────────
// Pass a real `analysis` object from your parent/composable. Sensible
// defaults (matching the sample RKA stunting-posyandu case) are provided
// so this component also renders correctly on its own.
const openRekeningIndexes = ref(new Set());
const toggleRekeningDetail = (i) => { openRekeningIndexes.value.has(i) ? openRekeningIndexes.value.delete(i) : openRekeningIndexes.value.add(i); };

const props = defineProps({
  analysis: {
    type: Object,
    default: () => ({
      model: 'GEMINI 1.5 PRO',
      pagu: 180000000,
      outcome: 260000000,
      deadweight: 15,
      opd: 'Dinas Kesehatan',
      program: 'Penurunan Stunting',
      targetKuantitatif: 'Revitalisasi 12 posyandu di daerah lokus stunting',
      justifikasiOutcome:
        'Menurunkan persentase balita stunting di 12 posyandu sebesar 15% melalui monitoring tumbuh kembang yang lebih intensif.',
      kepatuhanFindings: [
        {
          label: 'Sasaran Program',
          description: 'Target puskesmas berada di wilayah zona merah stunting.',
          status: 'sesuai',
        },
      ],
      rekeningProporsi: [
        { nama: 'Bahan Makanan Tambahan (PMT)', persen: 20 },
        { nama: 'Obat/Suplemen Zinc & Vitamin Fe', persen: 20 },
        { nama: 'Honor Kader Posyandu', persen: 20 },
        { nama: 'Transport Kunjungan Rumah (Home Visit)', persen: 20 },
        { nama: 'Konsumsi & Snack Rapat Koordinasi', persen: 2 },
        { nama: 'Cetak Spanduk & Baliho Sosialisasi', persen: 18 },
      ],
      rekeningProporsiUsulan: [
        { nama: 'Bahan Makanan Tambahan (PMT)', persen: 45.7 },
        { nama: 'Obat/Suplemen Zinc & Vitamin Fe', persen: 17.1 },
        { nama: 'Honor Kader Posyandu', persen: 16.5 },
        { nama: 'Transport Kunjungan Rumah (Home Visit)', persen: 10.7 },
        { nama: 'Konsumsi & Snack Rapat Koordinasi', persen: 0 },
        { nama: 'Cetak Spanduk & Baliho Sosialisasi', persen: 10.1 },
      ],
      reallocationJustifications: [
        {
          kode: '5.2.06.01',
          rekening_nama: 'Belanja Perjalanan Dinas Dalam Daerah',
          aksi: 'KURANGI',
          alasan_dikurangi:
            'Koordinasi lapangan rutin dapat diganti sebagian dengan rapat daring (online meeting) untuk menghemat BBM & uang harian.',
          nilai_dikurangi: 4500000,
        },
        {
          kode: '5.2.02.01',
          rekening_nama: 'Belanja Konsumsi & Snack Rapat Koordinasi',
          aksi: 'KURANGI',
          alasan_dikurangi:
            'Rapat koordinasi lintas sektor cukup dengan konsumsi standar SSH — tidak perlu catering eksternal untuk efisiensi.',
          nilai_dikurangi: 3600000,
        },
        {
          kode: '5.2.05.02',
          rekening_nama: 'Belanja Cetak Spanduk & Baliho Sosialisasi',
          aksi: 'KURANGI',
          alasan_dikurangi:
            'Edukasi gizi dapat memanfaatkan media sosial resmi Dinkes secara gratis, mengurangi kebutuhan cetak fisik.',
          nilai_dikurangi: 2700000,
        },
        {
          kode: '5.2.02.27',
          rekening_nama: 'Belanja Bahan Makanan Tambahan (PMT) Bergizi',
          aksi: 'TAMBAH',
          alasan_dialokasikan:
            'Rekening utama program — kecukupan gizi langsung menentukan capaian penurunan prevalensi stunting. Tidak boleh dikurangi.',
          nilai_ditambah: 99000000,
        },
        {
          kode: '5.2.02.13',
          rekening_nama: 'Belanja Obat & Suplemen Vitamin (Zinc, Fe)',
          aksi: 'TAMBAH',
          alasan_dialokasikan:
            'Suplemen pendukung wajib diberikan bersama PMT sesuai Permenkes No. 29/2019 tentang pencegahan stunting.',
          nilai_ditambah: 14400000,
        },
        {
          kode: '5.2.03.03',
          rekening_nama: 'Honor Kader Posyandu & Tenaga Gizi',
          aksi: 'TAMBAH',
          alasan_dialokasikan:
            'Kader posyandu adalah ujung tombak pemantauan tumbuh kembang balita — honorarium memastikan kehadiran dan konsistensi monitoring.',
          nilai_ditambah: 10800000,
        },
      ],
    }),
  },
});

// ── Formatting helpers ──────────────────────────────────────────────
const formatRupiah = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
};

// ── Core SROI math ───────────────────────────────────────────────────
// netBenefit = outcome adjusted for deadweight
// sroi = netBenefit / pagu
const netBenefit = computed(() => {
  const { outcome, deadweight } = props.analysis;
  return (outcome || 0) * (1 - (deadweight || 0) / 100);
});

const sroi = computed(() => {
  const pagu = props.analysis.pagu || 0;
  return pagu > 0 ? netBenefit.value / pagu : 0;
});

const feasibility = computed(() => {
  const s = sroi.value;
  if (s > 1.0) return { label: 'Sangat Layak (Efisien)', tone: 'tone-green' };
  if (s === 1.0) return { label: 'Impas', tone: 'tone-yellow' };
  return { label: 'Tidak Layak', tone: 'tone-red' };
});

// ── Reallocation lists ───────────────────────────────────────────────
const kurangiList = computed(() =>
  (props.analysis.reallocationJustifications || []).filter((j) => j.aksi === 'KURANGI')
);
const tambahList = computed(() =>
  (props.analysis.reallocationJustifications || []).filter((j) => j.aksi === 'TAMBAH')
);

const efficiencyList = computed(() => {
  const proporsi = props.analysis.rekeningProporsi || [];
  const reallocs = props.analysis.reallocationJustifications || [];

  return proporsi.map(rek => {
    let status = rek.status;
    let alasan = rek.alasan;

    const matchedRealloc = reallocs.find(r =>
      (r.rekening_nama && r.rekening_nama.toLowerCase().includes(rek.nama.toLowerCase())) ||
      (rek.nama && rek.nama.toLowerCase().includes(r.rekening_nama.toLowerCase()))
    );

    if (!status) {
      if (matchedRealloc) {
        if (matchedRealloc.aksi === 'KURANGI') {
          status = 'Inefisien';
        } else {
          status = 'Efisien';
        }
      } else {
        status = 'Efisien';
      }
    }

    if (!alasan) {
      if (matchedRealloc) {
        if (matchedRealloc.aksi === 'KURANGI') {
          alasan = matchedRealloc.alasan_dikurangi || 'Item belanja ini terindikasi kurang efisien dan berpotensi diefisienkan.';
        } else {
          alasan = matchedRealloc.alasan_dialokasikan || 'Alokasi anggaran belanja ini dinilai tepat untuk mendukung sasaran utama program.';
        }
      } else {
        if (status === 'Inefisien') {
          alasan = 'Alokasi belanja ini melebihi batas efisiensi operasional atau tidak sepadan dengan keluaran.';
        } else if (status === 'Belum Dapat Dinilai') {
          alasan = 'Data pembanding harga satuan atau rincian belum mencukupi untuk menilai efisiensi secara valid.';
        } else {
          alasan = 'Alokasi anggaran belanja ini dinilai wajar dan berada dalam batas efisiensi standar.';
        }
      }
    }

    let toneClass = 'tone-green';
    let icon = '✓';

    if (status === 'Inefisien') {
      toneClass = 'tone-red';
      icon = '✕';
    } else if (status === 'Belum Dapat Dinilai') {
      toneClass = 'tone-gray';
      icon = '?';
    } else {
      status = 'Efisien';
      toneClass = 'tone-green';
      icon = '✓';
    }

    return {
      nama: rek.nama,
      status: status,
      alasan: alasan,
      icon: icon,
      class: toneClass
    };
  });
});

// ── Pie chart data ───────────────────────────────────────────────────
const palette = ['var(--primary-color)', 'var(--success-color)', 'var(--warning-color)', 'var(--danger-color)', 'var(--accent-color)', 'var(--primary-color)', 'var(--border-color-strong)'];

const withLainnya = (dataset) => {
  if (!dataset || dataset.length === 0) return [];
  const sumPersen = dataset.reduce((s, d) => s + (Number(d.persen) || 0), 0);
  if (sumPersen < 99) {
    return [...dataset, { nama: 'Lainnya', persen: Number((100 - sumPersen).toFixed(1)) }];
  }
  return dataset;
};

const awalData = computed(() => withLainnya(props.analysis.rekeningProporsi || []));
const usulanData = computed(() => withLainnya(props.analysis.rekeningProporsiUsulan || []));

// Kartu Tahun Anggaran Berjalan (Hero Header)
const currentYearCard = computed(() => {
  const list = [...(props.analysis.anggaranTahunan || [])].sort((a, b) => Number(a.tahun) - Number(b.tahun));
  const targetYear = Number(props.analysis.tahunRencana || props.analysis.tahun || new Date().getFullYear());
  
  let targetItem = list.find(a => Number(a.tahun) === targetYear);
  let targetIdx = targetItem ? list.indexOf(targetItem) : -1;
  
  if (!targetItem && list.length > 0) {
    targetItem = list[list.length - 1];
    targetIdx = list.length - 1;
  }
  
  const currentNominal = targetItem ? Number(targetItem.jumlah) : (Number(props.analysis.pagu) || 0);
  const currentYear = targetItem ? targetItem.tahun : targetYear;
  
  // Previous year comparison
  const prevItem = (targetIdx > 0) ? list[targetIdx - 1] : (list.length > 1 && list[0].tahun !== currentYear ? list[0] : null);
  
  if (prevItem && Number(prevItem.jumlah) > 0) {
    const diff = currentNominal - Number(prevItem.jumlah);
    const pct = ((diff / Number(prevItem.jumlah)) * 100).toFixed(1);
    return {
      tahun: currentYear,
      jumlah: currentNominal,
      hasDelta: true,
      prevTahun: prevItem.tahun,
      diff: diff,
      arrow: diff >= 0 ? '▲' : '▼',
      deltaClass: diff >= 0 ? 'delta-up' : 'delta-down',
      deltaLabel: (diff >= 0 ? '+Rp ' : '-Rp ') + Math.abs(diff).toLocaleString('id-ID'),
      deltaPercent: (diff >= 0 ? '+' : '') + pct
    };
  }
  
  return {
    tahun: currentYear,
    jumlah: currentNominal,
    hasDelta: false,
    prevTahun: null,
    deltaClass: 'delta-neutral',
    deltaLabel: '',
    deltaPercent: ''
  };
});

// ── Chart.js instances ───────────────────────────────────────────────
const pieAwalEl = ref(null);
const pieUsulanEl = ref(null);
let pieAwalChart = null;
let pieUsulanChart = null;

const buildPieConfig = (dataset) => ({
  type: 'pie',
  data: {
    labels: dataset.map((d) => d.nama),
    datasets: [
      {
        data: dataset.map((d) => d.persen),
        backgroundColor: dataset.map((_, i) => palette[i % palette.length]),
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.raw}%`,
        },
      },
    },
  },
});

const renderCharts = () => {
  if (pieAwalChart) pieAwalChart.destroy();
  if (pieUsulanChart) pieUsulanChart.destroy();

  if (pieAwalEl.value) {
    pieAwalChart = new Chart(pieAwalEl.value, buildPieConfig(awalData.value));
  }
  if (pieUsulanEl.value) {
    pieUsulanChart = new Chart(pieUsulanEl.value, buildPieConfig(usulanData.value));
  }
};

onMounted(() => nextTick(renderCharts));
onBeforeUnmount(() => {
  if (pieAwalChart) pieAwalChart.destroy();
  if (pieUsulanChart) pieUsulanChart.destroy();
});
watch([awalData, usulanData], () => nextTick(renderCharts));

// ── Tabs ─────────────────────────────────────────────────────────────
const activeTab = ref('temuan');

// ── JSON output tab ──────────────────────────────────────────────────
const prettyJson = computed(() =>
  JSON.stringify(
    {
      sroi_ratio: Number(sroi.value.toFixed(2)),
      status_kelayakan: feasibility.value.label,
      investasi_pagu: props.analysis.pagu,
      proyeksi_outcome: props.analysis.outcome,
      faktor_deadweight_persen: props.analysis.deadweight,
      nilai_manfaat_bersih: Math.round(netBenefit.value),
      target_kuantitatif: props.analysis.targetKuantitatif,
      justifikasi_outcome: props.analysis.justifikasiOutcome,
      temuan_kepatuhan: props.analysis.kepatuhanFindings,
      rekomendasi_realokasi: props.analysis.reallocationJustifications,
    },
    null,
    2
  )
);

const copied = ref(false);
const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(prettyJson.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch (e) {
    console.error('Gagal menyalin JSON:', e);
  }
};
</script>

<style scoped>
/* ══════ 1. Header Analisis (Hero matching user specification) ══════ */
.rka-hero {
  background: #0c2340;
  border-radius: var(--radius-lg);
  padding: 24px 28px;
  color: #ffffff;
  box-shadow: 0 8px 24px rgba(12, 35, 64, 0.25);
  display: flex;
  flex-direction: column;
  gap: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.rka-hero-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rka-hero-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #93c5fd;
}

.rka-hero-main-val {
  font-size: 18px;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.35;
}

.rka-hero-split-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 24px;
  align-items: flex-end;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

@media (max-width: 960px) {
  .rka-hero-split-grid {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
}

.rka-hero-col-left {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rka-hero-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.rka-hero-text-val {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.4;
}

.rka-pagu-val {
  font-size: 18px;
  font-weight: 800;
  color: #6ee7b7;
}

.rka-hero-col-right {
  display: flex;
  flex-direction: column;
}

/* Tahun Anggaran Card */
.tahun-anggaran-box {
  background: #f0fdf4;
  border: 1.5px solid #86efac;
  border-radius: 10px;
  padding: 16px 20px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.tab-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.tab-year-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #475569;
  text-transform: uppercase;
}

.tab-year-badge {
  background: #16a34a;
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 12px;
  letter-spacing: 0.04em;
}

.tab-amount-num {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 6px;
  letter-spacing: -0.01em;
}

.tab-delta-info {
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tab-delta-info.delta-up {
  color: #16a34a;
}

.tab-delta-info.delta-down {
  color: #dc2626;
}

.tab-delta-info.delta-neutral {
  color: #64748b;
}

.tab-arrow {
  font-size: 11px;
}

.sroi-result {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--text-primary);
  width: 100%;
}

/* Header */
.sroi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}
.sroi-header-left { display: flex; align-items: center; gap: 10px; }
.sroi-header-icon { color: var(--primary-color); font-size: 18px; }
.sroi-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
.model-badge {
  background: var(--success-glow);
  color: var(--success-color);
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  letter-spacing: 0.03em;
}

/* Top grid */
.sroi-top-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 20px;
}
@media (max-width: 900px) {
  .sroi-top-grid { grid-template-columns: 1fr; }
}

.sroi-left-col { display: flex; flex-direction: column; gap: 16px; }

/* Ratio card */
.sroi-ratio-card {
  border-radius: 14px;
  padding: 24px;
  color: #fff;
  background: linear-gradient(135deg, var(--success-hover), var(--success-hover));
}
.sroi-ratio-card.tone-yellow { background: linear-gradient(135deg, var(--warning-color), var(--warning-hover)); }
.sroi-ratio-card.tone-red { background: linear-gradient(135deg, var(--danger-color), var(--danger-hover)); }

.sroi-ratio-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.sroi-ratio-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.9;
}
.sroi-status-pill {
  background: rgba(255, 255, 255, 0.22);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}
.sroi-ratio-value { font-size: 48px; font-weight: 800; line-height: 1; margin: 6px 0 10px; }
.sroi-ratio-formula { font-size: 12px; opacity: 0.85; margin-bottom: 10px; }
.sroi-ratio-desc { font-size: 13px; font-weight: 600; margin: 0; line-height: 1.4; }

/* Stat mini-cards */
.sroi-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.sroi-stat-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px 16px;
}
.stat-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.stat-value { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.stat-value.deadweight { color: var(--danger-color); }
.stat-value.positive { color: var(--success-hover); }

.efficiency-summary-card {
  background: var(--bg-primary);
  border: 1px dashed var(--border-color-strong);
  border-radius: 10px;
  padding: 16px;
  margin-top: 4px;
}
.efficiency-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.efficiency-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 4px;
}
.efficiency-list::-webkit-scrollbar {
  width: 4px;
}
.efficiency-list::-webkit-scrollbar-thumb {
  background: var(--border-color-strong);
  border-radius: 4px;
}
.efficiency-list-item {
  padding: 6px 6px 8px;
  margin: 0 -6px;
  border-bottom: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.efficiency-list-item:hover {
  background: var(--bg-primary);
}
.efficiency-list-item:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
.efficiency-list-item.is-open {
  background: var(--bg-primary);
}
.efficiency-list-item:last-child {
  border-bottom: none;
  padding-bottom: 6px;
}
.efficiency-list-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.efficiency-item-name {
  font-size: 12px;
  color: var(--text-primary);
  flex: 1;
  padding-right: 10px;
  line-height: 1.3;
}
.efficiency-item-status {
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 12px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}
.efficiency-item-chevron {
  font-size: 9px;
  color: var(--text-muted);
  margin-left: 8px;
  flex-shrink: 0;
}
.efficiency-item-reason {
  font-size: 11.5px;
  color: var(--text-secondary);
  line-height: 1.45;
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 10px;
  margin-top: 8px;
}
.efficiency-item-status.tone-red {
  background: var(--danger-glow);
  color: var(--danger-color);
}
.efficiency-item-status.tone-green {
  background: var(--success-glow);
  color: var(--success-color);
}
.efficiency-item-status.tone-blue {
  background: var(--info-glow);
  color: var(--info-hover);
}

/* Chart panel */
.sroi-chart-panel {
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 18px;
  height: 100%;
}
.sroi-chart-panel h3 {
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.chart-icon { color: var(--primary-color); }

.pie-block { margin-bottom: 22px; }
.pie-block:last-child { margin-bottom: 0; }
.pie-block-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 8px;
}
.pie-canvas-wrap { position: relative; height: 170px; margin: 0 auto; max-width: 220px; }
.pie-legend { list-style: none; margin: 10px 0 0; padding: 0; font-size: 11.5px; color: var(--text-secondary); }
.pie-legend li { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* Tabs */
.sroi-tabs {
  display: flex;
  gap: 4px;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color);
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.tab-btn.active { color: var(--primary-hover); border-bottom-color: var(--primary-hover); }
.tab-icon { font-size: 12px; }

.tab-panel { padding: 20px; }

/* Info boxes */
.info-box {
  background: var(--bg-primary);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.info-box-label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.info-box-text { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.justifikasi-box .info-box-label,
.justifikasi-box .info-box-text { background: var(--info-glow); }
.justifikasi-box { background: var(--info-glow); }

/* Kepatuhan */
.kepatuhan-section { margin-bottom: 20px; }
.kepatuhan-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; }
.kepatuhan-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--success-color);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 8px;
}
.kepatuhan-item:not(.sesuai) { border-left-color: var(--danger-color); }
.kepatuhan-icon { color: var(--success-color); font-weight: 700; }
.kepatuhan-item:not(.sesuai) .kepatuhan-icon { color: var(--danger-color); }
.kepatuhan-label { font-size: 13px; font-weight: 700; }
.kepatuhan-desc { font-size: 12.5px; color: var(--text-muted); margin-top: 2px; }

/* Realokasi grid */
.realokasi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 900px) {
  .realokasi-grid { grid-template-columns: 1fr; }
}
.realokasi-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 10px;
}
.realokasi-col.kurangi .realokasi-header { background: var(--danger-glow); color: var(--danger-color); }
.realokasi-col.tambah .realokasi-header { background: var(--success-glow); color: var(--success-color); }

.realokasi-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
}
.realokasi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.realokasi-kode { font-family: monospace; font-size: 11.5px; color: var(--text-muted); }
.realokasi-nama { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.realokasi-alasan { font-size: 12px; color: var(--text-muted); line-height: 1.4; }
.realokasi-nilai { font-size: 13px; font-weight: 700; }
.realokasi-nilai.minus { color: var(--danger-color); }
.realokasi-nilai.plus { color: var(--success-hover); }
.realokasi-empty { font-size: 12px; color: var(--text-muted); font-style: italic; }

/* JSON tab */
.json-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.json-toolbar-label { font-size: 12px; color: var(--text-muted); }
.btn-copy-json {
  background: var(--primary-hover);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.json-output {
  background: var(--text-primary);
  color: #a5f3fc;
  border-radius: 10px;
  padding: 16px;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>