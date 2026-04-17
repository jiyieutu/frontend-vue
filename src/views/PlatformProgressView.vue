<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { platformApi } from '../api/platform'

const jobs = ref([])
const selectedJobId = ref('')
const progress = ref(null)
const message = ref('')
let source = null

async function loadJobs() {
  try {
    const data = await platformApi.listJobs({ page: 1, pageSize: 20 })
    jobs.value = data.items || []
    if (!selectedJobId.value && jobs.value[0]) {
      selectedJobId.value = String(jobs.value[0].id)
      await startStream()
    }
  } catch (error) {
    message.value = error.message
  }
}

async function startStream() {
  if (!selectedJobId.value) return
  if (source) source.close()
  progress.value = await platformApi.getJobProgress(selectedJobId.value)
  source = platformApi.streamJob(selectedJobId.value, (payload) => {
    progress.value = payload
  })
}

onMounted(loadJobs)
onBeforeUnmount(() => { if (source) source.close() })
</script>
<template>
  <section class="page-panel">
    <header class="page-header"><div><p class="eyebrow">Backup Platform</p><h2>进度页</h2></div><div class="toolbar"><select v-model="selectedJobId" class="select-field"><option v-for="job in jobs" :key="job.id" :value="String(job.id)">#{{ job.id }} {{ job.job_type }} / {{ job.status }}</option></select><button @click="startStream">订阅进度</button></div></header>
    <p v-if="message" class="feedback">{{ message }}</p>
    <div v-if="progress?.job" class="progress-card"><div class="progress-card__header"><strong>任务 {{ progress.job.id }}</strong><span>{{ progress.job.status }}</span></div><div class="progress-bar"><span :style="{ width: `${progress.job.progress_percent || 0}%` }"></span></div><p>{{ progress.job.progress_label }} · {{ progress.job.detail_message }}</p></div>
    <div class="table-wrapper"><table><thead><tr><th>阶段</th><th>事件</th><th>消息</th></tr></thead><tbody><tr v-for="detail in progress?.details || []" :key="detail.id"><td>{{ detail.phase }}</td><td>{{ detail.event_type }}</td><td>{{ detail.message }}</td></tr></tbody></table></div>
  </section>
</template>
