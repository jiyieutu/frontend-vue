<script setup>
import { onMounted, reactive, ref } from 'vue'
import { platformApi } from '../api/platform'

const rows = ref([])
const message = ref('')
const form = reactive({
  name: '',
  workloadType: 'video-plan',
  repositoryId: '',
  accountId: '',
  cameraIdsText: '',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  startHour: '00',
  startMinute: '00',
  endHour: '23',
  endMinute: '59',
  runType: 0,
  storageType: 2,
  storageId: 0,
  uploadMode: 2,
  uploadTimeHour: '02',
  uploadTimeMinute: '00',
})

async function load() {
  try {
    const data = await platformApi.listPolicies({ page: 1, pageSize: 100 })
    rows.value = data.items || []
  } catch (error) {
    message.value = error.message
  }
}

async function createPolicy() {
  try {
    const cameraIds = form.cameraIdsText
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item > 0)
    await platformApi.createPolicy({
      name: form.name,
      accountId: Number(form.accountId),
      cameraIds,
      startDate: form.startDate,
      endDate: form.endDate,
      startHour: form.startHour,
      startMinute: form.startMinute,
      endHour: form.endHour,
      endMinute: form.endMinute,
      runType: Number(form.runType),
      storageType: Number(form.storageType),
      storageId: Number(form.storageId),
      uploadMode: Number(form.uploadMode),
      uploadTimeHour: form.uploadTimeHour,
      uploadTimeMinute: form.uploadTimeMinute,
    })
    message.value = '策略已创建。'
    form.name = ''
    await load()
  } catch (error) {
    message.value = error.message
  }
}

onMounted(load)
</script>
<template>
  <section class="page-panel">
    <header class="page-header"><div><p class="eyebrow">Backup Platform</p><h2>策略管理</h2></div></header>
    <div class="form-grid">
      <input v-model="form.name" class="input-field" placeholder="策略/计划名称" />
      <input v-model="form.accountId" class="input-field" placeholder="平台 ID" />
      <input v-model="form.cameraIdsText" class="input-field" placeholder="摄像头 ID，逗号分隔" />
      <input v-model="form.storageId" class="input-field" placeholder="存储设备 ID" />
      <input v-model="form.startDate" class="input-field" type="date" />
      <input v-model="form.endDate" class="input-field" type="date" />
      <button @click="createPolicy">新增策略</button>
    </div>
    <p v-if="message" class="feedback">{{ message }}</p>
    <div class="table-wrapper"><table><thead><tr><th>ID</th><th>名称</th><th>类型</th><th>存储</th><th>调度</th></tr></thead><tbody>
      <tr v-for="item in rows" :key="item.id"><td>{{ item.id }}</td><td>{{ item.name }}</td><td>{{ item.workload_type }}</td><td>{{ item.repository_id || item.storageId || '--' }}</td><td>{{ item.schedule_expr || item.runTypeLabel || '--' }}</td></tr>
      <tr v-if="!rows.length"><td colspan="5" class="empty">暂无策略</td></tr>
    </tbody></table></div>
  </section>
</template>
