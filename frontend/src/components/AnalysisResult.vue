<template>
  <div class="sroi-result">

    <!-- ══════════ TOP BAR ══════════ -->
    <div class="sroi-header">
      <div class="sroi-header-left">
        <span class="sroi-header-icon">✦</span>
        <h2>Analisis RKA</h2>
        <div v-if="analysisVersions.length > 1" class="version-selector-wrap">
          <span class="version-label">Versi:</span>
          <select v-model="selectedVersionId" class="sroi-version-select" @change="onSwitchVersion">
            <option v-for="v in analysisVersions" :key="v.versionId" :value="v.versionId">
              {{ v.versionName }}
            </option>
          </select>
        </div>
        <span v-else-if="analysis.selectedVersionName" class="model-badge version-pill">
          {{ analysis.selectedVersionName }}
        </span>
      </div>

      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <button 
          class="btn-open-agentic" 
          @click="handleOpenAgentic"
          title="Buka dokumen ini di Agentic AI Studio untuk audit mendalam, validasi SSH & efisiensi, dan koreksi data"
        >
          <i data-lucide="bot"></i> Agentic AI Studio
        </button>
        <button 
          class="btn btn-save-rka"
          @click="handleSave"
          :disabled="isSaving"
          title="Simpan data ini ke server agar tidak hilang"
          style="display: flex; align-items: center; gap: 5px; padding: 6px 14px; font-size: 12px; background: var(--primary-color, #2563eb); color: #fff; border: none; border-radius: 7px; cursor: pointer; font-weight: 600;"
        >
          <i data-lucide="save" style="width:14px;height:14px;"></i>
          {{ isSaving ? 'Menyimpan...' : 'Simpan' }}
        </button>
        <button 
          class="btn btn-delete-rka"
          @click="showDeleteConfirm = true"
          title="Hapus dokumen ini dari arsip"
          style="display: flex; align-items: center; gap: 5px; padding: 6px 14px; font-size: 12px; background: #ef4444; color: #fff; border: none; border-radius: 7px; cursor: pointer; font-weight: 600;"
        >
          <i data-lucide="trash-2" style="width:14px;height:14px;"></i> Hapus
        </button>
        <span v-if="analysis.model" class="model-badge">{{ analysis.model }}</span>
        <button class="btn btn-secondary btn-sm" @click="goBack" style="display: flex; align-items: center; gap: 4px; padding: 6px 12px; font-size: 12px;">
          <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i> Kembali ke Arsip
        </button>
      </div>
    </div>

    <!-- ══ MODAL KONFIRMASI HAPUS ══ -->
    <div v-if="showDeleteConfirm" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;">
      <div style="background:var(--bg-card,#fff);border-radius:14px;padding:32px 28px;max-width:420px;width:90%;box-shadow:0 8px 40px rgba(0,0,0,0.18);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <i data-lucide="alert-triangle" style="color:#ef4444;width:24px;height:24px;"></i>
          <h3 style="margin:0;font-size:1.1rem;color:var(--text-primary,#111);">Hapus Dokumen RKA</h3>
        </div>
        <p style="margin:0 0 8px;color:var(--text-secondary,#555);font-size:0.9rem;">
          Dokumen <strong>{{ analysis.subKegiatan || analysis.program || analysis.id }}</strong> akan dihapus secara permanen dari arsip.
        </p>
        <p style="margin:0 0 22px;color:#ef4444;font-size:0.82rem;">Data yang telah dihapus tidak dapat dikembalikan.</p>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button @click="showDeleteConfirm = false" style="padding:8px 18px;border-radius:7px;border:1px solid var(--border-color,#ddd);background:transparent;cursor:pointer;font-size:0.88rem;">Batal</button>
          <button @click="handleDelete" style="padding:8px 18px;border-radius:7px;background:#ef4444;color:#fff;border:none;cursor:pointer;font-size:0.88rem;font-weight:600;">Ya, Hapus</button>
        </div>
      </div>
    </div>

    <div class="sroi-body">

      <!-- ══════════ 1. HEADER ANALISIS (SUBKEG, PERANGKAT DAERAH, PROGRAM, KEGIATAN, TAHUN & PAGU ANGGARAN) ══════════ -->
      <div class="rka-hero">
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
              <div class="pagu-anggaran-box">
                <div class="tab-amount-num">{{ formatRupiah(currentYearCard.jumlah) }}</div>
                <div class="tab-delta-info" :class="currentYearCard.deltaClass" v-if="currentYearCard.hasDelta">
                  <span class="tab-arrow">{{ currentYearCard.arrow }}</span>
                  {{ currentYearCard.deltaLabel }} dari Tahun {{ currentYearCard.prevTahun }} ({{ currentYearCard.deltaPercent }}%)
                </div>
              </div>
            </div>
          </div>

          <!-- Kolom Kanan: TAHUN ANGGARAN -->
          <div class="rka-hero-col-right">
            <div class="rka-hero-label" style="margin-bottom: 8px;">TAHUN ANGGARAN</div>

            <div class="tahun-anggaran-plain">
              <span class="tahun-anggaran-year">TAHUN {{ currentYearCard.tahun }}</span>
              <span v-if="currentYearCard.isTahunBerjalan" class="tab-year-badge">TAHUN BERJALAN</span>
            </div>
          </div>

        </div>
      </div>

      <!-- ══════════ 2. INDIKATOR & TARGET KINERJA ══════════ -->
      <div class="rka-section">
        <div class="rka-section-title"><span class="icon-badge">📊</span> Indikator &amp; Target Kinerja</div>
        <div class="rka-section-sub">Tolok ukur dan target capaian kinerja pada dokumen RKA/DPA ini</div>
        <div class="indikator-anggaran-card">
          <p
            v-if="!hasIndikatorKinerja && !hasAnggaranTahunan"
            class="indikator-empty"
          >
            Data indikator kinerja &amp; anggaran per tahun belum tersedia untuk dokumen ini.
            Ini biasanya terjadi pada dokumen yang dianalisis sebelum fitur ini ditambahkan —
            silakan unggah &amp; analisis ulang PDF-nya agar datanya terekstrak.
          </p>

          <div class="indikator-grid" v-else>
            <!-- Target Kinerja per Indikator -->
            <div class="indikator-col target-col">
              <div class="indikator-col-header">
                <span>🎯</span> Target Kinerja per Indikator
              </div>
              <div
                v-for="(row, i) in analysis.indikatorKinerja"
                :key="'ik' + i"
                class="indikator-item-card"
              >
                <div class="indikator-item-top">
                  <span class="indikator-item-level">{{ row.level }}</span>
                  <span class="indikator-item-target">{{ row.target }}</span>
                </div>
                <div class="indikator-item-nama">{{ row.tolok_ukur }}</div>
              </div>
              <p v-if="!hasIndikatorKinerja" class="indikator-empty">
                Tabel Indikator &amp; Tolok Ukur Kinerja tidak ditemukan pada dokumen ini.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════ 3. ANALISIS KESESUAIAN ANGGARAN & OUTCOME ══════════ -->
      <div class="rka-section">
        <div class="rka-section-title"><span class="icon-badge">🧭</span> Analisis Kesesuaian Anggaran dengan Target Kinerja</div>
        <div class="rka-section-sub">Kesesuaian anggaran terhadap target kinerja, beserta justifikasi outcome sosial-ekonomi</div>

        <!-- Kesesuaian Anggaran Tahun Berjalan vs Target Kinerja -->
        <div v-if="kesesuaian" class="kesesuaian-card" :class="kesesuaianClass">
          <div class="kesesuaian-top">
            <span class="kesesuaian-icon">{{ kesesuaianIcon }}</span>
            <span class="kesesuaian-title">Kesesuaian Anggaran Tahun {{ analysis.tahunRencana }} dengan Target Kinerja</span>
            <span class="kesesuaian-status-pill">{{ kesesuaian.status }}</span>
          </div>
          <p class="kesesuaian-penjelasan">{{ kesesuaian.penjelasan }}</p>
          <p v-if="kesesuaian.estimasi_biaya_per_output" class="kesesuaian-estimasi">
            <span>📐</span> Estimasi biaya per output: <strong>{{ kesesuaian.estimasi_biaya_per_output }}</strong>
          </p>
          <div v-if="kesesuaian.proyeksi_pencapaian_target" class="proyeksi-target-box" :class="proyeksiClass">
            <div class="proyeksi-target-top">
              <span class="proyeksi-target-icon">{{ proyeksiIcon }}</span>
              <span class="proyeksi-target-label">Apakah anggaran ini akan menyentuh target?</span>
              <span class="proyeksi-target-pill">{{ kesesuaian.proyeksi_pencapaian_target }}</span>
            </div>
            <p v-if="kesesuaian.alasan_proyeksi_target" class="proyeksi-target-alasan">{{ kesesuaian.alasan_proyeksi_target }}</p>
          </div>
        </div>

        <!-- Justifikasi Outcome -->
        <div class="justifikasi-card">
          <div class="justifikasi-label">Justifikasi Outcome</div>
          <p class="justifikasi-text">{{ analysis.justifikasiOutcome }}</p>
        </div>
      </div>

      <!-- ══════════ 4. ANALISIS KOMPONEN BELANJA & REKOMENDASI BELANJA ══════════ -->
      <div class="rka-section">
        <div class="rka-section-title"><span class="icon-badge">⚖️</span> Analisis Komponen Belanja &amp; Rekomendasi Belanja</div>
        <div class="rka-section-sub">Komposisi belanja &amp; status efisiensi berdampingan dengan rekomendasi realokasi dari AI</div>

        <div class="belanja-rekomendasi-grid">

          <!-- Kolom Kiri: ANALISIS KOMPONEN BELANJA -->
          <div class="belanja-col">
            <div class="belanja-col-header"><span>📄</span> Analisis Komponen Belanja</div>


            <div class="chart-card chart-card--fit">
              <div class="pie-canvas-wrap"><canvas ref="pieAwalEl"></canvas></div>
              <ul class="pie-legend">
                <li v-for="(item, i) in awalData" :key="'a'+i">
                  <span class="dot" :style="{ background: palette[i % palette.length] }"></span>
                  <span class="legend-name">{{ item.nama }}</span>
                  <span class="legend-pct">{{ item.persen }}%</span>
                </li>
              </ul>
            </div>

            <div class="belanja-subblock-label">Status Efisiensi per Rekening</div>
            <div class="efficiency-summary-card efficiency-summary-card--fit">
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
                    {{ item.detail }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Kolom Kanan: REKOMENDASI BELANJA -->
          <div class="belanja-col">
            <div class="belanja-col-header accent-ai"><span>✨</span> Rekomendasi Belanja</div>


            <div class="chart-card chart-card--fit">
              <div class="pie-canvas-wrap"><canvas ref="pieUsulanEl"></canvas></div>
              <ul class="pie-legend">
                <li v-for="(item, i) in usulanData" :key="'u'+i">
                  <span class="dot" :style="{ background: palette[i % palette.length] }"></span>
                  <span class="legend-name">{{ item.nama }}</span>
                  <span class="legend-pct">{{ item.persen }}%</span>
                </li>
              </ul>
            </div>

            <div class="belanja-subblock-label">Alasan Pengurangan &amp; Realokasi Anggaran</div>
            <div class="realokasi-stack">
              <div class="realokasi-col kurangi">
                <div class="realokasi-header">
                  <span>⊖</span> Kenapa Harus Dikurangi?
                </div>
                <div v-for="(j, i) in kurangiList" :key="'k'+i" class="realokasi-card">
                  <div class="realokasi-top">
                    <span class="realokasi-kode">{{ j.kode }}</span>
                    <div class="realokasi-nilai-group">
                      <span class="realokasi-nilai-awal" v-if="j.nilai_awal">{{ formatRupiah(j.nilai_awal) }}</span>
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
                    <div class="realokasi-nilai-group">
                      <span class="realokasi-nilai-awal" v-if="j.nilai_awal">Awal: {{ formatRupiah(j.nilai_awal) }}</span>
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
      </div>

      <!-- ══════════ 5. WIDGET SROI RATIO (PENUTUP ANALISIS) ══════════ -->
      <div class="rka-section">
        <div class="rka-section-title"><span class="icon-badge">🏆</span>Rasio SROI</div>
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
      </div>

      <!-- ══════════ PENUTUP INTI ANALISIS — Rasio SROI di atas menutup alur: Informasi RKA →
           Indikator & Target → Kesesuaian & Outcome → Komponen Belanja & Rekomendasi → Rasio SROI.
           Bagian di bawah ini adalah lampiran pendukung (kepatuhan, jadwal pencairan, evaluasi rinci). ══════════ -->
      <div class="rka-supplement-divider">
        <span>Lampiran Analisis Pendukung</span>
      </div>

      <!-- ══════════ 6. JADWAL PENARIKAN DANA (RPD) ══════════ -->
      <div class="rka-section" v-if="analysis.rpdSchedule">
        <div class="rka-section-title"><span class="icon-badge">📅</span> Jadwal Penarikan Dana (RPD) Triwulanan</div>
        <div class="rpd-display-grid">
          <div class="rpd-display-card">
            <div class="rpd-card-q">Triwulan I (Q1)</div>
            <div class="rpd-card-pct">{{ analysis.rpdSchedule.Q1 || 20 }}%</div>
            <div class="rpd-card-rp">{{ formatRupiah(((analysis.pagu || 0) * (analysis.rpdSchedule.Q1 || 20)) / 100) }}</div>
          </div>
          <div class="rpd-display-card">
            <div class="rpd-card-q">Triwulan II (Q2)</div>
            <div class="rpd-card-pct">{{ analysis.rpdSchedule.Q2 || 30 }}%</div>
            <div class="rpd-card-rp">{{ formatRupiah(((analysis.pagu || 0) * (analysis.rpdSchedule.Q2 || 30)) / 100) }}</div>
          </div>
          <div class="rpd-display-card">
            <div class="rpd-card-q">Triwulan III (Q3)</div>
            <div class="rpd-card-pct">{{ analysis.rpdSchedule.Q3 || 35 }}%</div>
            <div class="rpd-card-rp">{{ formatRupiah(((analysis.pagu || 0) * (analysis.rpdSchedule.Q3 || 35)) / 100) }}</div>
          </div>
          <div class="rpd-display-card">
            <div class="rpd-card-q">Triwulan IV (Q4)</div>
            <div class="rpd-card-pct">{{ analysis.rpdSchedule.Q4 || 15 }}%</div>
            <div class="rpd-card-rp">{{ formatRupiah(((analysis.pagu || 0) * (analysis.rpdSchedule.Q4 || 15)) / 100) }}</div>
          </div>
        </div>
      </div>

      <!-- ══════════ 7. RINGKASAN EFEKTIF & INEFEKTIF PER REKENING ══════════ -->
      <div class="rka-section">
        <div class="rka-section-title"><span class="icon-badge">📊</span> Ringkasan Efektif &amp; Inefektif per Rekening</div>
        <div class="rka-section-sub">Klasifikasi efektivitas belanja untuk setiap rekening, berdasarkan proporsi alokasi dan rekomendasi realokasi AI.</div>

        <!-- Strip ringkasan jumlah rekening -->
        <div class="efektivitas-summary-strip">
          <div class="efektivitas-summary-pill tone-green">
            <span class="efektivitas-summary-count">{{ efektifRekeningList.length }}</span>
            <span class="efektivitas-summary-label">Rekening Efektif</span>
            <span class="efektivitas-summary-sub" v-if="efektifPersenTotal">≈ {{ efektifPersenTotal.toFixed(1) }}% dari pagu</span>
          </div>
          <div class="efektivitas-summary-pill tone-red">
            <span class="efektivitas-summary-count">{{ tidakEfektifRekeningList.length }}</span>
            <span class="efektivitas-summary-label">Rekening Tidak Efektif</span>
            <span class="efektivitas-summary-sub" v-if="tidakEfektifPersenTotal">≈ {{ tidakEfektifPersenTotal.toFixed(1) }}% dari pagu</span>
          </div>
          <div class="efektivitas-summary-pill tone-gray" v-if="belumDinilaiRekeningList.length">
            <span class="efektivitas-summary-count">{{ belumDinilaiRekeningList.length }}</span>
            <span class="efektivitas-summary-label">Belum Dapat Dinilai</span>
          </div>
        </div>

        <p v-if="!rekeningEfektivitas.length" class="indikator-empty">
          Data rincian rekening belanja belum tersedia untuk dokumen ini, sehingga ringkasan efektivitas per rekening belum dapat ditampilkan.
        </p>

        <!-- Dua kolom: Efektif vs Tidak Efektif / Perlu Perhatian -->
        <div class="efektivitas-grid" v-else>
          <div class="efektivitas-col efektif">
            <div class="efektivitas-col-header">
              <span>✓</span> Efektif
            </div>
            <div v-for="(r, i) in efektifRekeningList" :key="'ef'+i" class="efektivitas-card tone-green">
              <div class="efektivitas-card-top">
                <span class="efektivitas-card-nama">{{ r.nama }}</span>
                <span class="efektivitas-card-persen" v-if="r.persen !== null">{{ r.persen }}%</span>
              </div>
              <p class="efektivitas-card-alasan">{{ r.alasan }}</p>
            </div>
            <p v-if="!efektifRekeningList.length" class="realokasi-empty">Belum ada rekening yang terklasifikasi efektif.</p>
          </div>

          <div class="efektivitas-col tidak-efektif">
            <div class="efektivitas-col-header">
              <span>✕</span> Tidak Efektif / Perlu Perhatian
            </div>
            <div v-for="(r, i) in tidakEfektifRekeningList" :key="'tef'+i" class="efektivitas-card tone-red">
              <div class="efektivitas-card-top">
                <span class="efektivitas-card-nama">{{ r.nama }}</span>
                <span class="efektivitas-card-persen" v-if="r.persen !== null">{{ r.persen }}%</span>
              </div>
              <p class="efektivitas-card-alasan">{{ r.alasan }}</p>
            </div>
            <div v-for="(r, i) in belumDinilaiRekeningList" :key="'bd'+i" class="efektivitas-card tone-gray">
              <div class="efektivitas-card-top">
                <span class="efektivitas-card-nama">{{ r.nama }}</span>
                <span class="efektivitas-card-badge">Belum Dapat Dinilai</span>
              </div>
              <p class="efektivitas-card-alasan">{{ r.alasan }}</p>
            </div>
            <p v-if="!tidakEfektifRekeningList.length && !belumDinilaiRekeningList.length" class="realokasi-empty">Tidak ada rekening yang terklasifikasi tidak efektif.</p>
          </div>
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
  DoughnutController,
} from 'chart.js';

