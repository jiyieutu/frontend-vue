<script setup>
import { reactive, ref } from 'vue'
import { platformApi } from '../api/platform'

const message = ref('')
const createdJob = ref(null)
const form = reactive({ fileId: '', fileIdsText: '', taskId: '' })

async function submitByFile() {
  try {
    createdJob.value = await platformApi.submitRestore({ fileId: Number(form.fileId) })
    message.value = '恢复任务已提交。'
  } catch (error) {
    message.value = error.message
  }
}

async function submitBatch() {
  try {
    const fileIds = form.fileIdsText.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0)
    createdJob.value = await platformApi.submitRestore({ fileIds })
    message.value = '批量恢复任务已提交。'
  } catch (error) {
    message.value = error.message
  }
}

async function restartTask() {
  try {
    createdJob.value = await platformApi.submitRestore({ taskId: Number(form.taskId) })
    message.value = '回迁任务已重新执行。'
  } catch (error) {
    message.value = error.message
  }
}
</script>
<template>
  <section class="page-panel">
    <header class="page-header"><div><p class="eyebrow">Backup Platform</p><h2>恢复页</h2></div></header>
    <div class="page-grid-two">
      <article class="summary-card">
        <h3>按单文件恢复</h3>
        <input v-model="form.fileId" class="input-field" placeholder="文件 ID" />
        <button @click="submitByFile">提交恢复任务</button>
      </article>
      <article class="summary-card">
        <h3>按批量文件恢复</h3>
        <input v-model="form.fileIdsText" class="input-field" placeholder="文件 ID，逗号分隔" />
        <button @click="submitBatch">批量恢复</button>
      </article>
      <article class="summary-card">
        <h3>重新执行回迁任务</h3>
        <input v-model="form.taskId" class="input-field" placeholder="回迁任务 ID" />
        <button @click="restartTask">重新执行</button>
      </article>
    </div>
    <p v-if="message" class="feedback">{{ message }}</p>
    <div v-if="createdJob" class="summary-card"><h3>最近提交任务</h3><p>任务ID：{{ createdJob.id }}</p><p>状态：{{ createdJob.status }}</p><p>{{ createdJob.detail_message }}</p></div>
  </section>
</template>
