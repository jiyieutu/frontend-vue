<script setup>
import { onMounted, ref } from 'vue'
import { platformApi } from '../api/platform'

const jobs = ref([])
const logs = ref([])
const selectedJobId = ref('')
const message = ref('')

async function loadJobs() {
  try {
    const data = await platformApi.listJobs({ page: 1, pageSize: 50 })
    jobs.value = data.items || []
    if (!selectedJobId.value && jobs.value[0]) {
      selectedJobId.value = String(jobs.value[0].id)
      await loadLogs()
    }
  } catch (error) {
    message.value = error.message
  }
}

async function loadLogs() {
  if (!selectedJobId.value) return
  try {
    const data = await platformApi.getJobDetails(selectedJobId.value, { page: 1, pageSize: 100 })
    logs.value = data.items || []
  } catch (error) {
    message.value = error.message
  }
}

onMounted(loadJobs)
</script>
<template>
  <section class="page-panel">
    <header class="page-header"><div><p class="eyebrow">Backup Platform</p><h2>日志页</h2></div><div class="toolbar"><select v-model="selectedJobId" class="select-field"><option v-for="job in jobs" :key="job.id" :value="String(job.id)">#{{ job.id }} {{ job.job_type }}</option></select><button class="ghost" @click="loadLogs">查询</button></div></header>
    <p v-if="message" class="feedback">{{ message }}</p>
    <div class="table-wrapper"><table><thead><tr><th>ID</th><th>阶段</th><th>事件</th><th>消息</th><th>时间</th></tr></thead><tbody><tr v-for="log in logs" :key="log.id"><td>{{ log.id }}</td><td>{{ log.phase }}</td><td>{{ log.event_type }}</td><td>{{ log.message }}</td><td>{{ log.created_at }}</td></tr><tr v-if="!logs.length"><td colspan="5" class="empty">暂无日志</td></tr></tbody></table></div>
  </section>
</template>
