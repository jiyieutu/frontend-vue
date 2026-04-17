<script setup>
import { onMounted, reactive, ref } from 'vue'
import { platformApi } from '../api/platform'

const capabilities = ref(null)
const preview = ref(null)
const message = ref('')
const form = reactive({
  workloadType: 'filesystem',
  jobType: 'VERIFY',
  assetId: '',
  policyId: '',
  repositoryId: '',
  snapshotId: '',
  consistencyMode: 'fsfreeze',
  healthcheckSql: 'select not pg_is_in_recovery();',
  validateQuery: 'select 1 as backup_platform_check;',
})

async function loadCapabilities() {
  try {
    capabilities.value = await platformApi.enterpriseCapabilities()
  } catch (error) {
    message.value = error.message
  }
}

async function previewPlan() {
  try {
    preview.value = await platformApi.enterprisePreview(payload())
    message.value = '已生成企业级能力预览。'
  } catch (error) {
    message.value = error.message
  }
}

async function submitVerify() {
  try {
    const result = await platformApi.enterpriseSubmitVerify(payload())
    message.value = `验证任务已提交，任务ID：${result.id || result.jobId || '--'}`
  } catch (error) {
    message.value = error.message
  }
}

async function submitRestore() {
  try {
    const result = await platformApi.enterpriseSubmitRestore(payload())
    message.value = `恢复任务已提交，任务ID：${result.id || result.jobId || '--'}`
  } catch (error) {
    message.value = error.message
  }
}

function payload() {
  return {
    workloadType: form.workloadType,
    jobType: form.jobType,
    assetId: form.assetId || null,
    policyId: form.policyId || null,
    repositoryId: form.repositoryId || null,
    snapshotId: form.snapshotId || null,
    consistencyMode: form.consistencyMode,
    healthcheckSql: form.healthcheckSql,
    validateQuery: form.validateQuery,
  }
}

onMounted(loadCapabilities)
</script>

<template>
  <section class="page-panel">
    <header class="page-header">
      <div><p class="eyebrow">Enterprise Workloads</p><h2>P1 / P2 企业级 workload 能力</h2></div>
      <div class="toolbar">
        <button class="ghost" @click="loadCapabilities">刷新能力</button>
        <button class="ghost" @click="previewPlan">预览命令链</button>
        <button @click="submitVerify">提交验证</button>
        <button class="danger" @click="submitRestore">提交恢复</button>
      </div>
    </header>

    <div class="form-grid">
      <select v-model="form.workloadType" class="select-field">
        <option value="filesystem">filesystem</option>
        <option value="postgres">postgres</option>
        <option value="mysql">mysql</option>
        <option value="vmware">vmware</option>
      </select>
      <select v-model="form.jobType" class="select-field">
        <option value="VERIFY">VERIFY</option>
        <option value="RESTORE">RESTORE</option>
        <option value="BACKUP">BACKUP</option>
      </select>
      <input v-model="form.assetId" class="input-field" placeholder="资产ID" />
      <input v-model="form.policyId" class="input-field" placeholder="策略ID" />
      <input v-model="form.repositoryId" class="input-field" placeholder="仓库ID" />
      <input v-model="form.snapshotId" class="input-field" placeholder="快照ID（恢复/验证可选）" />
      <input v-model="form.consistencyMode" class="input-field" placeholder="文件系统一致性模式" />
      <input v-model="form.healthcheckSql" class="input-field" placeholder="PostgreSQL 健康检查 SQL" />
      <input v-model="form.validateQuery" class="input-field" placeholder="MySQL 校验 SQL" />
    </div>

    <p v-if="message" class="feedback">{{ message }}</p>

    <div class="page-grid-two">
      <article class="summary-card">
        <h3>能力清单</h3>
        <pre>{{ JSON.stringify(capabilities, null, 2) }}</pre>
      </article>
      <article class="summary-card">
        <h3>预览结果</h3>
        <pre>{{ JSON.stringify(preview, null, 2) }}</pre>
      </article>
    </div>
  </section>
</template>
