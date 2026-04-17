<script setup>
import { onMounted, reactive, ref } from 'vue'
import { platformApi } from '../api/platform'
import { apiBaseUrl } from '../lib/config'
import { sessionState } from '../lib/session'

const result = ref({ items: [] })
const filters = reactive({ keyword: '', status: '' })
const message = ref('')

async function load() {
  try {
    result.value = await platformApi.searchDeadLetters({ ...filters, page: 1, pageSize: 50 })
  } catch (error) {
    message.value = error.message
  }
}

async function requeue(item) {
  await platformApi.requeueDeadLetter(item.id)
  await load()
}

async function assign(item) {
  const assignedTo = window.prompt('请输入处理人', item.assigned_to || '')
  if (assignedTo === null) return
  await platformApi.assignDeadLetter(item.id, { assignedTo })
  await load()
}

async function note(item) {
  const note = window.prompt('请输入备注', item.note || '')
  if (note === null) return
  await platformApi.noteDeadLetter(item.id, { note })
  await load()
}

async function resolve(item) {
  const note = window.prompt('请输入闭环备注', '已人工确认并闭环')
  if (note === null) return
  await platformApi.resolveDeadLetter(item.id, { note })
  await load()
}

async function exportCsv() {
  const response = await fetch(`${apiBaseUrl}/platform/webhook-dead-letters/export`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionState.token || ''}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': window.localStorage.getItem('platform.tenantId') || 'default',
    },
    body: JSON.stringify({ ...filters, page: 1, pageSize: 500 }),
  })
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'webhook-dead-letters.csv'
  link.click()
  window.URL.revokeObjectURL(url)
}

onMounted(load)
</script>
<template>
  <section class="page-panel">
    <header class="page-header"><div><p class="eyebrow">P4 Delivery</p><h2>Webhook 死信处理台</h2></div><div class="toolbar"><input v-model="filters.keyword" class="input-field" placeholder="按事件、地址、备注搜索" /><select v-model="filters.status" class="select-field"><option value="">全部状态</option><option value="OPEN">OPEN</option><option value="REQUEUED">REQUEUED</option><option value="RESOLVED">RESOLVED</option></select><button class="ghost" @click="load">查询</button><button @click="exportCsv">导出CSV</button></div></header>
    <p v-if="message" class="feedback">{{ message }}</p>
    <div class="table-wrapper"><table><thead><tr><th>ID</th><th>事件</th><th>状态</th><th>处理人</th><th>重试</th><th>操作</th></tr></thead><tbody>
      <tr v-for="item in result.items || []" :key="item.id"><td>{{ item.id }}</td><td>{{ item.event_type }}</td><td>{{ item.status }}</td><td>{{ item.assigned_to || '--' }}</td><td>{{ item.retry_count }}</td><td class="actions"><button class="ghost" @click="assign(item)">分配</button><button class="ghost" @click="note(item)">备注</button><button class="ghost" @click="requeue(item)">重放</button><button class="danger" @click="resolve(item)">闭环</button></td></tr>
      <tr v-if="!(result.items || []).length"><td colspan="6" class="empty">暂无死信</td></tr>
    </tbody></table></div>
  </section>
</template>
