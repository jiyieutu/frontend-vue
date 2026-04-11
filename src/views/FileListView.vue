<script setup>
import { reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fileApi } from '../api/files'
import { videoRebackTaskApi } from '../api/video-reback-tasks'

const route = useRoute()
const router = useRouter()

const feedback = ref(null)
const files = ref([])
const loading = ref(false)
const pendingAction = ref('')

const filters = reactive({
  cameraTitle: '',
  detailId: '',
  endDateTo: '',
  fileName: '',
  flag: '',
  ip: '',
  isDown: '',
  isUpload: '',
  magazine: '',
  noteInfo: '',
  planId: '',
  startDateFrom: '',
  title: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

watch(
  () => route.query,
  async (query) => {
    applyQueryFilters(query)
    await loadFiles(1)
  },
  { immediate: true },
)

function applyQueryFilters(query) {
  filters.cameraTitle = query.cameraTitle ? String(query.cameraTitle) : ''
  filters.detailId = query.detailId ? String(query.detailId) : ''
  filters.endDateTo = query.endDateTo ? String(query.endDateTo) : ''
  filters.fileName = query.fileName ? String(query.fileName) : ''
  filters.flag = query.flag ? String(query.flag) : ''
  filters.ip = query.ip ? String(query.ip) : ''
  filters.isDown = query.isDown ? String(query.isDown) : ''
  filters.isUpload = query.isUpload ? String(query.isUpload) : ''
  filters.magazine = query.magazine ? String(query.magazine) : ''
  filters.noteInfo = query.noteInfo ? String(query.noteInfo) : ''
  filters.planId = query.planId ? String(query.planId) : ''
  filters.startDateFrom = query.startDateFrom ? String(query.startDateFrom) : ''
  filters.title = query.title ? String(query.title) : ''
}

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
}

function actionKey(fileId, action) {
  return `${fileId}:${action}`
}

function isBusy(fileId, action) {
  return pendingAction.value === actionKey(fileId, action)
}

function canPreviewOrDownload(item) {
  return item.fileExists || item.rebackFileExists
}

function localStatusLabel(item) {
  if (item.fileExists) {
    return '服务器本地'
  }
  if (item.rebackFileExists) {
    return '回迁缓存'
  }
  return '无本地副本'
}

function localStatusClass(item) {
  if (item.fileExists) {
    return 'status-pill--active'
  }
  if (item.rebackFileExists) {
    return 'status-pill--warning'
  }
  return 'status-pill--idle'
}

function rebackStatusClass(statusKey) {
  if (statusKey === 'completed') {
    return 'status-pill--active'
  }
  if (statusKey === 'running' || statusKey === 'pending') {
    return 'status-pill--warning'
  }
  if (statusKey === 'failed') {
    return 'status-pill--danger'
  }
  if (statusKey === 'deleted') {
    return 'status-pill--muted'
  }
  return 'status-pill--idle'
}

function canCreateReback(item) {
  return !item.fileExists && item.isUpload === 'Y'
}

function isRebackSupported(item) {
  return item.storageTypeCode === 0 || item.storageTypeCode === 2
}

function rebackActionLabel(item) {
  if (item.rebackStatusKey === 'running') {
    return '回迁中'
  }
  if (item.rebackStatusKey === 'pending') {
    return '待回迁'
  }
  if (item.rebackStatusKey === 'failed' || item.rebackStatusKey === 'deleted') {
    return '重新回迁'
  }
  return '添加回迁'
}

async function loadFiles(page = 1) {
  loading.value = true

  try {
    const data = await fileApi.list({
      ...filters,
      page,
      pageSize: pagination.pageSize,
    })
    files.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!files.value.length) {
      setFeedback('当前筛选条件下没有匹配文件。', 'warning')
    } else if (feedback.value?.tone === 'warning') {
      setFeedback('')
    }
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    loading.value = false
  }
}

async function submitSearch() {
  await loadFiles(1)
}

async function resetSearch() {
  filters.cameraTitle = ''
  filters.detailId = ''
  filters.endDateTo = ''
  filters.fileName = ''
  filters.flag = ''
  filters.ip = ''
  filters.isDown = ''
  filters.isUpload = ''
  filters.magazine = ''
  filters.noteInfo = ''
  filters.planId = ''
  filters.startDateFrom = ''
  filters.title = ''

  if (Object.keys(route.query).length) {
    await router.replace({ name: 'files', query: {} })
    return
  }

  await loadFiles(1)
}

async function previousPage() {
  if (pagination.page > 1) {
    await loadFiles(pagination.page - 1)
  }
}