// PERBAIKAN: Chart.js tree-shaken build WAJIB mendaftarkan komponen secara eksplisit.
// Tanpa Chart.register(), Chart.js tidak mengetahui cara menggambar pie/doughnut,
// sehingga canvas tetap kosong meski data sudah ada.
Chart.register(ArcElement, Tooltip, Legend, PieController, DoughnutController);
import { useAnalysis } from '../composables/useAnalysis';

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

const { currentTab, rkis, openInAgenticAi, loadSpecificVersionIntoAnalyzer, saveRki, deleteRki } = useAnalysis();

const isSaving = ref(false);
const showDeleteConfirm = ref(false);

const goBack = () => {
  currentTab.value = 'history';
};

const handleSave = async () => {
  isSaving.value = true;
  try {
    await saveRki(matchedRka.value || props.analysis);
  } finally {
    isSaving.value = false;
  }
};

const handleDelete = async () => {
  showDeleteConfirm.value = false;
  const id = props.analysis?.id;
  if (!id) return;
  await deleteRki(id);
  currentTab.value = 'history';
};

const selectedVersionId = ref(props.analysis?.activeVersionId || 'v1.0');

const matchedRka = computed(() => {
  return rkis.value?.find(r => r.id === props.analysis?.id) || props.analysis;
});

