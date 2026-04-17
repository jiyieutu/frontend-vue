<script setup>
import { onMounted, reactive, ref, computed } from 'vue'
import { platformApi } from '../api/platform'

const assets = ref([])
const createdJob = ref(null)
const message = ref('')
const form = reactive({ workloadType: 'backup-account', assetId: '', backupMode: 'incremental', uploadAfterBackup: true })

const filteredAssets = computed(() =>
  assets.value.filter((asset) => (asset.assetType || asset.type) === form.workloadType || (form.workloadType === 'nas-target' && asset.type === 'filesystem')),
)

async function load() {
  try {
    const assetData = await platformApi.listAssets({ page: 1, pageSize: 200 })
    assets.value = assetData.items || []
    resetDefaultAsset()
  } catch (error) {
    message.value = error.message
  }
}

function resetDefaultAsset() {
  const first = filteredAssets.value[0]
  if (first) form.assetId = String(first.id)
}

async function submit() {
  try {
    createdJob.value = await platformApi.submitBackup({ ...form })
    message.value = '备份任务已提交并执行。'
  } catch (error) {
    message.value = error.message
  }
}

onMounted(load)
</script>
<template>
  <section class="page-panel">
    <header class="page-header"><div><p class="eyebrow">Backup Platform</p><h2>备份页</h2></div></header>
    <div class="form-grid">
      <select v-model="form.workloadType" class="select-field" @change="resetDefaultAsset"><option value="backup-account">备份客户端</option><option value="nas-target">NAS 备份</option></select>
      <select v-model="form.assetId" class="select-field"><option v-for="asset in filteredAssets" :key="`${asset.type}-${asset.id}`" :value="String(asset.id)">{{ asset.name }} ({{ asset.assetType || asset.type }})</option></select>
      <select v-model="form.backupMode" class="select-field"><option value="full">全量备份</option><option value="incremental">增量备份</option></select>
      <label class="checkbox-inline"><input v-model="form.uploadAfterBackup" type="checkbox" /> 备份后自动上传</label>
      <button @click="submit">提交备份任务</button>
    </div>
    <p v-if="message" class="feedback">{{ message }}</p>
    <div v-if="createdJob" class="summary-card"><h3>最近提交任务</h3><p>任务ID：{{ createdJob.id }}</p><p>状态：{{ createdJob.status }}</p><p>进度：{{ createdJob.progress_percent }}%</p><p>{{ createdJob.detail_message }}</p></div>
  </section>
</template>