async function nextPage() {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
  if (pagination.page < totalPages) {
    await loadFiles(pagination.page + 1)
  }
}

async function previewItem(item) {
  if (!canPreviewOrDownload(item)) {
    return
  }

  const previewWindow = window.open('', '_blank', 'noopener')
  pendingAction.value = actionKey(item.id, 'preview')

  try {
    const result = item.fileExists
      ? await fileApi.fetchFile(item.id, 'preview')
      : await videoRebackTaskApi.fetchFile(item.rebackTaskId, 'preview')
    const url = window.URL.createObjectURL(result.blob)

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

async function downloadItem(item) {
  if (!canPreviewOrDownload(item)) {
    return
  }

  pendingAction.value = actionKey(item.id, 'download')

  try {
    const result = item.fileExists
      ? await fileApi.fetchFile(item.id, 'download')
      : await videoRebackTaskApi.fetchFile(item.rebackTaskId, 'download')
    const url = window.URL.createObjectURL(result.blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = result.fileName || item.fileName || 'video-file.bin'
    anchor.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function createRebackTask(item) {
  if (!canCreateReback(item)) {
    return
  }
  if (!isRebackSupported(item)) {
    setFeedback('当前回迁仅支持对象存储和 NAS。', 'warning')
    return
  }

  pendingAction.value = actionKey(item.id, 'reback')

  try {
    const result = await fileApi.createRebackTask(item.id)
    if (result.statusKey === 'completed') {
      setFeedback(`文件“${item.fileName}”的本地副本已就绪，可直接播放或下载。`, 'success')
    } else if (result.created) {
      setFeedback(`文件“${item.fileName}”已加入回迁任务，请稍后刷新或到“回迁任务”查看进度。`, 'success')
    } else {
      setFeedback(`文件“${item.fileName}”已有回迁任务，请到“回迁任务”查看进度。`, 'warning')
    }
    await loadFiles(pagination.page)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function openRebackTasks(item) {
  await router.push({
    name: 'video-reback-tasks',
    query: {
      fileName: item.fileName || '',
    },
  })
}
</script>

<template>
  <section class="content-grid">
    <article class="panel">
      <div class="account-toolbar">
        <div>
          <p class="eyebrow">文件管理</p>
          <h1>文件列表</h1>
          <p>按任务、摄像头、时间和传输状态查询文件，并支持本地播放、下载和添加回迁任务。</p>
        </div>

        <div class="account-toolbar__summary">
          <span class="metric-card__label">总数</span>
          <strong>{{ pagination.total }}</strong>
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
          <span class="field__label">盘号</span>
          <input v-model.trim="filters.magazine" type="text" placeholder="RFID 或磁盘编号" />
        </label>

        <label class="field">
          <span class="field__label">开始日期</span>
          <input v-model="filters.startDateFrom" type="date" />
        </label>

        <label class="field">
          <span class="field__label">结束日期</span>
          <input v-model="filters.endDateTo" type="date" />
        </label>

        <label class="field">
          <span class="field__label">备注</span>
          <input v-model.trim="filters.noteInfo" type="text" placeholder="请输入任务备注" />
        </label>

        <label class="field">
          <span class="field__label">IP</span>
          <input v-model.trim="filters.ip" type="text" placeholder="请输入摄像头 IP" />
        </label>

        <label class="field">
          <span class="field__label">标识</span>
          <input v-model.trim="filters.flag" type="text" placeholder="请输入磁盘状态标识" />
        </label>

        <label class="field">
          <span class="field__label">是否下载</span>
          <select v-model="filters.isDown" class="select-field">
            <option value="">全部</option>
            <option value="Y">是</option>
            <option value="N">否</option>
          </select>
        </label>

        <label class="field">
          <span class="field__label">是否上传</span>
          <select v-model="filters.isUpload" class="select-field">
            <option value="">全部</option>
            <option value="Y">是</option>
            <option value="N">否</option>
          </select>
        </label>

        <div class="inline-actions">
          <button type="submit" :disabled="loading">查询</button>
          <button type="button" class="ghost" :disabled="loading" @click="resetSearch">重置</button>
        </div>
      </form>

      <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`">
        {{ feedback.message }}
      </div>
    </article>

    <article class="panel">
      <div class="panel__toolbar">
        <div>
          <p class="eyebrow">查询结果</p>
          <h2>文件列表</h2>
        </div>
        <div class="page-nav">
          <button type="button" class="ghost" :disabled="loading || pagination.page <= 1" @click="previousPage">
            上一页
          </button>
          <span>
            第 {{ pagination.page }} 页 /
            {{ Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) }}
          </span>
          <button
            type="button"
            class="ghost"
            :disabled="loading || pagination.page >= Math.max(1, Math.ceil(pagination.total / pagination.pageSize))"
            @click="nextPage"
          >
            下一页
          </button>
        </div>
      </div>

      <div class="account-table-wrap">
        <table class="account-table file-list__table">
          <thead>
            <tr>
              <th>任务</th>
              <th>摄像头</th>
              <th>存储设备</th>
              <th>文件</th>
              <th>大小</th>
              <th>采集时间</th>
              <th>传输状态</th>
              <th>本地状态</th>
              <th>回迁状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="10" class="empty-cell">文件加载中...</td>
            </tr>
            <tr v-else-if="!files.length">
              <td colspan="10" class="empty-cell">未找到文件。</td>
            </tr>
            <tr v-for="item in files" :key="item.id">
              <td>
                <strong class="file-list__name">{{ item.jobTitle || '--' }}</strong>
                <div class="subtle-text">{{ item.noteInfo || '--' }}</div>
              </td>
              <td>
                <strong>{{ item.cameraTitle || '--' }}</strong>
                <div class="subtle-text">{{ item.ip || '--' }}</div>
              </td>
              <td>
                <strong>{{ item.storageTypeLabel || '--' }}</strong>
                <div class="subtle-text">{{ item.storageTitle || '--' }}</div>
              </td>
              <td>
                <strong class="file-list__name">{{ item.fileName || '--' }}</strong>
                <div class="subtle-text file-list__path">
                  {{ item.uploadFileName || item.localFullName || '--' }}
                </div>
              </td>
              <td>{{ item.fileSizeLabel }}</td>
              <td class="file-list__time">
                <div>{{ item.captureStartTime || '--' }}</div>
                <div class="subtle-text">{{ item.captureEndTime || '--' }}</div>
              </td>
              <td>
                <div class="file-list__status-group">
                  <span class="status-pill" :class="item.isDown === 'Y' ? 'status-pill--active' : 'status-pill--idle'">
                    {{ item.isDown === 'Y' ? '已下载' : '未下载' }}
                  </span>
                  <span class="status-pill" :class="item.isUpload === 'Y' ? 'status-pill--active' : 'status-pill--idle'">
                    {{ item.isUpload === 'Y' ? '已上传' : '未上传' }}
                  </span>
                </div>
              </td>
              <td>
                <span class="status-pill" :class="localStatusClass(item)">
                  {{ localStatusLabel(item) }}
                </span>
              </td>
              <td>
                <span class="status-pill" :class="rebackStatusClass(item.rebackStatusKey)">
                  {{ item.rebackStatusLabel }}
                </span>
              </td>
              <td>
                <div class="file-list__actions">
                  <button
                    type="button"
                    class="ghost"
                    :disabled="!canPreviewOrDownload(item) || isBusy(item.id, 'preview')"
                    @click="previewItem(item)"
                  >
                    {{ isBusy(item.id, 'preview') ? '打开中...' : '播放' }}
                  </button>
                  <button
                    type="button"
                    class="ghost"
                    :disabled="!canPreviewOrDownload(item) || isBusy(item.id, 'download')"
                    @click="downloadItem(item)"
                  >
                    {{ isBusy(item.id, 'download') ? '下载中...' : '下载' }}
                  </button>
                  <button
                    v-if="canCreateReback(item)"
                    type="button"
                    class="ghost"
                    :disabled="isBusy(item.id, 'reback') || !isRebackSupported(item) || item.rebackStatusKey === 'running' || item.rebackStatusKey === 'pending'"
                    @click="createRebackTask(item)"
                  >
                    {{ isBusy(item.id, 'reback') ? '提交中...' : rebackActionLabel(item) }}
                  </button>
                  <button
                    v-if="item.rebackTaskId"
                    type="button"
                    class="ghost"
                    :disabled="isBusy(item.id, 'route')"
                    @click="openRebackTasks(item)"
                  >
                    查看回迁
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

<style scoped>
.file-list__table td {
  vertical-align: top;
}

.file-list__name,
.file-list__path {
  display: block;
  max-width: 28rem;
  word-break: break-all;
}

.file-list__path {
  margin-top: 0.35rem;
}

.file-list__time {
  min-width: 12rem;
}

.file-list__status-group,
.file-list__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.file-list__actions {
  min-width: 13rem;
}

.file-list__actions button {
  white-space: nowrap;
}
</style>