const analysisVersions = computed(() => {
  return matchedRka.value?.versions || [];
});

watch(() => props.analysis, (newVal) => {
  if (newVal?.activeVersionId) {
    selectedVersionId.value = newVal.activeVersionId;
  }
}, { deep: true, immediate: true });

const onSwitchVersion = () => {
  if (matchedRka.value && selectedVersionId.value) {
    loadSpecificVersionIntoAnalyzer(matchedRka.value, selectedVersionId.value);
  }
};

const handleOpenAgentic = () => {
  openInAgenticAi(matchedRka.value);
};



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

    // ── Penjelasan detail (lebih panjang dari `alasan` ringkas di atas) ──
    // Dipakai pada "Status Efisiensi per Rekening" agar uraiannya lebih lengkap
    // daripada kartu ringkasan di "Ringkasan Efektif & Inefektif per Rekening".
    // Disusun dari data nyata: kode & nominal rekening (rekeningProporsi), serta
    // uraian lengkap alasan_dikurangi/alasan_dialokasikan & nilainya dari
    // reallocationJustifications — tanpa data tambahan yang dikarang.
    const persenNum = (rek.persen !== undefined && rek.persen !== null) ? Number(rek.persen) : null;
    const nilaiNum = (rek.nilai !== undefined && rek.nilai !== null) ? Number(rek.nilai) : null;

    const kontribusiParts = [];
    if (rek.kode) kontribusiParts.push(`kode rekening ${rek.kode}`);
    if (persenNum !== null) kontribusiParts.push(`berkontribusi ${persenNum}% dari total pagu`);
    if (nilaiNum !== null) kontribusiParts.push(`senilai ${formatRupiah(nilaiNum)}`);
    const kontribusiSentence = kontribusiParts.length
      ? `${rek.nama} (${kontribusiParts.join(', ')}).`
      : `${rek.nama}.`;

    let rekomendasiSentence = '';
    if (matchedRealloc) {
      if (matchedRealloc.aksi === 'KURANGI') {
        const nilaiKurang = matchedRealloc.nilai_dikurangi ? formatRupiah(matchedRealloc.nilai_dikurangi) : null;
        rekomendasiSentence = `Rekomendasi AI: kurangi alokasi ini${nilaiKurang ? ' sebesar ' + nilaiKurang : ''}. ${matchedRealloc.alasan_dikurangi || ''}`.trim();
      } else {
        const nilaiTambah = matchedRealloc.nilai_ditambah ? formatRupiah(matchedRealloc.nilai_ditambah) : null;
        rekomendasiSentence = `Rekomendasi AI: tambahkan alokasi ini${nilaiTambah ? ' sebesar ' + nilaiTambah : ''}. ${matchedRealloc.alasan_dialokasikan || ''}`.trim();
      }
    } else if (status === 'Inefisien') {
      rekomendasiSentence = 'Alokasi belanja ini melebihi batas efisiensi operasional yang wajar dibandingkan keluaran (output) yang dihasilkan, sehingga berpotensi mengurangi ruang fiskal bagi belanja utama program.';
    } else if (status === 'Belum Dapat Dinilai') {
      rekomendasiSentence = 'Data pembanding harga satuan, volume, atau rincian teknis rekening ini belum mencukupi untuk menilai tingkat efisiensinya secara valid. Diperlukan kelengkapan data lebih lanjut sebelum kesimpulan efisiensi dapat ditarik.';
    } else {
      rekomendasiSentence = 'Alokasi anggaran pada rekening ini dinilai wajar, sepadan dengan keluaran (output) yang ditargetkan, dan berada dalam batas efisiensi standar SSH/SBM yang berlaku, sehingga tidak memerlukan penyesuaian pada tahap ini.';
    }

    const detail = `${kontribusiSentence} ${rekomendasiSentence}`.trim();

    return {
      nama: rek.nama,
      kode: rek.kode || null,
      persen: persenNum,
      nilai: nilaiNum,
      status: status,
      alasan: alasan,
      detail: detail,
      icon: icon,
      class: toneClass
    };
  });
});

