<script setup>
import { onMounted, reactive, ref } from 'vue'
import { platformApi } from '../api/platform'

const jobs = ref([])
const details = ref([])
const selectedJob = ref(null)
const loading = ref(false)
const filters = reactive({ status: '' })
const message = ref('')

async function load() {
  loading.value = true
  try {
    const data = await platformApi.listJobs({ status: filters.status, page: 1, pageSize: 50 })
    jobs.value = data.items || []
    if (jobs.value[0]) await selectJob(jobs.value[0])
  } catch (error) {
    message.value = error.message
  } finally {
    loading.value = false
  }
}

async function selectJob(job) {
  selectedJob.value = job
  const data = await platformApi.getJobDetails(job.id, { page: 1, pageSize: 20 })
  details.value = data.items || []
}

onMounted(load)
</script>
<template>
  <section class="page-panel page-grid-two">
    <div>
      <header class="page-header"><div><p class="eyebrow">Backup Platform</p><h2>任务中心页</h2></div><div class="toolbar"><select v-model="filters.status" class="select-field"><option value="">全部状态</option><option value="QUEUED">QUEUED</option><option value="RUNNING">RUNNING</option><option value="SUCCEEDED">SUCCEEDED</option></select><button class="ghost" @click="load">刷新</button></div></header>
      <p v-if="message" class="feedback">{{ message }}</p>
      <div class="table-wrapper"><table><thead><tr><th>ID</th><th>类型</th><th>工作负载</th><th>状态</th><th>进度</th></tr></thead><tbody>
        <tr v-for="job in jobs" :key="job.id" @click="selectJob(job)" :class="{ selected: selectedJob?.id === job.id }"><td>{{ job.id }}</td><td>{{ job.job_type }}</td><td>{{ job.workload_type }}</td><td>{{ job.status }}</td><td>{{ job.progress_percent }}%</td></tr>
        <tr v-if="!jobs.length && !loading"><td colspan="5" class="empty">暂无任务</td></tr>
      </tbody></table></div>
    </div>
    <div>
      <header class="page-header"><div><p class="eyebrow">Job Detail</p><h2>日志明细</h2></div></header>
      <div v-if="selectedJob" class="summary-card"><p>任务 {{ selectedJob.id }} · {{ selectedJob.progress_label || '--' }}</p><p>{{ selectedJob.detail_message || '--' }}</p></div>
      <div class="table-wrapper"><table><thead><tr><th>阶段</th><th>事件</th><th>消息</th><th>时间</th></tr></thead><tbody>
        <tr v-for="detail in details" :key="detail.id"><td>{{ detail.phase }}</td><td>{{ detail.event_type }}</td><td>{{ detail.message }}</td><td>{{ detail.created_at }}</td></tr>
        <tr v-if="!details.length"><td colspan="4" class="empty">暂无日志</td></tr>
      </tbody></table></div>
    </div>
  </section>
</template>
