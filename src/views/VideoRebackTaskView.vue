<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { videoRebackTaskApi } from '../api/video-reback-tasks'

const feedback = ref(null)
const loading = ref(false)
const pendingAction = ref('')
const tasks = ref([])

const filters = reactive({
  cameraTitle: '',
  endDateTo: '',
  fileName: '',
  startDateFrom: '',
  title: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 1))),
)

onMounted(() => {
  loadTasks(1, true)
})

function buildParams(page = pagination.page) {
  return {
    ...filters,
    page,
    pageSize: pagination.pageSize,
  }
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  return value
}

function formatCount(value) {
  return Number(value || 0).toLocaleString()
}

function statusClass(statusKey) {
  if (statusKey === 'completed') {
    return 'status-pill--active'
  }
  if (statusKey === 'running') {
    return 'status-pill--warning'
  }
  if (statusKey === 'deleted') {
    return 'status-pill--muted'
  }

  return 'status-pill--danger'
}

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
}

function actionKey(taskId, action) {
  return `${taskId}:${action}`
}

function isBusy(taskId, action) {
  return pendingAction.value === actionKey(taskId, action)
}

async function loadTasks(page = 1, silent = false) {
  loading.value = true

  try {
    const data = await videoRebackTaskApi.list(buildParams(page))
    tasks.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!tasks.value.length && !silent) {
      setFeedback('当前筛选条件下没有匹配的回迁任务。', 'warning')
    } else if (feedback.value?.tone === 'warning') {
      setFeedback('')
    }
  } catch (error) {
    if (!silent) {
      setFeedback(error.message, 'danger')
    }
  } finally {
    loading.value = false
  }
}

async function submitSearch() {
  pagination.page = 1
  await loadTasks(1)
}

async function resetSearch() {
  filters.cameraTitle = ''
  filters.endDateTo = ''
  filters.fileName = ''
  filters.startDateFrom = ''
  filters.title = ''
  pagination.page = 1
  await loadTasks(1)
}

async function previousPage() {
  if (pagination.page > 1) {
    await loadTasks(pagination.page - 1)
  }
}

async function nextPage() {
  if (pagination.page < totalPages.value) {
    await loadTasks(pagination.page + 1)
  }
}