// ── Ringkasan Efektif & Inefektif per Rekening ────────────────────────
// Diturunkan langsung dari efficiencyList (rekeningProporsi + reallocationJustifications
// hasil analisis dokumen yang sesungguhnya) — tidak ada data efektivitas fiktif/hardcode.
// Status efisiensi per rekening dipetakan menjadi label efektivitas belanja:
//   Efisien -> Efektif · Inefisien -> Tidak Efektif · Belum Dapat Dinilai -> tetap.
const rekeningEfektivitas = computed(() => {
  return efficiencyList.value.map((item) => {
    let label = 'Efektif';
    let tone = 'tone-green';
    let icon = '✓';
    if (item.status === 'Inefisien') {
      label = 'Tidak Efektif';
      tone = 'tone-red';
      icon = '✕';
    } else if (item.status === 'Belum Dapat Dinilai') {
      label = 'Belum Dapat Dinilai';
      tone = 'tone-gray';
      icon = '?';
    }
    return { ...item, label, tone, icon };
  });
});

const efektifRekeningList = computed(() =>
  rekeningEfektivitas.value.filter((r) => r.label === 'Efektif')
);
const tidakEfektifRekeningList = computed(() =>
  rekeningEfektivitas.value.filter((r) => r.label === 'Tidak Efektif')
);
const belumDinilaiRekeningList = computed(() =>
  rekeningEfektivitas.value.filter((r) => r.label === 'Belum Dapat Dinilai')
);

// Ringkasan persentase pagu yang berjalan efektif vs tidak efektif, dihitung dari
// kolom `persen` rekeningProporsi milik masing-masing rekening (bukan angka tebakan).
const efektifPersenTotal = computed(() =>
  efektifRekeningList.value.reduce((sum, r) => sum + (r.persen || 0), 0)
);
const tidakEfektifPersenTotal = computed(() =>
  tidakEfektifRekeningList.value.reduce((sum, r) => sum + (r.persen || 0), 0)
);

// ── Indikator & Tolok Ukur Kinerja vs Anggaran Tahun Berjalan ────────
const hasIndikatorKinerja = computed(
  () => Array.isArray(props.analysis.indikatorKinerja) && props.analysis.indikatorKinerja.length > 0
);
const hasAnggaranTahunan = computed(
  () => Array.isArray(props.analysis.anggaranTahunan) && props.analysis.anggaranTahunan.length > 0
);
const anggaranTahunBerjalan = computed(() => {
  const list = props.analysis.anggaranTahunan || [];
  const match = list.find((a) => Number(a.tahun) === Number(props.analysis.tahunRencana));
  return match ? match.jumlah : props.analysis.pagu;
});

// Anggaran per tahun diurutkan + delta (naik/turun) vs tahun sebelumnya,
// supaya tampil sebagai kartu visual (bukan JSON) mirip gaya kartu Kurangi/Tambah.
const anggaranTahunanSorted = computed(() => {
  const list = [...(props.analysis.anggaranTahunan || [])].sort(
    (a, b) => Number(a.tahun) - Number(b.tahun)
  );
  return list.map((a, i) => {
    const prev = i > 0 ? list[i - 1] : null;
    if (!prev || !prev.jumlah) {
      return { ...a, prevJumlah: null, prevTahun: null, deltaLabel: '', deltaClass: '', deltaPercent: '' };
    }
    const diff = Number(a.jumlah) - Number(prev.jumlah);
    const percent = ((diff / Number(prev.jumlah)) * 100).toFixed(1);
    return {
      ...a,
      prevJumlah: null,
      prevTahun: prev.tahun,
      deltaLabel: (diff >= 0 ? '+' : '-') + formatRupiah(Math.abs(diff)),
      deltaClass: diff >= 0 ? 'up' : 'down',
      deltaPercent: (diff >= 0 ? '+' : '') + percent
    };
  });
});

