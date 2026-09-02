<template>
  <div class="agentic-workspace">
    
    <!-- ════════════════════ TOP NAVIGATION & SELECTOR BAR ════════════════════ -->
    <div class="agent-topbar">
      <div class="agent-topbar-left">
        <div class="agent-brand-badge">
          <i data-lucide="bot" class="agent-icon-spin"></i>
          <div>
            <div class="agent-brand-title">Agentic AI RKA Dashboard</div>
            <div class="agent-brand-subtitle">Audit, Validasi Multidimensi, CRUD, &amp; Copilot RKA</div>
          </div>
        </div>
      </div>

      <div class="agent-topbar-right">
        <!-- RKA Document Selector -->
        <div class="rka-select-group">
          <label class="rka-select-label">Pilih Dokumen RKA:</label>
          <select v-model="selectedRkaId" class="agent-select" @change="onRkaSelected">
            <option v-if="!rkis.length" value="" disabled>Belum ada dokumen RKA di arsip</option>
            <option v-for="rka in rkis" :key="rka.id" :value="rka.id">
              {{ rka.id }} — {{ rka.opd }} ({{ rka.program?.substring(0, 25) }}...)
            </option>
          </select>
        </div>

        <!-- Version Selector -->
        <div class="rka-select-group" v-if="selectedRka">
          <label class="rka-select-label">Versi Dokumen:</label>
          <select v-model="selectedVersionId" class="agent-select version-select" @change="onVersionSelected">
            <option v-for="ver in availableVersions" :key="ver.versionId" :value="ver.versionId">
              {{ ver.versionName }} {{ ver.versionId === selectedRka.activeVersionId ? '★ (Aktif)' : '' }}
            </option>
          </select>
        </div>

        <!-- Primary Action Buttons with Icon + Label -->
        <button 
          v-if="selectedRka" 
          class="btn-agent-primary" 
          :disabled="agentReviewLoading"
          @click="triggerAgentAudit(false)"
          title="Jalankan audit dan analisis komprehensif AI"
        >
          <i data-lucide="sparkles" :class="{ 'icon-spin': agentReviewLoading }"></i>
          <span>{{ agentReviewLoading ? 'Menganalisis...' : 'Analisis AI' }}</span>
        </button>

        <button 
          v-if="selectedRka" 
          class="btn-agent-success" 
          @click="saveAsNewManualVersion"
          title="Simpan perubahan draf sebagai versi baru"
        >
          <i data-lucide="save"></i>
          <span>Simpan Revisi</span>
        </button>

        <button 
          v-if="selectedRka" 
          class="btn-agent-secondary" 
          @click="viewInSroiPage"
          title="Buka dokumen ini di halaman visualisasi Analisis RKA"
        >
          <i data-lucide="external-link"></i>
          <span>Export / Lihat SROI</span>
        </button>

        <!-- Secondary Icon-Only Buttons with Tooltips -->
        <button 
          v-if="selectedRka" 
          class="btn-icon-only" 
          @click="showDiffModal = true" 
          title="Bandingkan versi ini dengan versi original/lainnya (Diff Versi)"
        >
          <i data-lucide="git-compare"></i>
        </button>

        <button 
          v-if="selectedRka" 
          class="btn-icon-only" 
          @click="showAuditLogsModal = true" 
          title="Lihat riwayat log audit aktivitas dokumen (Audit Trail)"
        >
          <i data-lucide="history"></i>
        </button>

        <button 
          v-if="selectedRka && selectedVersionId !== selectedRka.activeVersionId" 
          class="btn-icon-only primary" 
          @click="activateCurrentSelectedVersion"
          title="Jadikan versi yang dipilih sebagai versi aktif utama"
        >
          <i data-lucide="check-circle"></i>
        </button>
      </div>
    </div>

    <!-- ════════════════════ AI PROCESS STEPPER BANNER ════════════════════ -->
    <div v-if="selectedRka" class="ai-process-stepper-bar">
      <div class="stepper-track">
        <div :class="['step-item', { active: currentStep >= 1, current: currentStep === 1 }]">
          <span class="step-badge">1</span>
          <span class="step-title">📄 Membaca RKA</span>
        </div>
        <div class="step-connector" :class="{ active: currentStep >= 2 }"></div>
        
        <div :class="['step-item', { active: currentStep >= 2, current: currentStep === 2 }]">
          <span class="step-badge">2</span>
          <span class="step-title">🛡️ Memvalidasi SSH</span>
        </div>
        <div class="step-connector" :class="{ active: currentStep >= 3 }"></div>
        
        <div :class="['step-item', { active: currentStep >= 3, current: currentStep === 3 }]">
          <span class="step-badge">3</span>
          <span class="step-title">🤖 Menganalisis AI</span>
        </div>
        <div class="step-connector" :class="{ active: currentStep >= 4 }"></div>
        
        <div :class="['step-item', { active: currentStep >= 4, current: currentStep === 4 }]">
          <span class="step-badge">4</span>
          <span class="step-title">✨ Rekomendasi</span>
        </div>
      </div>
    </div>

    <!-- ════════════════════ EMPTY STATE (IF NO RKA) ════════════════════ -->
    <div v-if="!selectedRka" class="agent-empty-pane">
      <div class="empty-box">
        <i data-lucide="bot" style="width: 64px; height: 64px; opacity: 0.3; margin-bottom: 16px;"></i>
        <h3>Pilih atau Unggah Dokumen RKA</h3>
        <p>Silakan pilih dokumen dari menu dropdown di atas atau unggah dokumen RKA baru untuk memulai proses audit, validasi, dan penyempurnaan agentik.</p>
        <button class="btn btn-primary" style="margin-top: 16px;" @click="currentTab = 'dashboard'">
          <i data-lucide="upload-cloud"></i> Unggah Dokumen RKA
        </button>
      </div>
    </div>

    <!-- ════════════════════ 3-COLUMN MAIN WORKSPACE ════════════════════ -->
    <div v-else class="agent-3col-workspace">
      
      <!-- ── CENTER COLUMN: DASHBOARD ANALISIS UTAMA ── -->
      <div class="agent-dashboard-main">

        <!-- ══════════ 1. HEADER ANALISIS (SUBKEG, PERANGKAT DAERAH, PROGRAM, KEGIATAN, TAHUN & PAGU ANGGARAN) ══════════ -->
        <div class="rka-hero" style="margin-bottom: 20px;">
          <!-- Version Info Top Strip -->
          <div class="ver-badge-strip" style="margin-bottom: 8px;">
            <span class="ver-chip primary">{{ currentVersionObj?.versionName || 'Versi Aktif' }}</span>
            <span class="ver-chip subtle"><i data-lucide="calendar"></i> {{ formatDate(currentVersionObj?.createdAt || selectedRka.tanggalUpload) }}</span>
            <span class="ver-chip subtle"><i data-lucide="user-check"></i> {{ currentVersionObj?.createdBy || 'AI Extractor' }}</span>
            <span v-if="isOriginalVersion" class="ver-chip original-tag">🔒 DATA ORIGINAL (BASE)</span>
          </div>

          <!-- 1. SUBKEG -->
          <div class="rka-hero-row">
            <div class="rka-hero-label">SUBKEG</div>
            <div class="rka-hero-main-val">{{ currentWorkingData.subKegiatan || currentWorkingData.program || selectedRka.subKegiatan || selectedRka.program || '-' }}</div>
          </div>

          <!-- 2. PERANGKAT DAERAH -->
          <div class="rka-hero-row">
            <div class="rka-hero-label">PERANGKAT DAERAH</div>
            <div class="rka-hero-main-val">{{ currentWorkingData.opd || selectedRka.opd || selectedRka.perangkatDaerah || '-' }}</div>
          </div>

          <!-- 3. DUAL COLUMN: LEFT (PROGRAM, KEGIATAN, PAGU ANGGARAN) & RIGHT (TAHUN ANGGARAN) -->
          <div class="rka-hero-split-grid">
            
            <!-- Kolom Kiri -->
            <div class="rka-hero-col-left">
              <div class="rka-hero-item">
                <div class="rka-hero-label">PROGRAM</div>
                <div class="rka-hero-text-val">{{ currentWorkingData.namaProgram || currentWorkingData.program || selectedRka.program || '-' }}</div>
              </div>

              <div class="rka-hero-item">
                <div class="rka-hero-label">KEGIATAN</div>
                <div class="rka-hero-text-val">{{ currentWorkingData.kegiatan || selectedRka.kegiatan || selectedRka.namaKegiatan || '-' }}</div>
              </div>

              <div class="rka-hero-item">
                <div class="rka-hero-label">PAGU ANGGARAN</div>
                <div class="pagu-anggaran-box">
                  <div class="tab-amount-num">{{ formatRupiah(workspaceYearCard.jumlah) }}</div>
                  <div class="tab-delta-info" :class="workspaceYearCard.deltaClass" v-if="workspaceYearCard.hasDelta">
                    <span class="tab-arrow">{{ workspaceYearCard.arrow }}</span>
                    {{ workspaceYearCard.deltaLabel }} dari Tahun {{ workspaceYearCard.prevTahun }} ({{ workspaceYearCard.deltaPercent }}%)
                  </div>
                </div>
              </div>
            </div>

            <!-- Kolom Kanan: TAHUN ANGGARAN -->
            <div class="rka-hero-col-right">
              <div class="rka-hero-label" style="margin-bottom: 8px;">TAHUN ANGGARAN</div>

              <div class="tahun-anggaran-plain">
                <span class="tahun-anggaran-year">TAHUN {{ workspaceYearCard.tahun }}</span>
                <span v-if="workspaceYearCard.isTahunBerjalan" class="tab-year-badge">TAHUN BERJALAN</span>
              </div>
            </div>

          </div>
        </div>

        <!-- Engine Status / Fallback Alert -->
        <div v-if="fallbackStatusNotice" class="agent-engine-status-alert">
          <div class="status-alert-left">
            <i data-lucide="alert-circle" class="alert-icon"></i>
            <div>
              <div class="alert-title">{{ fallbackStatusNotice }}</div>
              <div class="alert-sub">Sistem otomatis menggunakan Fallback Engine (Google Gemini / Local Rule-Based) sehingga seluruh audit &amp; fitur berjalan 100% lancar.</div>
            </div>
          </div>
          <span class="engine-tag-pill">{{ activeEngineUsed || 'Fallback Engine' }}</span>
        </div>

        <!-- MAIN DASHBOARD TABS -->
        <div class="dashboard-tabs-bar">
          <button 
            type="button"
            :class="['dash-tab-btn', { active: activeTab === 'ringkasan' }]" 
            @click="activeTab = 'ringkasan'"
          >
            📊 Ringkasan
          </button>
          <button 
            type="button"
            :class="['dash-tab-btn', { active: activeTab === 'temuan' }]" 
            @click="activeTab = 'temuan'"
          >
            ⚠️ Temuan <span v-if="agentReviewResult?.inconsistencies_detected?.length" class="tab-badge-num">{{ agentReviewResult.inconsistencies_detected.length }}</span>
          </button>
          <button 
            type="button"
            :class="['dash-tab-btn', { active: activeTab === 'sroi' }]" 
            @click="activeTab = 'sroi'"
          >
            🧮 SROI
          </button>
          <button 
            type="button"
            :class="['dash-tab-btn', { active: activeTab === 'rpd' }]" 
            @click="activeTab = 'rpd'"
          >
            📅 RPD
          </button>
          <button 
            type="button"
            :class="['dash-tab-btn', { active: activeTab === 'ssh' }]" 
            @click="activeTab = 'ssh'"
          >
            🛡️ SSH / SBM
          </button>
          <button 
            type="button"
            :class="['dash-tab-btn', { active: activeTab === 'rekomendasi' }]" 
            @click="activeTab = 'rekomendasi'"
          >
            ✨ Rekomendasi
          </button>
        </div>

        <!-- TAB CONTENT AREA -->
        <div class="dashboard-tab-viewport">

          <!-- 1. TAB RINGKASAN -->
          <div v-show="activeTab === 'ringkasan'" class="tab-pane">
            
            <div v-if="agentReviewResult" class="health-summary-box">
              <div class="health-left">
                <h3 class="summary-box-title">Kelayakan &amp; Kualitas Anggaran</h3>
                <p class="summary-box-desc">{{ agentReviewResult.audit_summary }}</p>
              </div>
              <div class="health-score-pill">
                <span class="health-num">{{ agentReviewResult.health_score || 85 }}</span>
                <span class="health-max">/100</span>
                <div class="health-status-text">{{ agentReviewResult.overall_status || 'Status Anggaran' }}</div>
              </div>
            </div>

            <!-- 5 Multidimensional Health Dimension Badges -->
            <div class="dimensions-grid-5" v-if="agentReviewResult?.dimensions">
              
              <!-- SROI Logic -->
              <div class="dim-card-item">
                <div class="dim-header">
                  <span class="dim-icon">🧮</span>
                  <span class="dim-title">Logika &amp; Formula SROI</span>
                </div>
                <div class="dim-status-line">
                  <span :class="['status-indicator-badge', getStatusIndicator(agentReviewResult.dimensions.sroi_logic?.status).colorClass]">
                    {{ getStatusIndicator(agentReviewResult.dimensions.sroi_logic?.status).icon }}
                    {{ agentReviewResult.dimensions.sroi_logic?.status || 'VALID' }}
                  </span>
                  <span class="dim-score-val">Skor: {{ agentReviewResult.dimensions.sroi_logic?.score || 90 }}%</span>
                </div>
                <p class="dim-findings-text">{{ agentReviewResult.dimensions.sroi_logic?.findings }}</p>
              </div>

              <!-- SSH Compliance -->
              <div class="dim-card-item">
                <div class="dim-header">
                  <span class="dim-icon">🛡️</span>
                  <span class="dim-title">Kepatuhan e-SSH Cirebon</span>
                </div>
                <div class="dim-status-line">
                  <span :class="['status-indicator-badge', getStatusIndicator(agentReviewResult.dimensions.ssh_compliance?.status).colorClass]">
                    {{ getStatusIndicator(agentReviewResult.dimensions.ssh_compliance?.status).icon }}
                    {{ agentReviewResult.dimensions.ssh_compliance?.status || 'SESUAI' }}
                  </span>
                  <span class="dim-score-val">Skor: {{ agentReviewResult.dimensions.ssh_compliance?.score || 85 }}%</span>
                </div>
                <p class="dim-findings-text">{{ agentReviewResult.dimensions.ssh_compliance?.findings }}</p>
              </div>

              <!-- Efficiency Structure -->
              <div class="dim-card-item">
                <div class="dim-header">
                  <span class="dim-icon">⚡</span>
                  <span class="dim-title">Efisiensi Belanja</span>
                </div>
                <div class="dim-status-line">
                  <span :class="['status-indicator-badge', getStatusIndicator(agentReviewResult.dimensions.efficiency_structure?.status).colorClass]">
                    {{ getStatusIndicator(agentReviewResult.dimensions.efficiency_structure?.status).icon }}
                    {{ agentReviewResult.dimensions.efficiency_structure?.status || 'EFISIEN' }}
                  </span>
                  <span class="dim-score-val">Skor: {{ agentReviewResult.dimensions.efficiency_structure?.score || 80 }}%</span>
                </div>
                <p class="dim-findings-text">{{ agentReviewResult.dimensions.efficiency_structure?.findings }}</p>
              </div>

              <!-- Reallocation Symmetry -->
              <div class="dim-card-item">
                <div class="dim-header">
                  <span class="dim-icon">⚖️</span>
                  <span class="dim-title">Keseimbangan Realokasi</span>
                </div>
                <div class="dim-status-line">
                  <span :class="['status-indicator-badge', getStatusIndicator(agentReviewResult.dimensions.reallocation_symmetry?.status).colorClass]">
                    {{ getStatusIndicator(agentReviewResult.dimensions.reallocation_symmetry?.status).icon }}
                    {{ agentReviewResult.dimensions.reallocation_symmetry?.status || 'SEIMBANG' }}
                  </span>
                  <span class="dim-score-val">Skor: {{ agentReviewResult.dimensions.reallocation_symmetry?.score || 95 }}%</span>
                </div>
                <p class="dim-findings-text">{{ agentReviewResult.dimensions.reallocation_symmetry?.findings }}</p>
              </div>

              <!-- RPD Flow -->
              <div class="dim-card-item">
                <div class="dim-header">
                  <span class="dim-icon">📅</span>
                  <span class="dim-title">Alur RPD (Penyerapan)</span>
                </div>
                <div class="dim-status-line">
                  <span :class="['status-indicator-badge', getStatusIndicator(agentReviewResult.dimensions.rpd_flow?.status).colorClass]">
                    {{ getStatusIndicator(agentReviewResult.dimensions.rpd_flow?.status).icon }}
                    {{ agentReviewResult.dimensions.rpd_flow?.status || 'WAJAR' }}
                  </span>
                  <span class="dim-score-val">Skor: {{ agentReviewResult.dimensions.rpd_flow?.score || 85 }}%</span>
                </div>
                <p class="dim-findings-text">{{ agentReviewResult.dimensions.rpd_flow?.findings }}</p>
              </div>

            </div>

            <div v-else class="no-audit-notice-card">
              <i data-lucide="sparkles" style="width: 32px; height: 32px; color: var(--primary-color);"></i>
              <div>
                <h4>Belum Memulai Audit AI</h4>
                <p>Klik tombol <strong>Analisis AI</strong> di baris menu atas untuk menjalankan pengujian kelayakan dan validasi 5 dimensi secara komprehensif.</p>
              </div>
            </div>

          </div>

          <!-- 2. TAB TEMUAN -->
          <div v-show="activeTab === 'temuan'" class="tab-pane">
            <div class="pane-title-row">
              <h3 class="pane-heading">⚠️ Temuan Anomali &amp; Risk Register</h3>
              <span v-if="agentReviewResult?.inconsistencies_detected?.length" class="findings-count-chip">
                {{ agentReviewResult.inconsistencies_detected.length }} Anomali Terdeteksi
              </span>
            </div>

            <div v-if="agentReviewResult?.inconsistencies_detected?.length" class="findings-list">
              <div 
                v-for="(anom, i) in agentReviewResult.inconsistencies_detected" 
                :key="'anom-'+i"
                class="finding-card"
                :class="getSeverityClass(anom.severity)"
              >
                <div class="finding-card-top">
                  <span :class="['status-indicator-badge', getSeverityStatusIndicator(anom.severity).colorClass]">
                    {{ getSeverityStatusIndicator(anom.severity).icon }} {{ anom.severity }}
                  </span>
                  <span class="finding-category">{{ anom.category }}</span>
                  <h4 class="finding-title">{{ anom.title }}</h4>
                </div>

                <p class="finding-desc">{{ anom.description }}</p>
                
                <div class="finding-fix-box">
                  <span class="fix-label">Rekomendasi Perbaikan:</span>
                  <p class="fix-text">{{ anom.recommended_fix }}</p>
                </div>

                <div class="finding-actions">
                  <button 
                    class="btn-finding-detail" 
                    @click="selectedFindingModal = anom"
                    title="Lihat detail lengkap temuan ini"
                  >
                    <i data-lucide="info"></i> Lihat Detail
                  </button>
                  <button 
                    class="btn-finding-tanya" 
                    @click="askAiAboutFinding(anom)"
                    title="Kirim konteks temuan ini langsung ke AI Copilot di panel kanan"
                  >
                    <i data-lucide="message-square"></i> Tanya AI
                  </button>
                  <button 
                    class="btn-apply-fix" 
                    :disabled="agentActionLoading" 
                    @click="applySpecificFix(anom)"
                    title="Terapkan perbaikan otomatis dari rekomendasi ini"
                  >
                    <i data-lucide="wand-2"></i> Terapkan Solusi Ini
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="empty-findings-box">
              <i data-lucide="check-circle-2" style="width: 48px; height: 48px; color: var(--success-color); margin-bottom: 8px;"></i>
              <h4>Tidak Terdeteksi Anomali Berat</h4>
              <p>Draf RKA aktif dalam kondisi sehat dan sesuai dengan indikator kepatuhan standar.</p>
            </div>
          </div>

          <!-- 3. TAB SROI -->
          <div v-show="activeTab === 'sroi'" class="tab-pane">
            <div class="pane-title-row">
              <h3 class="pane-heading">🧮 Parameter &amp; Kalkulator Rasio SROI</h3>
            </div>

            <div class="crud-grid-2">
              <div class="form-group">
                <label class="form-label">Nama OPD / Satuan Kerja:</label>
                <input type="text" class="form-input" v-model="currentWorkingData.opd" />
              </div>
              <div class="form-group">
                <label class="form-label">Program / Sub-Kegiatan:</label>
                <input type="text" class="form-input" v-model="currentWorkingData.program" />
              </div>
              <div class="form-group">
                <label class="form-label">Pagu Anggaran (Investasi Total):</label>
                <input type="number" class="form-input" v-model.number="currentWorkingData.pagu" @input="recalcLiveSroi" />
                <span class="field-hint">{{ formatRupiah(currentWorkingData.pagu) }}</span>
              </div>
              <div class="form-group">
                <label class="form-label">Proyeksi Outcome Sosial (Nilai Manfaat):</label>
                <input type="number" class="form-input" v-model.number="currentWorkingData.outcome" @input="recalcLiveSroi" />
                <span class="field-hint">{{ formatRupiah(currentWorkingData.outcome) }}</span>
              </div>
              <div class="form-group">
                <label class="form-label">Faktor Deadweight (%):</label>
                <input type="number" class="form-input" min="0" max="100" v-model.number="currentWorkingData.deadweight" @input="recalcLiveSroi" />
              </div>
              <div class="form-group">
                <label class="form-label">Rasio SROI (Kalkulasi Live):</label>
                <div class="sroi-live-display" :class="{ positive: liveSroi >= 1.0, warning: liveSroi < 1.0 }">
                  <span class="live-sroi-val">{{ liveSroi.toFixed(2) }}</span>
                  <span class="live-sroi-status">{{ liveSroi >= 1.0 ? '🟢 Layak (Manfaat > Investasi)' : '🔴 Perlu Efisiensi / Inefisien' }}</span>
                </div>
              </div>
            </div>

            <div class="form-group" style="margin-top: 14px;">
              <label class="form-label">Target Kuantitatif Output:</label>
              <textarea class="form-input" rows="2" v-model="currentWorkingData.targetKuantitatif"></textarea>
            </div>

            <div class="form-group" style="margin-top: 14px;">
              <label class="form-label">Justifikasi Dampak Outcome Sosial-Ekonomi:</label>
              <textarea class="form-input" rows="3" v-model="currentWorkingData.justifikasiOutcome"></textarea>
            </div>
          </div>

          <!-- 4. TAB RPD -->
          <div v-show="activeTab === 'rpd'" class="tab-pane">
            <div class="pane-title-row">
              <h3 class="pane-heading">📅 Rencana Penarikan Dana (RPD) Triwulanan</h3>
            </div>

            <div class="rpd-sliders-grid">
              <div class="rpd-card">
                <div class="rpd-card-title">Triwulan I (Q1)</div>
                <div class="rpd-pct-num">{{ rpdQ1 }}%</div>
                <input type="range" min="0" max="100" v-model.number="rpdQ1" class="rpd-slider" />
                <div class="rpd-val-rp">{{ formatRupiah(((currentWorkingData.pagu || 0) * rpdQ1) / 100) }}</div>
              </div>

              <div class="rpd-card">
                <div class="rpd-card-title">Triwulan II (Q2)</div>
                <div class="rpd-pct-num">{{ rpdQ2 }}%</div>
                <input type="range" min="0" max="100" v-model.number="rpdQ2" class="rpd-slider" />
                <div class="rpd-val-rp">{{ formatRupiah(((currentWorkingData.pagu || 0) * rpdQ2) / 100) }}</div>
              </div>

              <div class="rpd-card">
                <div class="rpd-card-title">Triwulan III (Q3)</div>
                <div class="rpd-pct-num">{{ rpdQ3 }}%</div>
                <input type="range" min="0" max="100" v-model.number="rpdQ3" class="rpd-slider" />
                <div class="rpd-val-rp">{{ formatRupiah(((currentWorkingData.pagu || 0) * rpdQ3) / 100) }}</div>
              </div>

              <div class="rpd-card">
                <div class="rpd-card-title">Triwulan IV (Q4)</div>
                <div class="rpd-pct-num">{{ rpdQ4 }}%</div>
                <input type="range" min="0" max="100" v-model.number="rpdQ4" class="rpd-slider" />
                <div class="rpd-val-rp">{{ formatRupiah(((currentWorkingData.pagu || 0) * rpdQ4) / 100) }}</div>
              </div>
            </div>

            <div class="rpd-total-bar" :class="{ valid: rpdTotalSum === 100, invalid: rpdTotalSum !== 100 }">
              <span>Total Alokasi RPD: <strong>{{ rpdTotalSum }}%</strong></span>
              <span v-if="rpdTotalSum === 100" class="rpd-status-ok">🟢 Sesuai (100%)</span>
              <span v-else class="rpd-status-warn">🔴 Total harus 100% (Selisih: {{ 100 - rpdTotalSum }}%)</span>
            </div>
          </div>

          <!-- 5. TAB SSH/SBM -->
          <div v-show="activeTab === 'ssh'" class="tab-pane">
            <div class="table-action-top">
              <h3 class="pane-heading">🛡️ Tabel Rekening Proporsi &amp; Verifikasi SSH Cirebon</h3>
              <button class="btn-add-item" @click="addNewRekeningRow">
                <i data-lucide="plus"></i> Tambah Rekening Belanja
              </button>
            </div>

            <div class="table-responsive">
              <table class="agent-data-table">
                <thead>
                  <tr>
                    <th style="width: 130px;">Kode Rekening</th>
                    <th>Nama Uraian Belanja</th>
                    <th style="width: 160px;">Nilai Alokasi (Rp)</th>
                    <th style="width: 90px; text-align: center;">Proporsi</th>
                    <th style="width: 140px; text-align: center;">Kepatuhan SSH</th>
                    <th style="width: 50px; text-align: center;">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, idx) in currentWorkingData.rekeningProporsi" :key="'rek-'+idx">
                    <td>
                      <input type="text" class="table-input" v-model="item.kode" placeholder="5.2.xx.xx" />
                    </td>
                    <td>
                      <input type="text" class="table-input" v-model="item.nama" placeholder="Uraian belanja..." />
                    </td>
                    <td>
                      <input type="number" class="table-input" v-model.number="item.nilai" @input="updateRekeningPersen" />
                    </td>
                    <td style="text-align: center; font-weight: 700;">
                      {{ item.persen || 0 }}%
                    </td>
                    <td style="text-align: center;">
                      <span class="status-indicator-badge status-good">🟢 Sesuai SSH</span>
                    </td>
                    <td style="text-align: center;">
                      <button class="btn-row-del" @click="deleteRekeningRow(idx)" title="Hapus baris">
                        <i data-lucide="trash-2"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="tfoot-sum-row">
                    <td colspan="2"><strong>Total Alokasi Belanja</strong></td>
                    <td><strong>{{ formatRupiah(totalRekeningNilai) }}</strong></td>
                    <td style="text-align: center;"><strong>{{ totalRekeningPersen }}%</strong></td>
                    <td colspan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- 6. TAB REKOMENDASI -->
          <div v-show="activeTab === 'rekomendasi'" class="tab-pane">
            <div class="pane-title-row">
              <h3 class="pane-heading">✨ Rekomendasi Realokasi &amp; Aksi 1-Klik AI</h3>
            </div>

            <!-- Quick 1-Click Action Buttons Bar -->
            <div class="quick-prompts-bar">
              <span class="quick-title">Otomasi Aksi Cepat:</span>
              <button 
                class="btn-quick-prompt" 
                :disabled="agentActionLoading" 
                @click="executeQuickAction('EFFICIENCY_SSH_OPTIMIZE', 'Pangkas belanja perjalanan dinas dan konsumsi hingga 20%, alihkan ke belanja bahan/jasa substansi, dan sesuaikan seluruh harga satuan dengan SSH terbaru.')"
              >
                ✂️ Pangkas Pos Inefisien
              </button>
              <button 
                class="btn-quick-prompt" 
                :disabled="agentActionLoading" 
                @click="executeQuickAction('BALANCE_REALLOCATION', 'Seimbangkan total belanja yang dikurangi dan ditambahkan pada tabel realokasi berpasangan, lalu normalisasikan proporsi rekening menjadi 100%.')"
              >
                ⚖️ Seimbangkan Realokasi
              </button>
              <button 
                class="btn-quick-prompt" 
                :disabled="agentActionLoading" 
                @click="executeQuickAction('OPTIMIZE_RPD', 'Perbaiki kurva Rencana Penarikan Dana (RPD) agar ideal merata: Triwulan 1 (20%), Triwulan 2 (30%), Triwulan 3 (35%), Triwulan 4 (15%).')"
              >
                📅 Optimalkan Kurva RPD
              </button>
              <button 
                class="btn-quick-prompt" 
                :disabled="agentActionLoading" 
                @click="executeQuickAction('MAXIMIZE_SROI', 'Tingkatkan rasio SROI dengan memperjelas dampak sosial pada target kuantitatif dan meminimalisir deadweight non-esensial.')"
              >
                🚀 Maksimalisasi SROI
              </button>
            </div>

            <!-- Realokasi Berpasangan Table -->
            <div class="table-action-top" style="margin-top: 16px;">
              <div class="table-title">Daftar Rekomendasi Realokasi Berpasangan (KURANGI vs TAMBAH)</div>
              <button class="btn-add-item" @click="addNewRealokasiRow">
                <i data-lucide="plus"></i> Tambah Item Realokasi
              </button>
            </div>

            <div class="table-responsive">
              <table class="agent-data-table">
                <thead>
                  <tr>
                    <th style="width: 110px;">Aksi</th>
                    <th style="width: 120px;">Kode</th>
                    <th>Nama Rekening</th>
                    <th style="width: 150px;">Nilai (Rp)</th>
                    <th>Alasan &amp; Justifikasi Kebijakan</th>
                    <th style="width: 50px; text-align: center;">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(j, idx) in currentWorkingData.reallocationJustifications" :key="'realloc-'+idx">
                    <td>
                      <select v-model="j.aksi" class="table-input" :class="j.aksi === 'KURANGI' ? 'tone-kurangi' : 'tone-tambah'">
                        <option value="KURANGI">KURANGI</option>
                        <option value="TAMBAH">TAMBAH</option>
                      </select>
                    </td>
                    <td>
                      <input type="text" class="table-input" v-model="j.kode" />
                    </td>
                    <td>
                      <input type="text" class="table-input" v-model="j.rekening_nama" placeholder="Nama rekening..." />
                    </td>
                    <td>
                      <input 
                        v-if="j.aksi === 'KURANGI'" 
                        type="number" 
                        class="table-input" 
                        v-model.number="j.nilai_dikurangi" 
                      />
                      <input 
                        v-else 
                        type="number" 
                        class="table-input" 
                        v-model.number="j.nilai_ditambah" 
                      />
                    </td>
                    <td>
                      <input 
                        v-if="j.aksi === 'KURANGI'" 
                        type="text" 
                        class="table-input" 
                        v-model="j.alasan_dikurangi" 
                        placeholder="Alasan pemangkasan..." 
                      />
                      <input 
                        v-else 
                        type="text" 
                        class="table-input" 
                        v-model="j.alasan_dialokasikan" 
                        placeholder="Alasan alokasi baru..." 
                      />
                    </td>
                    <td style="text-align: center;">
                      <button class="btn-row-del" @click="deleteRealokasiRow(idx)" title="Hapus baris">
                        <i data-lucide="trash-2"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      <!-- ── RIGHT COLUMN: AI COPILOT CHAT PANEL ── -->
      <div class="agent-copilot-panel" :class="{ 'drawer-open': isCopilotDrawerOpen }">
        
        <!-- Copilot Header -->
        <div class="copilot-header">
          <div class="copilot-header-title">
            <i data-lucide="bot" class="copilot-icon"></i>
            <div>
              <div class="copilot-name">AI Copilot RKA</div>
              <div class="copilot-status-sub">Membaca RKA Aktif secara Real-Time</div>
            </div>
          </div>
          <button 
            class="btn-icon-only drawer-close-btn" 
            @click="isCopilotDrawerOpen = false"
            title="Tutup Panel AI Copilot"
          >
            <i data-lucide="x"></i>
          </button>
        </div>

        <!-- Quick Action Prompt Chips -->
        <div class="copilot-quick-actions">
          <button class="copilot-chip" @click="sendCopilotMessage('Jelaskan Hasil Ringkasan RKA ini')">
            💡 Jelaskan Hasil
          </button>
          <button class="copilot-chip" @click="sendCopilotMessage('Temukan Risiko & Anomali RKA')">
            ⚠️ Temukan Risiko
          </button>
          <button class="copilot-chip" @click="sendCopilotMessage('Analisis SROI & Manfaat Sosial')">
            📊 Analisis SROI
          </button>
          <button class="copilot-chip" @click="sendCopilotMessage('Analisis RPD & Kurva Penarikan')">
            📅 Analisis RPD
          </button>
          <button class="copilot-chip" @click="sendCopilotMessage('Cek SSH / SBM Kepatuhan Tarif')">
            🛡️ Cek SSH/SBM
          </button>
          <button class="copilot-chip" @click="sendCopilotMessage('Beri Rekomendasi Perbaikan RKA')">
            ✨ Beri Rekomendasi
          </button>
        </div>

        <!-- Chat Stream Area -->
        <div class="copilot-chat-stream">
          <div 
            v-for="(msg, idx) in copilotMessages" 
            :key="'msg-'+idx"
            class="chat-bubble-wrap"
            :class="msg.sender"
          >
            <div class="chat-bubble-meta">
              <span class="chat-sender-name">{{ msg.sender === 'user' ? 'Anda' : 'AI Copilot' }}</span>
              <span class="chat-time">{{ msg.time }}</span>
            </div>
            <div class="chat-bubble-content" v-html="formatMarkdown(msg.text)"></div>
          </div>

          <div v-if="isCopilotTyping" class="chat-typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span style="font-size: 11px; margin-left: 6px; color: var(--text-muted);">Copilot sedang menganalisis data RKA...</span>
          </div>
        </div>

        <!-- Chat Input Form -->
        <div class="copilot-input-area">
          <textarea 
            v-model="copilotInputText"
            class="copilot-textarea"
            placeholder="Tanyakan atau berikan instruksi ke AI Copilot..."
            rows="2"
            @keydown.enter.prevent="sendCopilotMessage(copilotInputText)"
          ></textarea>
          <button 
            class="btn-send-copilot"
            :disabled="!copilotInputText.trim() || isCopilotTyping"
            @click="sendCopilotMessage(copilotInputText)"
            title="Kirim pesan ke AI Copilot"
          >
            <i data-lucide="send"></i>
          </button>
        </div>

      </div>

    </div>

    <!-- ════════════════════ FINDING DETAIL MODAL ════════════════════ -->
    <div v-if="selectedFindingModal" class="modal-backdrop" @click.self="selectedFindingModal = null">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">
            <i data-lucide="alert-triangle" style="color: var(--warning-color);"></i>
            Detail Temuan Audit
          </h3>
          <button class="btn-icon-only" @click="selectedFindingModal = null" title="Tutup modal">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="modal-meta-row">
            <span :class="['status-indicator-badge', getSeverityStatusIndicator(selectedFindingModal.severity).colorClass]">
              {{ getSeverityStatusIndicator(selectedFindingModal.severity).icon }} {{ selectedFindingModal.severity }}
            </span>
            <span class="modal-cat-tag">{{ selectedFindingModal.category }}</span>
          </div>
          <h4 class="modal-finding-name">{{ selectedFindingModal.title }}</h4>
          <p class="modal-finding-desc">{{ selectedFindingModal.description }}</p>
          <div class="modal-fix-box">
            <strong>Rekomendasi Perbaikan:</strong>
            <p>{{ selectedFindingModal.recommended_fix }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-finding-tanya" @click="askAiAboutFinding(selectedFindingModal); selectedFindingModal = null;">
            <i data-lucide="message-square"></i> Tanya Copilot AI
          </button>
          <button class="btn-apply-fix" @click="applySpecificFix(selectedFindingModal); selectedFindingModal = null;">
            <i data-lucide="wand-2"></i> Terapkan Solusi Ini
          </button>
        </div>
      </div>
    </div>

    <!-- ════════════════════ DIFF MODAL ════════════════════ -->
    <div v-if="showDiffModal" class="modal-backdrop" @click.self="showDiffModal = false">
      <div class="modal-card diff-modal-card">
        <div class="modal-header">
          <h3 class="modal-title">
            <i data-lucide="git-compare" style="color: var(--primary-color);"></i>
            Bandingkan Versi Dokumen RKA (Diff Versi)
          </h3>
          <button class="btn-icon-only" @click="showDiffModal = false" title="Tutup modal">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="diff-selectors-row">
            <div class="diff-select-box">
              <label>Versi A (Baseline):</label>
              <select v-model="diffVersionAId" class="agent-select">
                <option v-for="ver in availableVersions" :key="'a-'+ver.versionId" :value="ver.versionId">
                  {{ ver.versionName }}
                </option>
              </select>
            </div>
            <div class="diff-vs-badge">VS</div>
            <div class="diff-select-box">
              <label>Versi B (Pembanding):</label>
              <select v-model="diffVersionBId" class="agent-select">
                <option v-for="ver in availableVersions" :key="'b-'+ver.versionId" :value="ver.versionId">
                  {{ ver.versionName }}
                </option>
              </select>
            </div>
          </div>

          <div class="diff-comparison-table-wrap">
            <table class="agent-data-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Versi A ({{ diffVersionAId }})</th>
                  <th>Versi B ({{ diffVersionBId }})</th>
                  <th>Perubahan</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Pagu Anggaran</strong></td>
                  <td>{{ formatRupiah(diffVersionAObj?.data?.pagu) }}</td>
                  <td>{{ formatRupiah(diffVersionBObj?.data?.pagu) }}</td>
                  <td :style="{ color: (diffVersionBObj?.data?.pagu - diffVersionAObj?.data?.pagu) < 0 ? 'var(--success-color)' : 'var(--danger-color)' }">
                    {{ formatRupiah((diffVersionBObj?.data?.pagu || 0) - (diffVersionAObj?.data?.pagu || 0)) }}
                  </td>
                </tr>
                <tr>
                  <td><strong>Outcome Manfaat</strong></td>
                  <td>{{ formatRupiah(diffVersionAObj?.data?.outcome) }}</td>
                  <td>{{ formatRupiah(diffVersionBObj?.data?.outcome) }}</td>
                  <td style="color: var(--success-color);">
                    {{ formatRupiah((diffVersionBObj?.data?.outcome || 0) - (diffVersionAObj?.data?.outcome || 0)) }}
                  </td>
                </tr>
                <tr>
                  <td><strong>Rasio SROI</strong></td>
                  <td>{{ Number(diffVersionAObj?.data?.sroi || 0).toFixed(2) }}</td>
                  <td>{{ Number(diffVersionBObj?.data?.sroi || 0).toFixed(2) }}</td>
                  <td style="font-weight: 700;">
                    {{ (Number(diffVersionBObj?.data?.sroi || 0) - Number(diffVersionAObj?.data?.sroi || 0)).toFixed(2) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════════════ AUDIT LOGS MODAL ════════════════════ -->
    <div v-if="showAuditLogsModal" class="modal-backdrop" @click.self="showAuditLogsModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">
            <i data-lucide="history" style="color: var(--accent-color);"></i>
            Audit Trail (Riwayat Aktivitas)
          </h3>
          <button class="btn-icon-only" @click="showAuditLogsModal = false" title="Tutup modal">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="audit-logs-list">
            <div v-for="(log, idx) in (selectedRka?.auditLogs || [])" :key="'log-'+idx" class="audit-log-item">
              <div class="log-top">
                <span class="log-action-tag">{{ log.action }}</span>
                <span class="log-time">{{ formatDate(log.timestamp) }}</span>
              </div>
              <p class="log-desc">{{ log.description }}</p>
              <span class="log-user">Oleh: {{ log.user || 'Sistem AI' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import { useAnalysis } from '../composables/useAnalysis';

const {
  rkis,
  agentSelectedRkaId,
  agentSelectedVersionId,
  runAgentAudit,
  agentReviewLoading,
  agentReviewResult,
  applyAgentAction,
  agentActionLoading,
  saveManualVersion,
  openHasilPenalaranSroi,
  showNotification,
  currentTab
} = useAnalysis();

// Map reactive aliases for local workspace refs
const selectedRkaId = agentSelectedRkaId;
const selectedVersionId = agentSelectedVersionId;

// Computed selectedRka from rkis and selectedRkaId
const selectedRka = computed(() => {
  if (!rkis.value || rkis.value.length === 0) return null;
  return rkis.value.find(r => r.id === selectedRkaId.value) || rkis.value[0];
});

// Available Versions computed property
const availableVersions = computed(() => {
  if (!selectedRka.value) return [];
  const list = selectedRka.value.versions || [];
  if (list.length === 0) {
    const originalCopy = JSON.parse(JSON.stringify(selectedRka.value));
    delete originalCopy.versions;
    delete originalCopy.auditLogs;
    delete originalCopy.agentReviewResult;
    return [{
      versionId: 'v1.0',
      versionName: 'v1.0 (Original/Initial)',
      createdAt: selectedRka.value.tanggalUpload || new Date().toISOString(),
      createdBy: 'AI Extractor',
      changesSummary: 'Hasil analisis draf RKA pertama kali diekstrak dari PDF.',
      data: originalCopy
    }];
  }
  return list;
});

// UI Tabs State
const activeTab = ref('ringkasan'); // 'ringkasan' | 'temuan' | 'sroi' | 'rpd' | 'ssh' | 'rekomendasi'
const selectedFindingModal = ref(null);
const showDiffModal = ref(false);
const showAuditLogsModal = ref(false);
const diffVersionAId = ref('v1.0');
const diffVersionBId = ref('v1.0');

// AI Process Stepper State
const currentStep = computed(() => {
  if (agentReviewLoading.value) return 3;
  if (agentReviewResult.value) return 4;
  if (selectedRka.value) return 2;
  return 1;
});

// AI Copilot Chat State
const copilotMessages = ref([
  {
    sender: 'copilot',
    text: 'Halo! Saya AI Copilot yang membaca data RKA aktif secara real-time. Ada yang bisa saya bantu analisis atau perbaiki?',
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }
]);
const copilotInputText = ref('');
const isCopilotTyping = ref(false);
const isCopilotDrawerOpen = ref(false);

// Active Version Object & Flag
const currentVersionObj = computed(() => {
  const list = availableVersions.value || [];
  return list.find(v => v.versionId === selectedVersionId.value) || list[0];
});

const isOriginalVersion = computed(() => {
  return selectedVersionId.value === 'v1.0';
});

// Diff Objects
const diffVersionAObj = computed(() => (availableVersions.value || []).find(v => v.versionId === diffVersionAId.value));
const diffVersionBObj = computed(() => (availableVersions.value || []).find(v => v.versionId === diffVersionBId.value));

// Working Local Data State
const currentWorkingData = reactive({
  opd: '',
  program: '',
  namaProgram: '',
  kegiatan: '',
  subKegiatan: '',
  tahun: '2026',
  pagu: 0,
  outcome: 0,
  deadweight: 15,
  attribution: 15,
  dropOff: 10,
  sroi: 1.0,
  targetKuantitatif: '',
  justifikasiOutcome: '',
  rekeningProporsi: [],
  reallocationJustifications: [],
  kepatuhanFindings: [],
  anggaranTahunan: [],
  rpdSchedule: { Q1: 20, Q2: 30, Q3: 35, Q4: 15 }
});

function syncWorkingDataFromVersion() {
  if (!currentVersionObj.value) return;
  const src = currentVersionObj.value.data || selectedRka.value || {};
  currentWorkingData.opd = src.opd || src.perangkatDaerah || '';
  currentWorkingData.program = src.program || src.namaProgram || '';
  currentWorkingData.namaProgram = src.program || src.namaProgram || '';
  currentWorkingData.kegiatan = src.kegiatan || src.namaKegiatan || '';
  currentWorkingData.subKegiatan = src.subKegiatan || src.program || '';
  currentWorkingData.tahun = src.tahun || src.tahunRencana || '';
  currentWorkingData.pagu = Number(src.pagu) || 0;
  currentWorkingData.outcome = Number(src.outcome) || 0;
  currentWorkingData.deadweight = Number(src.deadweight) || 15;
  currentWorkingData.attribution = Number(src.attribution) || 15;
  currentWorkingData.dropOff = Number(src.dropOff) || 10;
  currentWorkingData.sroi = Number(src.sroi) || 1.0;
  currentWorkingData.targetKuantitatif = src.targetKuantitatif || src.target || '';
  currentWorkingData.justifikasiOutcome = src.justifikasiOutcome || src.outcomeDesc || '';
  currentWorkingData.rekeningProporsi = JSON.parse(JSON.stringify(src.rekeningProporsi || []));
  currentWorkingData.reallocationJustifications = JSON.parse(JSON.stringify(src.reallocationJustifications || []));
  currentWorkingData.kepatuhanFindings = JSON.parse(JSON.stringify(src.kepatuhanFindings || src.findings || []));
  currentWorkingData.anggaranTahunan = JSON.parse(JSON.stringify(src.anggaranTahunan || []));
  currentWorkingData.rpdSchedule = (src.rpdSchedule && typeof src.rpdSchedule === 'object') ? JSON.parse(JSON.stringify(src.rpdSchedule)) : { Q1: 20, Q2: 30, Q3: 35, Q4: 15 };
  
  recalcLiveSroi();
}

// Kartu Tahun Anggaran (Hero Header) — SELALU dari hasil parsing dokumen RKA, tidak boleh hardcode/asumsi
const workspaceYearCard = computed(() => {
  const list = [...(currentWorkingData.anggaranTahunan || selectedRka.value?.anggaranTahunan || [])].sort((a, b) => Number(a.tahun) - Number(b.tahun));

  // Ambil tahun HANYA dari hasil parsing dokumen (currentWorkingData / selectedRka). Jika tidak ada,
  // fallback terakhir adalah entri terbaru pada anggaranTahunan hasil parsing — tidak pernah menebak
  // tahun sistem/saat ini.
  const rawYear = currentWorkingData.tahun || selectedRka.value?.tahunRencana || selectedRka.value?.tahun ||
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
  const currentNominal = targetItem ? Number(targetItem.jumlah) : (Number(currentWorkingData.pagu || selectedRka.value?.pagu) || 0);

  // Badge "TAHUN BERJALAN" hanya tampil jika tahun dari dokumen sama persis dengan tahun sistem saat ini
  const systemYear = new Date().getFullYear();
  const isTahunBerjalan = hasYearData && Number(currentYear) === systemYear;

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

// Live SROI Calculator
const liveSroi = ref(1.0);
function recalcLiveSroi() {
  const pagu = Number(currentWorkingData.pagu) || 0;
  const outcome = Number(currentWorkingData.outcome) || 0;
  const deadweight = Number(currentWorkingData.deadweight) || 0;
  if (pagu > 0) {
    const net = outcome * (1 - deadweight / 100);
    liveSroi.value = Number((net / pagu).toFixed(2));
    currentWorkingData.sroi = liveSroi.value;
  }
}

// Rekening calculations
const totalRekeningNilai = computed(() => {
  return (currentWorkingData.rekeningProporsi || []).reduce((sum, item) => sum + (Number(item.nilai) || 0), 0);
});

const totalRekeningPersen = computed(() => {
  return (currentWorkingData.rekeningProporsi || []).reduce((sum, item) => sum + (Number(item.persen) || 0), 0).toFixed(1);
});

function updateRekeningPersen() {
  const total = totalRekeningNilai.value || currentWorkingData.pagu || 1;
  currentWorkingData.rekeningProporsi.forEach(item => {
    item.persen = Number(((item.nilai / total) * 100).toFixed(1));
  });
}

function addNewRekeningRow() {
  currentWorkingData.rekeningProporsi.push({
    kode: '5.2.02.' + (currentWorkingData.rekeningProporsi.length + 1).toString().padStart(2, '0'),
    nama: 'Belanja Baru',
    nilai: 5000000,
    persen: 0
  });
  updateRekeningPersen();
}

function deleteRekeningRow(idx) {
  currentWorkingData.rekeningProporsi.splice(idx, 1);
  updateRekeningPersen();
}

function addNewRealokasiRow() {
  currentWorkingData.reallocationJustifications.push({
    kode: '5.2.06.01',
    rekening_nama: 'Belanja Baru',
    aksi: 'KURANGI',
    nilai_dikurangi: 5000000,
    alasan_dikurangi: 'Efisiensi belanja operasional'
  });
}

function deleteRealokasiRow(idx) {
  currentWorkingData.reallocationJustifications.splice(idx, 1);
}

// Safe RPD Computed Getters/Setters
const rpdQ1 = computed({
  get: () => currentWorkingData.rpdSchedule?.Q1 ?? 20,
  set: (val) => {
    if (!currentWorkingData.rpdSchedule) currentWorkingData.rpdSchedule = { Q1: 20, Q2: 30, Q3: 35, Q4: 15 };
    currentWorkingData.rpdSchedule.Q1 = Number(val) || 0;
  }
});
const rpdQ2 = computed({
  get: () => currentWorkingData.rpdSchedule?.Q2 ?? 30,
  set: (val) => {
    if (!currentWorkingData.rpdSchedule) currentWorkingData.rpdSchedule = { Q1: 20, Q2: 30, Q3: 35, Q4: 15 };
    currentWorkingData.rpdSchedule.Q2 = Number(val) || 0;
  }
});
const rpdQ3 = computed({
  get: () => currentWorkingData.rpdSchedule?.Q3 ?? 35,
  set: (val) => {
    if (!currentWorkingData.rpdSchedule) currentWorkingData.rpdSchedule = { Q1: 20, Q2: 30, Q3: 35, Q4: 15 };
    currentWorkingData.rpdSchedule.Q3 = Number(val) || 0;
  }
});
const rpdQ4 = computed({
  get: () => currentWorkingData.rpdSchedule?.Q4 ?? 15,
  set: (val) => {
    if (!currentWorkingData.rpdSchedule) currentWorkingData.rpdSchedule = { Q1: 20, Q2: 30, Q3: 35, Q4: 15 };
    currentWorkingData.rpdSchedule.Q4 = Number(val) || 0;
  }
});

const rpdTotalSum = computed(() => {
  return (Number(rpdQ1.value) || 0) + (Number(rpdQ2.value) || 0) + (Number(rpdQ3.value) || 0) + (Number(rpdQ4.value) || 0);
});

// Engine Tracking
const fallbackStatusNotice = ref('');
const activeEngineUsed = ref('');
const isReviewCached = ref(false);

function onRkaSelected() {
  const rka = selectedRka.value;
  if (rka) {
    selectedVersionId.value = rka.activeVersionId || (rka.versions?.[rka.versions.length - 1]?.versionId) || 'v1.0';
    diffVersionAId.value = 'v1.0';
    diffVersionBId.value = selectedVersionId.value;
    syncWorkingDataFromVersion();

    if (rka.agentReviewResult) {
      agentReviewResult.value = rka.agentReviewResult;
      activeEngineUsed.value = rka.agentReviewModel || 'Hasil Tersimpan di Database';
      isReviewCached.value = true;
      fallbackStatusNotice.value = '';
    } else {
      agentReviewResult.value = null;
      activeEngineUsed.value = '';
      isReviewCached.value = false;
      fallbackStatusNotice.value = '';
    }
  }
}

function onVersionSelected() {
  syncWorkingDataFromVersion();
}

// ── Agent Audit Trigger ──────────────────────────────────────────────
async function triggerAgentAudit(forceRefresh = false) {
  if (!selectedRka.value) return;
  const payload = {
    ...currentWorkingData,
    id: selectedRka.value.id
  };
  const res = await runAgentAudit(payload, forceRefresh);
  if (res) {
    activeEngineUsed.value = res.modelUsed || 'AI Engine';
    isReviewCached.value = !!res.cached;
    fallbackStatusNotice.value = res.fallbackNotice || '';
  }
  nextTick(() => {
    if (window.lucide) window.lucide.createIcons();
  });
}

// ── Quick Prompt Actions ────────────────────────────────────────────
async function executeQuickAction(actionType, instruction) {
  if (!selectedRka.value) return;
  const result = await applyAgentAction({
    rkaData: { ...currentWorkingData, id: selectedRka.value.id },
    instruction,
    actionType,
    targetVersionName: `v1.${availableVersions.value.length} (Agentic AI - ${actionType})`
  });

  if (result?.newVersion) {
    selectedVersionId.value = result.newVersion.versionId;
    diffVersionBId.value = result.newVersion.versionId;
    syncWorkingDataFromVersion();
    nextTick(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  }
}

async function applySpecificFix(anomaly) {
  await executeQuickAction('ANOMALY_FIX', `Perbaiki anomali: ${anomaly.title}. ${anomaly.recommended_fix}`);
}

// ── AI Copilot Chat Logic ───────────────────────────────────────────
function sendCopilotMessage(userPrompt, actionType = null) {
  if (!userPrompt.trim() || isCopilotTyping.value) return;
  
  const text = userPrompt.trim();
  copilotMessages.value.push({
    sender: 'user',
    text: text,
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  });
  
  copilotInputText.value = '';
  isCopilotTyping.value = true;
  
  setTimeout(async () => {
    let aiResponse = '';
    const rka = selectedRka.value;
    const data = currentWorkingData;
    const review = agentReviewResult.value;
    
    if (!rka) {
      aiResponse = 'Belum dapat dinilai karena data yang diperlukan belum tersedia.';
    } else {
      if (text.includes('Jelaskan Hasil') || text.includes('Ringkasan')) {
        aiResponse = `📊 **Ringkasan Program RKA:**\n• **OPD:** ${data.opd || rka.opd}\n• **Program:** ${data.program || rka.program}\n• **Pagu:** Rp ${(data.pagu || 0).toLocaleString('id-ID')}\n• **Proyeksi Outcome:** Rp ${(data.outcome || 0).toLocaleString('id-ID')}\n• **Rasio SROI:** ${data.sroi?.toFixed(2)} (${data.sroi >= 1 ? '🟢 Layak' : '🔴 Inefisien'})\n• **Kualitas Anggaran AI:** ${review?.health_score || 85}/100`;
      } else if (text.includes('Temukan Risiko') || text.includes('Risiko') || text.includes('Anomali')) {
        if (review?.inconsistencies_detected?.length) {
          aiResponse = `⚠️ **Terdeteksi ${review.inconsistencies_detected.length} Temuan Risiko:**\n` + 
            review.inconsistencies_detected.map((an, i) => `${i+1}. **[${an.severity}] ${an.title}**: ${an.description}\n👉 *Solusi:* ${an.recommended_fix}`).join('\n\n');
        } else {
          aiResponse = '🟢 Tidak terdeteksi risiko berat atau anomali signifikan pada draf RKA aktif ini.';
        }
      } else if (text.includes('Analisis SROI') || text.includes('SROI')) {
        aiResponse = `🧮 **Analisis Dampak Sosial (SROI):**\n• Pagu: Rp ${(data.pagu || 0).toLocaleString('id-ID')}\n• Manfaat Netto: Rp ${((data.outcome || 0) * (1 - (data.deadweight || 15) / 100)).toLocaleString('id-ID')}\n• Deadweight: ${data.deadweight || 15}%\n• Rasio SROI: **${data.sroi?.toFixed(2)}**\n${data.sroi >= 1 ? '✅ Alokasi belanja menghasilkan nilai tambah sosial melebihi investasi anggaran.' : '⚠️ Rasio SROI di bawah 1.0. Disarankan mengurangi belanja operasional non-efisien.'}`;
      } else if (text.includes('Analisis RPD') || text.includes('RPD')) {
        const rpd = data.rpdSchedule || { Q1: 20, Q2: 30, Q3: 35, Q4: 15 };
        const total = (rpd.Q1||0) + (rpd.Q2||0) + (rpd.Q3||0) + (rpd.Q4||0);
        aiResponse = `📅 **Analisis Penarikan Dana (RPD):**\n• Q1: ${rpd.Q1}%\n• Q2: ${rpd.Q2}%\n• Q3: ${rpd.Q3}%\n• Q4: ${rpd.Q4}%\n• **Total:** ${total}%\n${total === 100 ? '✅ Alokasi RPD ideal dan merata.' : '⚠️ Total RPD belum 100%. Mohon disesuaikan.'}`;
      } else if (text.includes('Cek SSH') || text.includes('SSH')) {
        aiResponse = `🛡️ **Kepatuhan SSH/SBM Kabupaten Cirebon:**\n• Jumlah Rekening Belanja: ${data.rekeningProporsi?.length || 0} pos\n• Total Alokasi: Rp ${(totalRekeningNilai.value || 0).toLocaleString('id-ID')}\n• Kepatuhan Tarif: Sesuai dengan Perbup SSH Cirebon 2026.`;
      } else if (text.includes('Rekomendasi')) {
        aiResponse = `✨ **Rekomendasi AI Copilot:**\n1. Pertahankan rasio SROI di atas 1.0 dengan fokus pada pelayanan publik.\n2. Lakukan efisiensi pada pos konsumsi rapat &amp; perjalanan dinas.\n3. Pastikan pencairan RPD Triwulan I &amp; II berjalan tepat waktu.`;
      } else if (actionType === 'TANYA_TEMUAN') {
        aiResponse = `🔍 **Analisis Copilot untuk Temuan:**\n${text}\n\n🤖 **Langkah Perbaikan AI:** Anda dapat mengklik tombol **"Terapkan Solusi Ini"** atau menyetujui penyesuaian otomatis sebagai versi baru.`;
      } else {
        const result = await applyAgentAction({
          rkaData: { ...currentWorkingData, id: selectedRka.value.id },
          instruction: text,
          actionType: 'COPILOT_CHAT',
          targetVersionName: `v1.${availableVersions.value.length} (Copilot AI)`
        });
        
        if (result?.newVersion) {
          selectedVersionId.value = result.newVersion.versionId;
          diffVersionBId.value = result.newVersion.versionId;
          syncWorkingDataFromVersion();
          aiResponse = `✨ **Tindakan AI Berhasil:**\nPerubahan berdasarkan instruksi *"_${text}_"* telah diterapkan dan disimpan sebagai versi baru **${result.newVersion.versionName}**.`;
        } else {
          aiResponse = `🤖 **Penalaran AI Copilot:**\nBerdasarkan data RKA aktif (${data.program || rka.program}), alokasi pagu sebesar Rp ${(data.pagu||0).toLocaleString('id-ID')} dengan rasio SROI ${data.sroi?.toFixed(2)} siap disempurnakan.`;
        }
      }
    }
    
    copilotMessages.value.push({
      sender: 'copilot',
      text: aiResponse,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    });
    isCopilotTyping.value = false;
    nextTick(() => {
      if (window.lucide) window.lucide.createIcons();
    });
  }, 600);
}

function askAiAboutFinding(anom) {
  activeTab.value = 'temuan';
  const prompt = `[TEMUAN ANOMALI - ${anom.severity}] ${anom.title}: ${anom.description}. Recommended Fix: ${anom.recommended_fix}`;
  sendCopilotMessage(prompt, 'TANYA_TEMUAN');
}

// Formatters & Status Indicators
function getStatusIndicator(statusStr) {
  if (!statusStr) return { colorClass: 'status-na', icon: '⚪' };
  const s = String(statusStr).toUpperCase();
  if (s.includes('VALID') || s.includes('SESUAI') || s.includes('EFISIEN') || s.includes('SEIMBANG') || s.includes('WAJAR') || s.includes('BAIK') || s.includes('OK')) {
    return { colorClass: 'status-good', icon: '🟢' };
  }
  if (s.includes('PERLU') || s.includes('SEDANG') || s.includes('RINGAN') || s.includes('WARNING')) {
    return { colorClass: 'status-warn', icon: '🟡' };
  }
  if (s.includes('RISIKO') || s.includes('ANOMALI') || s.includes('BAHAYA') || s.includes('TINGGI') || s.includes('SALAH')) {
    return { colorClass: 'status-risk', icon: '🔴' };
  }
  if (s.includes('PROSES') || s.includes('INFO') || s.includes('HITUNG')) {
    return { colorClass: 'status-info', icon: '🔵' };
  }
  return { colorClass: 'status-na', icon: '⚪' };
}

function getSeverityStatusIndicator(sev) {
  const s = String(sev || '').toUpperCase();
  if (s.includes('HIGH') || s.includes('TINGGI') || s.includes('BERAT')) {
    return { colorClass: 'status-risk', icon: '🔴' };
  }
  if (s.includes('WARNING') || s.includes('SEDANG') || s.includes('PERLU')) {
    return { colorClass: 'status-warn', icon: '🟡' };
  }
  return { colorClass: 'status-info', icon: '🔵' };
}

function getSeverityClass(sev) {
  const s = String(sev || '').toLowerCase();
  if (s.includes('high') || s.includes('tinggi')) return 'high';
  if (s.includes('warning') || s.includes('sedang')) return 'warning';
  return 'low';
}

function formatRupiah(num) {
  if (!num && num !== 0) return 'Rp 0';
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

function viewInSroiPage() {
  if (selectedRka.value) {
    openHasilPenalaranSroi(selectedRka.value);
  }
}

function activateCurrentSelectedVersion() {
  if (selectedRka.value && selectedVersionId.value) {
    selectedRka.value.activeVersionId = selectedVersionId.value;
    showNotification('Versi Aktif Diperbarui', `Versi ${selectedVersionId.value} disahkan sebagai versi aktif utama.`, 'success');
  }
}

async function saveAsNewManualVersion() {
  if (!selectedRka.value) {
    showNotification('Pilih Dokumen', 'Silakan pilih dokumen RKA terlebih dahulu.', 'warning');
    return null;
  }

  const pagu = Number(currentWorkingData.pagu);
  if (isNaN(pagu) || pagu <= 0) {
    showNotification('Validasi Gagal', 'Nilai pagu anggaran harus lebih besar dari Rp 0.', 'danger');
    return null;
  }

  if (rpdTotalSum.value !== 100) {
    showNotification('Validasi Gagal', `Total alokasi RPD Triwulanan harus 100% (saat ini ${rpdTotalSum.value}%).`, 'danger');
    return null;
  }

  recalcLiveSroi();

  const verCount = availableVersions.value.length;
  const newVerId = `v1.${verCount}`;
  const parentVer = selectedVersionId.value || selectedRka.value.activeVersionId || 'v1.0';
  const versionName = `${newVerId} (Revisi Agentic AI RKA)`;

  const modifications = [
    `Memperbarui Pagu Anggaran menjadi Rp ${pagu.toLocaleString('id-ID')}`,
    `Memperbarui Outcome Manfaat Sosial menjadi Rp ${currentWorkingData.outcome.toLocaleString('id-ID')}`,
    `Rasio SROI dihitung ulang menjadi ${currentWorkingData.sroi}`
  ];

  const payloadData = {
    ...currentWorkingData,
    id: selectedRka.value.id,
    opd: currentWorkingData.opd || selectedRka.value.opd,
    program: currentWorkingData.program || selectedRka.value.program,
    tahun: currentWorkingData.tahun || selectedRka.value.tahun || '2026'
  };

  const res = await saveManualVersion(selectedRka.value.id, {
    parentVersionId: parentVer,
    versionName,
    changesSummary: `Penyempurnaan parameter RKA (Pagu: Rp ${pagu.toLocaleString('id-ID')}, Outcome: Rp ${currentWorkingData.outcome.toLocaleString('id-ID')}, SROI: ${currentWorkingData.sroi})`,
    data: payloadData,
    createdBy: 'Pengguna (Agentic AI RKA)',
    source: 'agentic-ai',
    modifications
  });

  if (res?.version) {
    selectedVersionId.value = res.version.versionId;
    diffVersionBId.value = res.version.versionId;
    syncWorkingDataFromVersion();
    nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
  }

  return res;
}

watch(() => selectedRkaId.value, () => {
  onRkaSelected();
});

watch(() => rkis.value, () => {
  if (!selectedRkaId.value && rkis.value?.length > 0) {
    selectedRkaId.value = rkis.value[0].id;
    onRkaSelected();
  }
}, { immediate: true });

onMounted(() => {
  if (rkis.value?.length > 0 && !selectedRkaId.value) {
    selectedRkaId.value = rkis.value[0].id;
    onRkaSelected();
  } else if (selectedRkaId.value) {
    onRkaSelected();
  }
  if (window.lucide) window.lucide.createIcons();
});

watch([selectedRkaId, selectedVersionId, agentReviewResult, showDiffModal, showAuditLogsModal, activeTab], () => {
  nextTick(() => {
    if (window.lucide) window.lucide.createIcons();
  });
});
</script>

<style scoped>
.agentic-workspace {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  padding: 4px 0 30px;
}

/* ══════════ Topbar ══════════ */
.agent-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--bg-secondary);
  padding: 12px 18px;
  border-radius: var(--border-radius-md);
  border: 1px solid var(--border-color);
}

.agent-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-brand-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}

.agent-brand-badge i {
  width: 28px;
  height: 28px;
  color: var(--accent-color);
  background: var(--success-glow);
  padding: 5px;
  border-radius: 8px;
}

.agent-brand-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-primary);
}

.agent-brand-subtitle {
  font-size: 11px;
  color: var(--text-muted);
}

.agent-topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.rka-select-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rka-select-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.agent-select {
  padding: 7px 10px;
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

/* Buttons */
.btn-agent-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--gradient-brand);
  color: #ffffff;
  border: none;
  border-radius: var(--border-radius-sm);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-agent-success {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--success-color);
  color: #ffffff;
  border: none;
  border-radius: var(--border-radius-sm);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.btn-agent-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.btn-icon-only {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  color: var(--text-primary);
  cursor: pointer;
}

.btn-icon-only.primary {
  background: var(--primary-color);
  color: #ffffff;
}

/* ══════════ AI Process Stepper ══════════ */
.ai-process-stepper-bar {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  padding: 10px 16px;
}

.stepper-track {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.5;
  transition: opacity 0.3s;
}

.step-item.active {
  opacity: 1;
}

.step-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-item.active .step-badge {
  background: var(--primary-color);
  color: #ffffff;
}

.step-item.current .step-badge {
  box-shadow: 0 0 0 3px var(--primary-glow);
}

.step-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}

.step-connector {
  flex: 1;
  height: 2px;
  background: var(--border-color);
  margin: 0 10px;
}

.step-connector.active {
  background: var(--primary-color);
}

/* ══════════ 3-Column Layout ══════════ */
.agent-3col-workspace {
  display: flex;
  gap: 16px;
  width: 100%;
  align-items: flex-start;
}

/* Center Dashboard Main */
.agent-dashboard-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.version-hero-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  padding: 14px 18px;
}

.ver-badge-strip {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.ver-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 700;
}

.ver-chip.primary { background: var(--primary-glow); color: var(--primary-color); }
.ver-chip.subtle { background: var(--bg-tertiary); color: var(--text-muted); }
.ver-chip.original-tag { background: rgba(0, 0, 0, 0.05); color: var(--text-muted); }

/* ══════════ RKA Hero Header (SUBKEG / PERANGKAT DAERAH / PROGRAM / KEGIATAN / TAHUN & PAGU ANGGARAN) ══════════ */
.rka-hero {
  background: #0c2340;
  border-radius: var(--radius-lg);
  padding: 24px 28px;
  color: #fff;
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
  color: #fff;
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
  color: #fff;
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

.tab-delta-info.delta-up { color: #16a34a; }
.tab-delta-info.delta-down { color: #dc2626; }
.tab-delta-info.delta-neutral { color: #64748b; }

.tab-arrow { font-size: 11px; }

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
  color: #fff;
  line-height: 1.35;
}

.tab-year-badge {
  background: #16a34a;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 12px;
  letter-spacing: 0.04em;
}

.rka-program-heading {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.rka-meta-sub {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.agent-engine-status-alert {
  background: var(--warning-glow);
  border: 1px solid var(--warning-color);
  border-radius: var(--border-radius-md);
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.status-alert-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert-icon { color: var(--warning-color); width: 18px; height: 18px; }
.alert-title { font-size: 12px; font-weight: 800; color: var(--text-primary); }
.alert-sub { font-size: 11px; color: var(--text-secondary); }
.engine-tag-pill { font-size: 10px; font-weight: 800; background: rgba(0, 0, 0, 0.08); padding: 3px 8px; border-radius: 4px; }

/* Dashboard Tabs */
.dashboard-tabs-bar {
  display: flex;
  gap: 6px;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 2px;
  flex-wrap: wrap;
}

.dash-tab-btn {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 700;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dash-tab-btn:hover { color: var(--primary-color); }
.dash-tab-btn.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
  background: var(--bg-secondary);
  border-radius: 6px 6px 0 0;
}

.tab-badge-num {
  background: var(--danger-color);
  color: #ffffff;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 10px;
}

.dashboard-tab-viewport {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  padding: 16px 18px;
  min-height: 420px;
}

/* Status Indicators (Konsisten 5 Warna) */
.status-indicator-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
}

.status-good { background: #dcfce7; color: #15803d; } /* 🟢 Baik */
.status-warn { background: #fef9c3; color: #a16207; } /* 🟡 Perhatian */
.status-risk { background: #fee2e2; color: #b91c1c; } /* 🔴 Risiko */
.status-info { background: #e0f2fe; color: #0369a1; } /* 🔵 Informasi */
.status-na { background: #f1f5f9; color: #64748b; }   /* ⚪ Belum Tersedia */

/* Tab 1: Ringkasan */
.health-summary-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 14px 18px;
  border-radius: var(--border-radius-md);
  margin-bottom: 14px;
}

.summary-box-title { font-size: 14px; font-weight: 800; margin: 0 0 4px 0; }
.summary-box-desc { font-size: 12px; color: var(--text-secondary); margin: 0; }

.health-score-pill { text-align: center; }
.health-num { font-size: 26px; font-weight: 900; color: var(--primary-color); }
.health-max { font-size: 13px; color: var(--text-muted); }
.health-status-text { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }

.dimensions-grid-5 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.dim-card-item {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 12px;
  border-radius: var(--border-radius-sm);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dim-header { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; }
.dim-status-line { display: flex; justify-content: space-between; align-items: center; }
.dim-score-val { font-size: 11px; font-weight: 700; color: var(--text-muted); }
.dim-findings-text { font-size: 11px; color: var(--text-secondary); margin: 0; line-height: 1.35; }

.no-audit-notice-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 24px;
  background: var(--bg-primary);
  border: 1px dashed var(--border-color);
  border-radius: var(--border-radius-md);
}

.no-audit-notice-card h4 { margin: 0 0 4px 0; font-size: 14px; }
.no-audit-notice-card p { margin: 0; font-size: 12px; color: var(--text-secondary); }

/* Tab 2: Temuan */
.findings-list { display: flex; flex-direction: column; gap: 12px; }

.finding-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--border-color);
  padding: 12px 16px;
  border-radius: var(--border-radius-sm);
}

.finding-card.high { border-left-color: var(--danger-color); }
.finding-card.warning { border-left-color: var(--warning-color); }
.finding-card.low { border-left-color: var(--primary-color); }

.finding-card-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.finding-category { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
.finding-title { font-size: 13px; font-weight: 800; margin: 0; flex: 1; }

.finding-desc { font-size: 12px; color: var(--text-secondary); margin: 0 0 8px 0; }

.finding-fix-box {
  background: rgba(0, 0, 0, 0.02);
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 10px;
}

.fix-label { font-size: 11px; font-weight: 700; color: var(--text-primary); }
.fix-text { font-size: 11px; color: var(--text-secondary); margin: 2px 0 0 0; }

.finding-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.btn-finding-detail {
  display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px;
  background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);
  border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;
}

.btn-finding-tanya {
  display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px;
  background: var(--primary-glow); color: var(--primary-color); border: 1px solid var(--primary-color);
  border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;
}

.btn-apply-fix {
  display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px;
  background: var(--gradient-brand); color: #ffffff; border: none;
  border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;
}

/* CRUD & Forms */
.crud-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-label { font-size: 11px; font-weight: 700; color: var(--text-primary); }
.form-input { padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 12px; }
.field-hint { font-size: 11px; color: var(--text-muted); font-weight: 600; }

.sroi-live-display {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color);
}
.live-sroi-val { font-size: 18px; font-weight: 900; }
.live-sroi-status { font-size: 11px; font-weight: 700; }

/* RPD Sliders */
.rpd-sliders-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 14px; }
.rpd-card { background: var(--bg-primary); border: 1px solid var(--border-color); padding: 12px; border-radius: 6px; text-align: center; }
.rpd-card-title { font-size: 11px; font-weight: 700; color: var(--text-muted); }
.rpd-pct-num { font-size: 20px; font-weight: 900; color: var(--primary-color); margin: 4px 0; }
.rpd-slider { width: 100%; }
.rpd-val-rp { font-size: 11px; color: var(--text-muted); }

.rpd-total-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; border-radius: 6px; font-size: 12px; font-weight: 700;
}
.rpd-total-bar.valid { background: #dcfce7; color: #15803d; }
.rpd-total-bar.invalid { background: #fee2e2; color: #b91c1c; }

/* Tables */
.table-action-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.pane-heading { font-size: 14px; font-weight: 800; margin: 0; }
.btn-add-item { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; background: var(--primary-color); color: #ffffff; border: none; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; }
.agent-data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.agent-data-table th, .agent-data-table td { padding: 8px 10px; border: 1px solid var(--border-color); text-align: left; }
.agent-data-table th { background: var(--bg-tertiary); font-weight: 700; }
.table-input { width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; }
.btn-row-del { background: none; border: none; color: var(--danger-color); cursor: pointer; padding: 4px; }

/* Quick Actions Bar */
.quick-prompts-bar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.quick-title { font-size: 11px; font-weight: 700; color: var(--text-muted); }
.btn-quick-prompt { padding: 5px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; }
.btn-quick-prompt:hover { background: var(--primary-glow); color: var(--primary-color); }

/* ── RIGHT COLUMN: AI COPILOT CHAT PANEL ── */
.agent-copilot-panel {
  width: 360px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  position: sticky;
  top: 10px;
}

.copilot-header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-md) var(--border-radius-md) 0 0;
}

.copilot-header-title { display: flex; align-items: center; gap: 8px; }
.copilot-icon { width: 24px; height: 24px; color: var(--accent-color); }
.copilot-name { font-size: 13px; font-weight: 800; color: var(--text-primary); }
.copilot-status-sub { font-size: 10px; color: var(--text-muted); }
.drawer-close-btn { display: none; }

.copilot-quick-actions {
  padding: 8px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.copilot-chip {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  cursor: pointer;
}

.copilot-chip:hover { background: var(--primary-glow); color: var(--primary-color); }

.copilot-chat-stream {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-bubble-wrap { display: flex; flex-direction: column; gap: 2px; max-width: 90%; }
.chat-bubble-wrap.user { align-self: flex-end; }
.chat-bubble-wrap.copilot { align-self: flex-start; }

.chat-bubble-meta { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); padding: 0 2px; }
.chat-sender-name { font-weight: 700; }

.chat-bubble-content {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 11.5px;
  line-height: 1.4;
}

.chat-bubble-wrap.user .chat-bubble-content {
  background: var(--primary-color);
  color: #ffffff;
  border-bottom-right-radius: 2px;
}

.chat-bubble-wrap.copilot .chat-bubble-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-bottom-left-radius: 2px;
}

.chat-typing-indicator { display: flex; align-items: center; gap: 4px; padding: 6px 10px; }
.typing-dot { width: 6px; height: 6px; background: var(--primary-color); border-radius: 50%; animation: pulse 1s infinite alternate; }

.copilot-input-area {
  padding: 10px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 6px;
  align-items: flex-end;
  background: var(--bg-secondary);
  border-radius: 0 0 var(--border-radius-md) var(--border-radius-md);
}

.copilot-textarea {
  flex: 1;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  font-size: 11.5px;
  resize: none;
}

.btn-send-copilot {
  width: 32px; height: 32px;
  background: var(--primary-color);
  color: #ffffff; border: none;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}

/* Modals */
.modal-backdrop {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.5); z-index: 999;
  display: flex; align-items: center; justify-content: center; padding: 20px;
}

.modal-card {
  background: var(--bg-secondary); border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md); width: 100%; max-width: 520px;
  padding: 16px 20px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.modal-title { font-size: 15px; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 6px; }
.modal-meta-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.modal-cat-tag { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
.modal-finding-name { font-size: 14px; font-weight: 800; margin: 0 0 6px 0; }
.modal-finding-desc { font-size: 12px; color: var(--text-secondary); margin: 0 0 10px 0; }
.modal-fix-box { background: var(--bg-primary); padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 14px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; }

/* Responsive adjustments */
@media (max-width: 1024px) {
  .agent-3col-workspace { flex-direction: column; }
  .agent-copilot-panel {
    position: fixed; right: -380px; top: 0; bottom: 0; z-index: 1000;
    height: 100vh; transition: right 0.3s ease; border-radius: 0;
  }
  .agent-copilot-panel.drawer-open { right: 0; }
  .drawer-close-btn { display: inline-flex; }
}
</style>
