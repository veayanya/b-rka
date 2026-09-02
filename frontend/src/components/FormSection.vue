<template>
  <section class="config-container">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      
      <!-- Left panel: Parameter Kebijakan -->
      <div style="display: flex; flex-direction: column; gap: 24px;">

        <!-- List Active Rules -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <i data-lucide="check-square" class="icon-inline" style="color: var(--success-color);"></i> 
              Parameter Kebijakan & Threshold Audit
            </h2>
          </div>
          <div class="card-body">
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 20px;">
              Tentukan parameter ambang batas yang digunakan AI untuk mengevaluasi kepatuhan biaya e-SSH dan efisiensi sosial.
            </p>
            <div id="rules-settings-list" style="display: flex; flex-direction: column; gap: 8px;">
              <div v-for="rule in rules" :key="rule.id" class="rule-setting-row">
                <div class="rule-setting-info">
                  <span class="rule-setting-name">{{ rule.name }}</span>
                  <span class="rule-setting-desc">{{ rule.desc }}</span>
                </div>
                <label class="switch">
                  <input 
                    type="checkbox" 
                    :id="'chk-' + rule.id" 
                    v-model="rule.active"
                    @change="toggleRuleState(rule)"
                  >
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right panel: Add new standard rules -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Tambah Batas Aturan Kebijakan Baru</h2>
        </div>
        <div class="card-body">
          <form id="add-rule-form" @submit.prevent="submitNewRule">
            <div class="form-group">
              <label class="form-label" for="new-rule-name">Nama Parameter / Standar Kebijakan</label>
              <input 
                type="text" 
                id="new-rule-name" 
                class="form-input" 
                v-model="newRuleName"
                placeholder="Contoh: Batas Belanja Honorarium Kegiatan" 
                required
              >
            </div>
            <div class="form-group">
              <label class="form-label" for="new-rule-desc">Deskripsi & Threshold Anggaran</label>
              <textarea 
                id="new-rule-desc" 
                class="form-input" 
                rows="4" 
                v-model="newRuleDesc"
                placeholder="Tuliskan formula batasan anggaran atau instruksi spesifik untuk dipatuhi AI ketika menganalisis dokumen..." 
                required 
                style="resize: none;"
              ></textarea>
            </div>
            <div style="display: flex; justify-content: flex-end;">
              <button class="btn btn-primary" type="submit" id="btn-add-rule">
                <i data-lucide="plus-circle"></i> Tambah Parameter
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAnalysis } from '../composables/useAnalysis';

const {
  rules,
  showNotification
} = useAnalysis();

const newRuleName = ref('');
const newRuleDesc = ref('');

const toggleRuleState = (rule) => {
  showNotification("Aturan Diperbarui", `'${rule.name}' telah ${rule.active ? 'diaktifkan' : 'dinonaktifkan'}.`, "info");
};

const submitNewRule = () => {
  if (newRuleName.value.trim() && newRuleDesc.value.trim()) {
    const newId = 'rule-' + Date.now();
    rules.value.push({
      id: newId,
      name: newRuleName.value.trim(),
      desc: newRuleDesc.value.trim(),
      active: true
    });
    showNotification("Parameter Ditambahkan", `Aturan '${newRuleName.value}' telah diaktifkan di Mesin AI.`, "success");
    newRuleName.value = '';
    newRuleDesc.value = '';
  }
};

onMounted(() => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
});
</script>