// Kartu Tahun Anggaran (Hero Header) — SELALU dari hasil parsing dokumen RKA, tidak boleh hardcode/asumsi
const currentYearCard = computed(() => {
  const list = [...(props.analysis.anggaranTahunan || [])].sort((a, b) => Number(a.tahun) - Number(b.tahun));

  // Ambil tahun HANYA dari hasil parsing dokumen. Jika tidak ada, fallback terakhir adalah entri
  // terbaru pada anggaranTahunan hasil parsing — tidak pernah menebak tahun sistem/saat ini.
  const rawYear = props.analysis.tahunRencana || props.analysis.tahun ||
    (list.length > 0 ? list[list.length - 1].tahun : null);
  const targetYear = rawYear !== null && rawYear !== undefined && rawYear !== '' ? Number(rawYear) : null;

  let targetItem = targetYear !== null ? list.find(a => Number(a.tahun) === targetYear) : null;
  let targetIdx = targetItem ? list.indexOf(targetItem) : -1;

  if (!targetItem && list.length > 0 && targetYear === null) {
    targetItem = list[list.length - 1];
    targetIdx = list.length - 1;
  }

  const hasYearData = !!(targetItem || targetYear !== null);
  const currentYear = targetItem ? targetItem.tahun : targetYear;
  const currentNominal = targetItem ? Number(targetItem.jumlah) : (Number(props.analysis.pagu) || 0);

  // Badge "TAHUN BERJALAN" hanya tampil jika tahun dari dokumen sama persis dengan tahun sistem saat ini
  const systemYear = new Date().getFullYear();
  const isTahunBerjalan = hasYearData && Number(currentYear) === systemYear;

  // Previous year comparison
  const prevItem = (targetIdx > 0) ? list[targetIdx - 1] : (list.length > 1 && list[0].tahun !== currentYear ? list[0] : null);

  if (hasYearData && prevItem && Number(prevItem.jumlah) > 0) {
    const diff = currentNominal - Number(prevItem.jumlah);
    const pct = ((diff / Number(prevItem.jumlah)) * 100).toFixed(1);
    return {
      tahun: currentYear,
      jumlah: currentNominal,
      hasDelta: true,
      hasYearData,
      isTahunBerjalan,
      prevTahun: prevItem.tahun,
      diff: diff,
      arrow: diff >= 0 ? '▲' : '▼',
      deltaClass: diff >= 0 ? 'delta-up' : 'delta-down',
      deltaLabel: (diff >= 0 ? '+Rp ' : '-Rp ') + Math.abs(diff).toLocaleString('id-ID'),
      deltaPercent: (diff >= 0 ? '+' : '') + pct
    };
  }
  
  return {
    tahun: hasYearData ? currentYear : '-',
    jumlah: currentNominal,
    hasDelta: false,
    hasYearData,
    isTahunBerjalan,
    prevTahun: null,
    deltaClass: 'delta-neutral',
    deltaLabel: '',
    deltaPercent: ''
  };
});

const kesesuaian = computed(() => props.analysis.kesesuaianAnggaran || null);
const kesesuaianClass = computed(() => {
  const status = kesesuaian.value?.status || '';
  if (status === 'Sesuai') return 'ok';
  if (status === 'Tidak Sesuai') return 'bad';
  if (status === 'Perlu Perhatian') return 'warn';
  return 'unknown';
});
const kesesuaianIcon = computed(() => {
  const map = { ok: '✓', bad: '✕', warn: '⚠', unknown: '?' };
  return map[kesesuaianClass.value] || '?';
});
const proyeksiClass = computed(() => {
  const verdict = kesesuaian.value?.proyeksi_pencapaian_target || '';
  if (verdict === 'Target Kemungkinan Tercapai') return 'ok';
  if (verdict === 'Diproyeksikan Tidak Tercapai') return 'bad';
  if (verdict === 'Berisiko Tidak Tercapai') return 'warn';
  return 'unknown';
});
const proyeksiIcon = computed(() => {
  const map = { ok: '🎯', bad: '⛔', warn: '⚠', unknown: '?' };
  return map[proyeksiClass.value] || '🎯';
});

// ── Pie chart data ───────────────────────────────────────────────────
// `palette` (CSS var() strings) dipakai untuk styling titik legenda di HTML —
// itu didukung oleh inline style browser. Canvas 2D milik Chart.js TIDAK bisa
// meresolusi string "var(--x)" sebagai warna, sehingga wedge pie chart gagal
// tergambar (blank). `chartPalette` di bawah meresolusi nilai HEX asli dari
// tema aktif (light/dark) khusus untuk dipakai Chart.js.
const palette = ['var(--primary-color)', 'var(--success-color)', 'var(--warning-color)', 'var(--danger-color)', 'var(--accent-color)', 'var(--primary-color)', 'var(--border-color-strong)'];

const resolveCssVar = (varName, fallback) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
};

const buildChartPalette = () => [
  resolveCssVar('--primary-color', '#0E6B5E'),
  resolveCssVar('--success-color', '#2FC98E'),
  resolveCssVar('--warning-color', '#F0AC42'),
  resolveCssVar('--danger-color', '#F0708A'),
  resolveCssVar('--accent-color', '#DC7A2A'),
  resolveCssVar('--info-color', '#2E9587'),
  resolveCssVar('--border-color-strong', '#C7DEDA'),
];

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

// ── Chart.js instances ───────────────────────────────────────────────
const pieAwalEl = ref(null);
const pieUsulanEl = ref(null);
let pieAwalChart = null;
let pieUsulanChart = null;