async function restartTask(item) {
  if (!window.confirm(`确认重新回迁文件“${item.fileName}”吗？`)) {
    return
  }

  pendingAction.value = actionKey(item.id, 'restart')

  try {
    await videoRebackTaskApi.restart(item.id)
    setFeedback(`回迁任务“${item.fileName}”已重新提交。`, 'success')
    await loadTasks(pagination.page, true)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function deleteTask(item) {
  if (!window.confirm(`确认删除回迁任务“${item.fileName}”吗？`)) {
    return
  }

  pendingAction.value = actionKey(item.id, 'delete')

  try {
    await videoRebackTaskApi.remove(item.id)
    setFeedback(`回迁任务“${item.fileName}”已删除。`, 'success')
    await loadTasks(pagination.page, true)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function previewTask(item) {
  const previewWindow = window.open('', '_blank', 'noopener')
  pendingAction.value = actionKey(item.id, 'preview')

  try {
    const { blob } = await videoRebackTaskApi.fetchFile(item.id, 'preview')
    const url = window.URL.createObjectURL(blob)
    if (previewWindow) {
      previewWindow.location.href = url
    } else {
      window.open(url, '_blank', 'noopener')
    }
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000)
  } catch (error) {
    if (previewWindow) {
      previewWindow.close()
    }
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function downloadTask(item) {
  pendingAction.value = actionKey(item.id, 'download')

  try {
    const { blob, fileName } = await videoRebackTaskApi.fetchFile(item.id, 'download')
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName || item.fileName || 'video-reback-task.bin'
    anchor.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}
</script>

<template>
  <section class="content-grid">
    <article class="account-toolbar">
      <div>
        <p class="eyebrow">回迁任务</p>
        <h1>回迁任务列表</h1>
        <p>查看回迁任务的执行状态，并支持重新回迁、播放、下载和删除。</p>
      </div>

      <div class="account-toolbar__summary">
        <span class="metric-card__label">当前总数</span>
        <strong>{{ formatCount(pagination.total) }}</strong>
        <span>个任务</span>
      </div>
    </article>

    <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`">
      {{ feedback.message }}
    </div>

    <article class="panel">
      <div class="panel__toolbar panel__toolbar--stack">
        <div>
          <p class="eyebrow">筛选条件</p>
          <h2>按任务、摄像头、文件和采集时间查询</h2>
        </div>
      </div>

      <form class="toolbar-grid toolbar-grid--wide" @submit.prevent="submitSearch">
        <label class="field">
          <span class="field__label">任务名称</span>
          <input v-model.trim="filters.title" type="text" placeholder="请输入任务名称" />
        </label>

        <label class="field">
          <span class="field__label">摄像头</span>
          <input v-model.trim="filters.cameraTitle" type="text" placeholder="请输入摄像头名称" />
        </label>

        <label class="field">
          <span class="field__label">文件名</span>
          <input v-model.trim="filters.fileName" type="text" placeholder="请输入文件名" />
        </label>

        <label class="field">
          <span class="field__label">采集开始日期</span>
          <input v-model="filters.startDateFrom" type="date" />
        </label>

        <label class="field">
          <span class="field__label">采集结束日期</span>
          <input v-model="filters.endDateTo" type="date" />
        </label>

        <div class="inline-actions">
          <button type="submit" :disabled="loading">查询</button>
          <button type="button" class="ghost" :disabled="loading" @click="resetSearch">重置</button>
        </div>
      </form>
    </article>

    <article class="panel">
      <div class="panel__toolbar">
        <div>
          <p class="eyebrow">任务列表</p>
          <h2>共 {{ formatCount(pagination.total) }} 个回迁任务</h2>
        </div>

        <div class="page-nav">
          <button type="button" class="ghost" :disabled="loading || pagination.page <= 1" @click="previousPage">
            上一页
          </button>
          <span>第 {{ pagination.page }} 页 / {{ totalPages }}</span>
          <button type="button" class="ghost" :disabled="loading || pagination.page >= totalPages" @click="nextPage">
            下一页
          </button>
        </div>
      </div>

      <div class="account-table-wrap">
        <table class="account-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>任务</th>
              <th>摄像头</th>
              <th>状态</th>
              <th>文件</th>
              <th>大小</th>
              <th>采集开始</th>
              <th>采集结束</th>
              <th>申请时间</th>
              <th>到达时间</th>
              <th>有效期</th>
              <th>尝试次数</th>
              <th>存储目标</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="14" class="empty-cell">正在加载回迁任务...</td>
            </tr>
            <tr v-else-if="!tasks.length">
              <td colspan="14" class="empty-cell">未找到回迁任务。</td>
            </tr>
            <tr v-for="item in tasks" :key="item.id">
              <td>{{ formatValue(item.userCode) }}</td>
              <td>{{ formatValue(item.jobTitle) }}</td>
              <td>
                <strong>{{ formatValue(item.cameraTitle) }}</strong>
                <div class="subtle-text">{{ formatValue(item.ip) }}</div>
              </td>
              <td>
                <span class="status-pill" :class="statusClass(item.statusKey)">
                  {{ item.statusLabel }}
                </span>
              </td>
              <td>
                <strong>{{ formatValue(item.fileName) }}</strong>
                <div class="subtle-text">{{ formatValue(item.sourceTypeLabel) }}</div>
              </td>
              <td>{{ formatValue(item.fileSizeLabel) }}</td>
              <td>{{ formatValue(item.captureStartTime) }}</td>
              <td>{{ formatValue(item.captureEndTime) }}</td>
              <td>{{ formatValue(item.appDate) }}</td>
              <td>{{ formatValue(item.downDate) }}</td>
              <td>{{ formatValue(item.deletedAt) }}</td>
              <td>{{ formatValue(item.tryTime) }}</td>
              <td>
                <strong>{{ formatValue(item.storageTitle) }}</strong>
                <div class="subtle-text">{{ formatValue(item.storageTypeLabel) }}</div>
              </td>
              <td>
                <div class="action-group">
                  <button
                    type="button"
                    class="ghost"
                    :disabled="!item.fileExists || isBusy(item.id, 'preview')"
                    @click="previewTask(item)"
                  >
                    {{ isBusy(item.id, 'preview') ? '打开中...' : '播放' }}
                  </button>
                  <button
                    type="button"
                    class="ghost"
                    :disabled="!item.fileExists || isBusy(item.id, 'download')"
                    @click="downloadTask(item)"
                  >
                    {{ isBusy(item.id, 'download') ? '下载中...' : '下载' }}
                  </button>
                  <button
                    type="button"
                    class="ghost"
                    :disabled="isBusy(item.id, 'restart')"
                    @click="restartTask(item)"
                  >
                    {{ isBusy(item.id, 'restart') ? '处理中...' : '重新回迁' }}
                  </button>
                  <button
                    type="button"
                    class="danger"
                    :disabled="isBusy(item.id, 'delete')"
                    @click="deleteTask(item)"
                  >
                    {{ isBusy(item.id, 'delete') ? '删除中...' : '删除' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>