const buildPieConfig = (dataset, chartPalette) => ({
  type: 'pie',
  data: {
    labels: dataset.map((d) => d.nama),
    datasets: [
      {
        data: dataset.map((d) => Number(d.persen) || 0),
        backgroundColor: dataset.map((_, i) => chartPalette[i % chartPalette.length]),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverBorderWidth: 3,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { animateRotate: true, duration: 600 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.raw}%`,
        },
      },
    },
  },
});

const renderCharts = () => {
  if (pieAwalChart) pieAwalChart.destroy();
  if (pieUsulanChart) pieUsulanChart.destroy();

  const chartPalette = buildChartPalette();

  if (pieAwalEl.value && awalData.value.length) {
    pieAwalChart = new Chart(pieAwalEl.value, buildPieConfig(awalData.value, chartPalette));
  }
  if (pieUsulanEl.value && usulanData.value.length) {
    pieUsulanChart = new Chart(pieUsulanEl.value, buildPieConfig(usulanData.value, chartPalette));
  }
};

// Render setelah DOM ter-update (nextTick) DAN dua frame rAF berurutan agar
// kontainer grid dua-kolom benar-benar sudah memiliki lebar final sebelum
// Chart.js mengukur canvas — satu rAF sering tidak cukup saat elemen berada
// di dalam CSS Grid yang baru di-mount.
const renderChartsNextFrame = () => {
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        renderCharts();
      });
    });
  });
};

// Handler resize disimpan agar bisa di-remove saat unmount (cegah memory leak)
const onWindowResize = () => {
  if (pieAwalChart) pieAwalChart.resize();
  if (pieUsulanChart) pieUsulanChart.resize();
};

onMounted(() => {
  renderChartsNextFrame();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onWindowResize);
  }
});

onBeforeUnmount(() => {
  if (pieAwalChart) { pieAwalChart.destroy(); pieAwalChart = null; }
  if (pieUsulanChart) { pieUsulanChart.destroy(); pieUsulanChart = null; }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onWindowResize);
  }
});

watch([awalData, usulanData], renderChartsNextFrame);

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
.sroi-result {
  --c-navy: #123a70;
  --c-navy-deep: #0c2851;
  --c-navy-light: var(--info-glow);
  --c-navy-soft: var(--info-glow);
  --c-gray-50: var(--bg-primary);
  --c-gray-100: var(--bg-tertiary);
  --c-gray-200: var(--border-color);
  --c-gray-400: var(--text-muted);
  --c-gray-500: var(--text-muted);
  --c-gray-700: var(--text-primary);
  --c-gray-900: var(--text-primary);
  --c-green: var(--success-hover);
  --c-green-bg: var(--success-glow);
  --c-green-text: var(--success-color);
  --c-red: var(--danger-hover);
  --c-red-bg: var(--danger-glow);
  --c-red-text: var(--danger-color);
  --c-yellow: var(--warning-hover);
  --c-yellow-bg: var(--warning-glow);
  --c-yellow-text: var(--warning-hover);
  --radius-lg: 16px;
  --radius-md: 12px;
  --shadow-soft: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.06);

  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--c-gray-900);
  width: 100%;
}

.sroi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--c-gray-200);
  flex-wrap: wrap;
  gap: 12px;
}
.sroi-header-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.sroi-header-icon { color: var(--c-navy); font-size: 18px; }
.sroi-header h2 { font-size: 16px; font-weight: 700; margin: 0; color: var(--c-navy-deep); }

.version-selector-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-tertiary);
  padding: 3px 8px;
  border-radius: 8px;
  border: 1px solid var(--border-color-strong);
}

.version-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
}

.sroi-version-select {
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 700;
  color: var(--info-color);
  outline: none;
  cursor: pointer;
}

.version-pill {
  background: var(--info-glow);
  color: var(--info-color);
  font-weight: 700;
}

.btn-open-agentic {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, var(--accent-color), var(--success-hover));
  color: #ffffff;
  border: none;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(16, 163, 127, 0.3);
  transition: all 0.2s;
}

.btn-open-agentic:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.model-badge {
  background: var(--c-green-bg);
  color: var(--c-green-text);
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  letter-spacing: 0.03em;
}

.sroi-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* ══════ Section title helper ══════ */
.rka-section-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--c-navy-deep);
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.icon-badge {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--c-navy-light);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}
.rka-section-sub {
  font-size: 12.5px;
  color: var(--c-gray-500);
  margin: 2px 0 14px;
}
.rka-section > .chart-card,
.rka-section > .justifikasi-card,
.rka-section > .efficiency-summary-card,
.rka-section > .realokasi-grid,
.rka-section > .kepatuhan-section,
.rka-section > .sroi-ratio-card {
  margin-top: 14px;
}

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

.rka-hero-col-right {
  display: flex;
  flex-direction: column;
}

/* Kotak nominal PAGU ANGGARAN — aksen hijau retro-modern */
.pagu-anggaran-box {
  background: #f0fdf4;
  border: 1.5px solid #86efac;
  border-radius: 10px;
  padding: 14px 18px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  width: fit-content;
}

.tab-amount-num {
  font-size: 22px;
  font-weight: 800;
  color: #15803d;
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

/* TAHUN ANGGARAN — mengikuti gaya font field lain (bold, putih) */
.tahun-anggaran-plain {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tahun-anggaran-year {
  font-size: 18px;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.35;
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

/* Status pill color variants */
.status-approved { background: rgba(74, 222, 128, 0.22); border-color: rgba(74, 222, 128, 0.4); }
.status-draft { background: rgba(255, 255, 255, 0.16); }
.status-rejected,
.status-ditolak { background: rgba(248, 113, 113, 0.24); border-color: rgba(248, 113, 113, 0.4); }

/* ══════ 3. Justifikasi AI ══════ */
.justifikasi-card {
  background: var(--c-navy-soft);
  border: 1px solid var(--info-glow);
  border-radius: var(--radius-md);
  padding: 16px 18px;
}
.justifikasi-label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--c-navy);
  margin-bottom: 8px;
}
.justifikasi-text {
  font-size: 13.5px;
  color: var(--c-gray-700);
  line-height: 1.6;
  margin: 0;
}

/* ══════ 4 & 6. Chart cards (Grafik Analisis / Rekomendasi Belanja) ══════ */
.chart-card {
  background: #fff;
  border: 1px solid var(--c-gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  padding: 22px;
  max-width: 380px;
}
.pie-block-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--c-gray-700);
  text-align: center;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.pie-block-title.accent-ai { color: var(--accent-color, #DC7A2A); }
.pie-canvas-wrap { position: relative; width: 100%; height: 190px; margin: 0 auto; max-width: 230px; }
.pie-legend { list-style: none; margin: 14px 0 0; padding: 0; font-size: 12px; color: var(--c-gray-700); }
.pie-legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px dashed var(--c-gray-200);
}
.pie-legend li:last-child { border-bottom: none; }
.legend-name { flex: 1; }
.legend-pct { font-weight: 700; color: var(--c-gray-900); }
.dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

/* ══════ 5. Status Efisiensi ══════ */
.efficiency-summary-card {
  background: var(--c-gray-50);
  border: 1px dashed var(--border-color-strong);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
}
.efficiency-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-gray-700);
  margin-bottom: 12px;
}
.efficiency-list { display: flex; flex-direction: column; gap: 0; }
.efficiency-list-item {
  padding: 10px 8px;
  margin: 0 -8px;
  border-bottom: 1px solid var(--c-gray-200);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.efficiency-list-item:hover { background: #fff; }
.efficiency-list-item:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
.efficiency-list-item.is-open { background: #fff; }
.efficiency-list-item:last-child { border-bottom: none; padding-bottom: 10px; }
.efficiency-list-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.efficiency-item-name { font-size: 12.5px; color: var(--c-gray-700); flex: 1; line-height: 1.35; }
.efficiency-item-status {
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}
.efficiency-item-status.tone-red { background: var(--c-red-bg); color: var(--c-red-text); }
.efficiency-item-status.tone-green { background: var(--c-green-bg); color: var(--c-green-text); }
.efficiency-item-status.tone-blue { background: var(--info-glow); color: var(--info-hover); }
.efficiency-item-chevron {
  font-size: 9px;
  color: var(--c-gray-500, var(--text-muted));
  flex-shrink: 0;
}
.efficiency-item-reason {
  font-size: 11.5px;
  color: var(--c-gray-700);
  line-height: 1.5;
  background: var(--c-gray-50);
  border: 1px solid var(--c-gray-200);
  border-radius: 8px;
  padding: 9px 11px;
  margin-top: 10px;
}

/* ══════ 7. Realokasi grid ══════ */
.realokasi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
@media (max-width: 900px) {
  .realokasi-grid { grid-template-columns: 1fr; }
}
.realokasi-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 20px;
  margin-bottom: 12px;
}
.realokasi-col.kurangi .realokasi-header { background: var(--c-red-bg); color: var(--c-red-text); }
.realokasi-col.tambah .realokasi-header { background: var(--c-green-bg); color: var(--c-green-text); }

.realokasi-card {
  background: #fff;
  border: 1px solid var(--c-gray-200);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
  padding: 14px 16px;
  margin-bottom: 10px;
}
.realokasi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.realokasi-kode { font-family: monospace; font-size: 11.5px; color: var(--c-gray-500); }
.realokasi-nilai-group { display: flex; align-items: center; gap: 8px; }
.realokasi-nilai-awal { text-decoration: line-through; color: var(--c-gray-400); font-size: 11.5px; }
.realokasi-col.tambah .realokasi-nilai-awal { text-decoration: none; }
.realokasi-nama { font-size: 13px; font-weight: 700; margin-bottom: 4px; color: var(--c-gray-900); }
.realokasi-alasan { font-size: 12px; color: var(--c-gray-500); line-height: 1.5; }
.realokasi-nilai { font-size: 13px; font-weight: 700; }
.realokasi-nilai.minus { color: var(--c-red); }
.realokasi-nilai.plus { color: var(--c-green); }
.realokasi-empty { font-size: 12px; color: var(--c-gray-400); font-style: italic; }

/* ══════ 4. Analisis Komponen Belanja & Rekomendasi Belanja (dua kolom berdampingan) ══════ */
.belanja-rekomendasi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
  align-items: start;
  margin-top: 14px;
}
@media (max-width: 900px) {
  .belanja-rekomendasi-grid { grid-template-columns: 1fr; }
}
.belanja-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.belanja-col-header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 800;
  color: var(--c-navy-deep);
  padding-bottom: 10px;
  margin-bottom: 4px;
  border-bottom: 2px solid var(--c-gray-200);
}
.belanja-col-header.accent-ai { color: var(--accent-color, #DC7A2A); border-bottom-color: rgba(220,122,42,0.18); }
.belanja-subblock-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--c-gray-500);
  margin: 14px 0 8px;
}
.belanja-col .chart-card--fit {
  max-width: none;
  width: 100%;
  padding: 18px;
}
.belanja-col .efficiency-summary-card--fit {
  max-width: none;
  width: 100%;
}
.realokasi-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Divider antara inti analisis (ditutup Rasio SROI) & lampiran pendukung */
.rka-supplement-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0;
  color: var(--c-gray-400);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.rka-supplement-divider::before,
.rka-supplement-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--c-gray-200);
}

/* ══════ 8. Widget SROI Ratio ══════ */
.sroi-ratio-card {
  border-radius: var(--radius-lg);
  padding: 26px 28px;
  color: #fff;
  background: linear-gradient(135deg, var(--success-hover), var(--success-hover));
  box-shadow: var(--shadow-soft);
}
.sroi-ratio-card.tone-yellow { background: linear-gradient(135deg, var(--warning-color), var(--warning-hover)); }
.sroi-ratio-card.tone-red { background: linear-gradient(135deg, var(--danger-color), var(--danger-hover)); }
.sroi-ratio-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
}
.sroi-ratio-value { font-size: 52px; font-weight: 800; line-height: 1; margin: 8px 0 12px; }
.sroi-ratio-formula { font-size: 12px; opacity: 0.85; margin-bottom: 10px; }
.sroi-ratio-desc { font-size: 13.5px; font-weight: 600; margin: 0; line-height: 1.45; max-width: 620px; }

.sroi-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 16px;
}
@media (max-width: 900px) {
  .sroi-stats-grid { grid-template-columns: repeat(2, 1fr); }
}
.sroi-stat-card {
  background: var(--c-gray-50);
  border: 1px solid var(--c-gray-200);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}
.stat-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--c-gray-500);
  margin-bottom: 6px;
}
.stat-value { font-size: 18px; font-weight: 700; color: var(--c-gray-900); }
.stat-value.deadweight { color: var(--c-red); }
.stat-value.positive { color: var(--c-green); }

/* ══════ 9. Tabel Temuan Kepatuhan SSH ══════ */
.kepatuhan-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.kepatuhan-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: var(--c-gray-50);
  border: 1px solid var(--c-gray-200);
  border-left: 4px solid var(--c-green);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}
.kepatuhan-item:not(.sesuai) { border-left-color: var(--c-red); }
.kepatuhan-icon {
  color: #fff;
  background: var(--c-green);
  font-weight: 700;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  margin-top: 1px;
}
.kepatuhan-item:not(.sesuai) .kepatuhan-icon { background: var(--c-red); }
.kepatuhan-label { font-size: 13px; font-weight: 700; color: var(--c-gray-900); }
.kepatuhan-desc { font-size: 12.5px; color: var(--c-gray-500); margin-top: 3px; line-height: 1.5; }

/* ══════ 10. Jadwal Penarikan Dana (RPD) ══════ */
.rpd-display-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
@media (max-width: 900px) {
  .rpd-display-grid { grid-template-columns: repeat(2, 1fr); }
}
.rpd-display-card {
  background: var(--c-gray-50);
  border: 1px solid var(--c-gray-200);
  border-radius: var(--radius-md);
  padding: 16px;
  text-align: center;
}
.rpd-card-q {
  font-size: 11px;
  font-weight: 700;
  color: var(--c-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}
.rpd-card-pct {
  font-size: 24px;
  font-weight: 800;
  color: var(--info-color);
  margin-bottom: 4px;
}
.rpd-card-rp {
  font-size: 12px;
  font-weight: 700;
  color: var(--c-gray-700);
}

/* ══════ 2. Indikator & Tolok Ukur Kinerja vs Anggaran Tahun Berjalan ══════ */
.indikator-anggaran-card {
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 18px 20px;
  margin-top: 14px;
}

/* Single-column layout: kolom "Anggaran Dikeluarkan per Tahun" telah dihapus dari section ini */
.indikator-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
.indikator-col-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 10px;
}
.target-col .indikator-col-header { background: var(--info-glow); color: var(--info-hover); }
.anggaran-col .indikator-col-header { background: var(--success-glow); color: var(--success-color); }

.indikator-item-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
}
.indikator-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.indikator-item-level {
  font-family: monospace;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.indikator-item-target {
  font-size: 13px;
  font-weight: 700;
  color: #4338ca;
  white-space: nowrap;
}
.indikator-item-nama {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.4;
}
.tahun-tag-inline {
  background: var(--success-hover);
  color: #fff;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}
.indikator-empty {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  margin: 0;
}

/* Kartu Anggaran per Tahun — gaya visual mirip kartu Kurangi/Tambah */
.anggaran-year-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  background: #fff;
}
.anggaran-year-card.is-current-year {
  border-color: var(--success-hover);
  background: var(--success-glow);
}
.anggaran-year-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.anggaran-year-label {
  font-family: monospace;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.anggaran-year-body { display: flex; align-items: baseline; gap: 8px; }
.anggaran-year-jumlah { font-size: 16px; font-weight: 700; color: var(--success-color); }
.anggaran-year-delta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 9px;
  border-radius: 7px;
  width: fit-content;
}
.anggaran-year-delta.up { color: var(--success-color); background: var(--success-glow); }
.anggaran-year-delta.down { color: var(--danger-color); background: var(--danger-glow); }
.delta-arrow { font-size: 10px; }

.indikator-anggaran-note {
  font-size: 12px;
  color: var(--text-muted);
  margin: 14px 0 0;
  line-height: 1.5;
}
.indikator-anggaran-note strong { color: var(--text-primary); }

/* Analisis Kesesuaian Anggaran Tahun Berjalan vs Target Kinerja */
.kesesuaian-card {
  margin-top: 14px;
  border-radius: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}
.kesesuaian-card.ok { border-color: var(--success-color); background: var(--success-glow); }
.kesesuaian-card.warn { border-color: var(--warning-glow); background: var(--warning-glow); }
.kesesuaian-card.bad { border-color: var(--danger-glow); background: var(--danger-glow); }
.kesesuaian-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.kesesuaian-icon { font-size: 15px; font-weight: 700; }
.kesesuaian-card.ok .kesesuaian-icon { color: var(--success-hover); }
.kesesuaian-card.warn .kesesuaian-icon { color: var(--warning-hover); }
.kesesuaian-card.bad .kesesuaian-icon { color: var(--danger-hover); }
.kesesuaian-title { font-size: 13px; font-weight: 700; color: var(--text-primary); flex: 1; }
.kesesuaian-status-pill {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--border-color);
  color: var(--text-primary);
}
.kesesuaian-card.ok .kesesuaian-status-pill { background: var(--success-glow); color: var(--success-color); }
.kesesuaian-card.warn .kesesuaian-status-pill { background: var(--warning-glow); color: var(--warning-color); }
.kesesuaian-card.bad .kesesuaian-status-pill { background: var(--danger-glow); color: var(--danger-color); }
.kesesuaian-penjelasan { font-size: 12.5px; color: var(--text-primary); line-height: 1.55; margin: 0 0 6px; }
.kesesuaian-estimasi { font-size: 12px; color: var(--text-muted); margin: 0; }
.kesesuaian-estimasi strong { color: var(--text-primary); }

/* Proyeksi Capaian Target — apakah anggaran akan menyentuh target */
.proyeksi-target-box {
  margin-top: 10px;
  border-radius: 10px;
  padding: 10px 12px;
  border: 1px dashed var(--border-color-strong);
  background: #fff;
}
.proyeksi-target-box.ok { border-color: var(--success-color); background: var(--success-glow); }
.proyeksi-target-box.warn { border-color: var(--warning-glow); background: var(--warning-glow); }
.proyeksi-target-box.bad { border-color: var(--danger-color); background: var(--danger-glow); }
.proyeksi-target-top {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.proyeksi-target-icon { font-size: 13px; }
.proyeksi-target-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); flex: 1; }
.proyeksi-target-pill {
  font-size: 10.5px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--border-color);
  color: var(--text-primary);
  white-space: nowrap;
}
.proyeksi-target-box.ok .proyeksi-target-pill { background: var(--success-glow); color: var(--success-color); }
.proyeksi-target-box.warn .proyeksi-target-pill { background: var(--warning-glow); color: var(--warning-color); }
.proyeksi-target-box.bad .proyeksi-target-pill { background: var(--danger-glow); color: var(--danger-color); }
.proyeksi-target-alasan { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 6px 0 0; }

/* ══════ 8. Ringkasan Efektif & Inefektif per Rekening ══════ */
.efektivitas-summary-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
}
.efektivitas-summary-pill {
  flex: 1;
  min-width: 150px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-radius: 12px;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  background: #fff;
}
.efektivitas-summary-pill.tone-green { border-color: var(--success-color); background: var(--success-glow); }
.efektivitas-summary-pill.tone-red { border-color: var(--danger-color); background: var(--danger-glow); }
.efektivitas-summary-pill.tone-gray { border-color: var(--border-color-strong); background: var(--bg-tertiary); }
.efektivitas-summary-count {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--text-primary);
}
.efektivitas-summary-pill.tone-green .efektivitas-summary-count { color: var(--success-color); }
.efektivitas-summary-pill.tone-red .efektivitas-summary-count { color: var(--danger-color); }
.efektivitas-summary-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-secondary);
}
.efektivitas-summary-sub {
  font-size: 10.5px;
  color: var(--text-muted);
}

.efektivitas-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 16px;
}
@media (max-width: 900px) {
  .efektivitas-grid { grid-template-columns: 1fr; }
}
.efektivitas-col-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 20px;
  margin-bottom: 12px;
}
.efektivitas-col.efektif .efektivitas-col-header { background: var(--success-glow); color: var(--success-color); }
.efektivitas-col.tidak-efektif .efektivitas-col-header { background: var(--danger-glow); color: var(--danger-color); }

.efektivitas-card {
  background: #fff;
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--border-color-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
  padding: 12px 14px;
  margin-bottom: 10px;
}
.efektivitas-card.tone-green { border-left-color: var(--success-color); }
.efektivitas-card.tone-red { border-left-color: var(--danger-color); }
.efektivitas-card.tone-gray { border-left-color: var(--border-color-strong); }
.efektivitas-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.efektivitas-card-nama { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.efektivitas-card-persen { font-size: 12px; font-weight: 700; color: var(--text-muted); white-space: nowrap; }
.efektivitas-card-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  white-space: nowrap;
}
.efektivitas-card-alasan { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin: 0; }
</style>

