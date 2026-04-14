<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { videoRebackTaskApi } from '../api/video-reback-tasks'
import { apiBaseUrl } from '../lib/config'
import { sessionState } from '../lib/session'

const feedback = ref(null)
const loading = ref(false)
const pendingAction = ref('')
const tasks = ref([])
const openActionMenuId = ref(null)
const actionMenuRefs = new Map()
const previewVideoRef = ref(null)

const previewDialog = reactive({
  cameraTitle: '',
  fileName: '',
  open: false,
  source: '',
  statusLabel: '',
  storageTitle: '',
})

const previewState = reactive({
  error: '',
  loading: false,
  ready: false,
})

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
  document.addEventListener('mousedown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  loadTasks(1, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
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
  if (statusKey === 'pending') {
    return 'status-pill--idle'
  }

  return 'status-pill--danger'
}

function localStatusClass(item) {
  if (item.fileExists) {
    return 'status-pill--active'
  }
  if (item.statusKey === 'deleted') {
    return 'status-pill--muted'
  }
  if (item.statusKey === 'running' || item.statusKey === 'pending') {
    return 'status-pill--warning'
  }
  return 'status-pill--idle'
}

function localStatusLabel(item) {
  if (item.fileExists) {
    return '本地可播'
  }
  if (item.statusKey === 'deleted') {
    return '本地已清理'
  }
  if (item.statusKey === 'running' || item.statusKey === 'pending') {
    return '待落地'
  }
  return '无本地副本'
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

function buildPreviewUrl(item) {
  const token = sessionState.token ? `?token=${encodeURIComponent(sessionState.token)}` : ''
  return `${apiBaseUrl}/video-reback-tasks/${item.id}/preview${token}`
}

function toggleActionMenu(taskId) {
  openActionMenuId.value = openActionMenuId.value === taskId ? null : taskId
}

function closeActionMenu() {
  openActionMenuId.value = null
}

function isActionMenuOpen(taskId) {
  return openActionMenuId.value === taskId
}

function setActionMenuRef(taskId, element) {
  if (element) {
    actionMenuRefs.set(taskId, element)
    return
  }
  actionMenuRefs.delete(taskId)
}

function handleDocumentPointerDown(event) {
  if (!openActionMenuId.value) {
    return
  }

  const container = actionMenuRefs.get(openActionMenuId.value)
  if (container && !container.contains(event.target)) {
    closeActionMenu()
  }
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    closePreviewDialog()
    closeActionMenu()
  }
}

async function loadTasks(page = 1, silent = false) {
  loading.value = true

  try {
    const data = await videoRebackTaskApi.list(buildParams(page))
    tasks.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0
    closeActionMenu()

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
  closeActionMenu()
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
    closeActionMenu()
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
    closeActionMenu()
    setFeedback(`回迁任务“${item.fileName}”已删除。`, 'success')
    await loadTasks(pagination.page, true)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function previewTask(item) {
  if (!item.fileExists) {
    return
  }

  pendingAction.value = actionKey(item.id, 'preview')
  previewDialog.fileName = formatValue(item.fileName)
  previewDialog.cameraTitle = formatValue(item.cameraTitle)
  previewDialog.storageTitle = formatValue(item.storageTitle)
  previewDialog.statusLabel = formatValue(item.statusLabel)
  previewDialog.source = buildPreviewUrl(item)
  previewState.error = ''
  previewState.loading = true
  previewState.ready = false
  previewDialog.open = true
  closeActionMenu()

  await nextTick()

  const video = previewVideoRef.value
  if (!video) {
    previewState.loading = false
    pendingAction.value = ''
    return
  }

  video.load()

  try {
    const playResult = video.play()
    if (playResult && typeof playResult.catch === 'function') {
      await playResult
    }
  } catch (error) {
    previewState.loading = false
    previewState.error = resolvePreviewError(error)
  } finally {
    pendingAction.value = ''
  }
}

function closePreviewDialog() {
  const video = previewVideoRef.value
  if (video) {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }

  previewDialog.cameraTitle = ''
  previewDialog.fileName = ''
  previewDialog.open = false
  previewDialog.source = ''
  previewDialog.statusLabel = ''
  previewDialog.storageTitle = ''
  previewState.error = ''
  previewState.loading = false
  previewState.ready = false
}

function handlePreviewCanPlay() {
  previewState.loading = false
  previewState.ready = true
  previewState.error = ''
}

function handlePreviewError() {
  previewState.loading = false
  previewState.ready = false
  previewState.error = resolveMediaError(previewVideoRef.value?.error)
}

function resolvePreviewError(error) {
  if (error?.name === 'AbortError') {
    return ''
  }
  if (error?.name === 'NotAllowedError') {
    return '浏览器拦截了自动播放，请再次点击播放按钮重试。'
  }
  if (error?.name === 'NotSupportedError') {
    return '当前回迁文件不是浏览器可直接播放的标准流，服务端正在尝试兼容预览。'
  }
  return '预览流启动失败，请稍后重试。'
}

function resolveMediaError(error) {
  const code = Number(error?.code || 0)
  if (code === 4) {
    return '当前回迁文件不是浏览器可直接播放的标准视频流，或服务端预览转换失败。'
  }
  if (code === 3) {
    return '视频解码失败，请稍后重试。'
  }
  if (code === 2) {
    return '预览流在传输过程中被中断，请重新打开播放窗口。'
  }
  return '预览流加载失败，请稍后重试。'
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
    closeActionMenu()
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}
</script>

<template>
  <section class="content-grid">
    <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`" style="margin-bottom: 1.5rem;">
      {{ feedback.message }}
    </div>

    <article class="panel reback-task__panel">
      <div class="panel__toolbar panel__toolbar--stack">
        <div>
          <p class="eyebrow">查询条件</p>
          <h2>回迁任务</h2>
          <p class="subtle-text" style="margin-top: 0.5rem; display: flex; gap: 1.5rem;">
            <span>当前总数：<strong style="color: var(--text);">{{ formatCount(pagination.total) }}</strong> 个任务</span>
          </p>
          <p class="subtle-text" style="margin-top: 0.5rem;">查看回迁任务的执行状态，并支持当前页预览、重新回迁、下载和删除。</p>
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

    <article class="panel reback-task__panel">
      <div class="panel__toolbar">
        <div>
          <p class="eyebrow">任务列表</p>
          <h2>共 {{ formatCount(pagination.total) }} 个回迁任务</h2>
          <p class="subtle-text">列表格式与文件管理保持一致，操作收敛到单个面板，不再在行内铺一长串按钮。</p>
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

      <div class="account-table-wrap reback-task__wrap">
        <table class="account-table reback-task__table">
          <colgroup>
            <col style="width: 110px" />
            <col style="width: 220px" />
            <col style="width: 220px" />
            <col style="width: 240px" />
            <col style="width: 250px" />
            <col style="width: 220px" />
            <col style="width: 180px" />
            <col style="width: 120px" />
          </colgroup>
          <thead>
            <tr>
              <th>账号</th>
              <th>任务</th>
              <th>摄像头</th>
              <th>文件</th>
              <th>时间</th>
              <th>状态</th>
              <th>存储目标</th>
              <th class="reback-task__action-col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="empty-cell">正在加载回迁任务...</td>
            </tr>
            <tr v-else-if="!tasks.length">
              <td colspan="8" class="empty-cell">未找到回迁任务。</td>
            </tr>
            <tr v-for="item in tasks" :key="item.id">
              <td class="reback-task__text-col">
                <div class="reback-task__cell-copy">
                  <strong class="reback-task__primary">{{ formatValue(item.userCode) }}</strong>
                  <div class="reback-task__secondary">{{ formatValue(item.sourceTypeLabel) }}</div>
                </div>
              </td>
              <td class="reback-task__text-col">
                <div class="reback-task__cell-copy">
                  <strong class="reback-task__primary" :title="formatValue(item.jobTitle)">{{ formatValue(item.jobTitle) }}</strong>
                  <div class="reback-task__secondary">有效期至 {{ formatValue(item.deletedAt) }}</div>
                </div>
              </td>
              <td class="reback-task__text-col">
                <div class="reback-task__cell-copy">
                  <strong class="reback-task__primary" :title="formatValue(item.cameraTitle)">{{ formatValue(item.cameraTitle) }}</strong>
                  <div class="reback-task__secondary">{{ formatValue(item.ip) }}</div>
                </div>
              </td>
              <td class="reback-task__text-col">
                <div class="reback-task__cell-copy">
                  <strong class="reback-task__primary" :title="formatValue(item.fileName)">{{ formatValue(item.fileName) }}</strong>
                  <div class="reback-task__secondary">{{ formatValue(item.fileSizeLabel) }}</div>
                </div>
              </td>
              <td class="reback-task__time">
                <div class="reback-task__time-entry">
                  <span class="reback-task__time-label">采集</span>
                  <span>{{ formatValue(item.captureStartTime) }}</span>
                </div>
                <div class="reback-task__time-entry">
                  <span class="reback-task__time-label">结束</span>
                  <span>{{ formatValue(item.captureEndTime) }}</span>
                </div>
                <div class="reback-task__time-entry">
                  <span class="reback-task__time-label">申请</span>
                  <span>{{ formatValue(item.appDate) }}</span>
                </div>
                <div class="reback-task__time-entry">
                  <span class="reback-task__time-label">到达</span>
                  <span>{{ formatValue(item.downDate) }}</span>
                </div>
              </td>
              <td>
                <div class="reback-task__status-stack">
                  <div class="reback-task__status-row">
                    <span class="status-pill" :class="statusClass(item.statusKey)">
                      {{ formatValue(item.statusLabel) }}
                    </span>
                    <span class="status-pill" :class="localStatusClass(item)">
                      {{ localStatusLabel(item) }}
                    </span>
                  </div>
                  <div class="reback-task__status-meta">
                    已尝试 {{ formatValue(item.tryTime) }} 次
                  </div>
                </div>
              </td>
              <td class="reback-task__text-col">
                <div class="reback-task__cell-copy">
                  <strong class="reback-task__primary" :title="formatValue(item.storageTitle)">{{ formatValue(item.storageTitle) }}</strong>
                  <div class="reback-task__secondary">{{ formatValue(item.storageTypeLabel) }}</div>
                </div>
              </td>
              <td class="reback-task__action-col">
                <div
                  :ref="(element) => setActionMenuRef(item.id, element)"
                  class="reback-task__action"
                >
                  <button
                    type="button"
                    class="ghost reback-task__action-trigger"
                    :aria-controls="`reback-actions-${item.id}`"
                    :aria-expanded="isActionMenuOpen(item.id)"
                    @click="toggleActionMenu(item.id)"
                  >
                    {{ isActionMenuOpen(item.id) ? '收起操作' : '操作' }}
                  </button>

                  <div
                    v-if="isActionMenuOpen(item.id)"
                    :id="`reback-actions-${item.id}`"
                    class="reback-task__action-menu"
                  >
                    <button
                      type="button"
                      class="ghost reback-task__action-item"
                      :disabled="!item.fileExists || isBusy(item.id, 'preview')"
                      @click="previewTask(item)"
                    >
                      {{ isBusy(item.id, 'preview') ? '打开中...' : '播放' }}
                    </button>
                    <button
                      type="button"
                      class="ghost reback-task__action-item"
                      :disabled="!item.fileExists || isBusy(item.id, 'download')"
                      @click="downloadTask(item)"
                    >
                      {{ isBusy(item.id, 'download') ? '下载中...' : '下载' }}
                    </button>
                    <button
                      type="button"
                      class="ghost reback-task__action-item"
                      :disabled="isBusy(item.id, 'restart')"
                      @click="restartTask(item)"
                    >
                      {{ isBusy(item.id, 'restart') ? '处理中...' : '重新回迁' }}
                    </button>
                    <button
                      type="button"
                      class="reback-task__action-item reback-task__action-item--danger"
                      :disabled="isBusy(item.id, 'delete')"
                      @click="deleteTask(item)"
                    >
                      {{ isBusy(item.id, 'delete') ? '删除中...' : '删除' }}
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="panel__footer" style="display: flex; justify-content: flex-end; margin-top: 1rem;">
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
    </article>

    <div v-if="previewDialog.open" class="reback-preview-dialog" @click="closePreviewDialog">
      <div class="reback-preview-dialog__panel" @click.stop>
        <div class="reback-preview-dialog__header">
          <div>
            <p class="eyebrow">回迁预览</p>
            <h2>{{ previewDialog.fileName }}</h2>
            <p class="subtle-text">
              {{ previewDialog.cameraTitle }}
              <span v-if="previewDialog.storageTitle !== '--'"> · {{ previewDialog.storageTitle }}</span>
              <span v-if="previewDialog.statusLabel !== '--'"> · {{ previewDialog.statusLabel }}</span>
            </p>
          </div>

          <button type="button" class="ghost" @click="closePreviewDialog">关闭</button>
        </div>

        <div class="reback-preview-dialog__body">
          <p v-if="previewState.loading" class="reback-preview-dialog__hint">
            正在准备预览流，较大的录像可能需要几秒。
          </p>
          <div v-if="previewState.error" class="reback-preview-dialog__error">
            {{ previewState.error }}
          </div>
          <video
            v-if="previewDialog.source"
            ref="previewVideoRef"
            :src="previewDialog.source"
            class="reback-preview-dialog__player"
            controls
            autoplay
            playsinline
            preload="metadata"
            @canplay="handlePreviewCanPlay"
            @error="handlePreviewError"
          >
            当前浏览器不支持视频播放。
          </video>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.reback-task__panel {
  min-width: 0;
  overflow: hidden;
}

.reback-task__wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  overscroll-behavior-x: contain;
}

.reback-task__table {
  min-width: 1560px;
  table-layout: fixed;
}

.reback-task__table th,
.reback-task__table td {
  vertical-align: middle;
  min-width: 0;
}

.reback-task__text-col {
  min-width: 0;
}

.reback-task__cell-copy {
  display: grid;
  gap: 0.28rem;
  min-width: 0;
}

.reback-task__primary,
.reback-task__secondary {
  display: -webkit-box;
  overflow: hidden;
  max-width: 100%;
  -webkit-box-orient: vertical;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.reback-task__primary {
  line-height: 1.45;
  -webkit-line-clamp: 2;
}

.reback-task__secondary {
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.4;
  -webkit-line-clamp: 2;
}

.reback-task__time {
  display: grid;
  gap: 0.38rem;
}

.reback-task__time-entry {
  display: flex;
  gap: 0.55rem;
  align-items: center;
}

.reback-task__time-label {
  min-width: 2.4rem;
  color: rgba(32, 54, 73, 0.68);
  font-weight: 600;
}

.reback-task__status-stack {
  display: grid;
  gap: 0.45rem;
}

.reback-task__status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.reback-task__status-meta {
  color: rgba(32, 54, 73, 0.68);
  font-size: 0.9rem;
}

.reback-task__action-col {
  width: 120px;
}

.reback-task__action {
  position: relative;
}

.reback-task__action-trigger {
  min-width: 88px;
}

.reback-task__action-menu {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 12;
  display: grid;
  gap: 0.5rem;
  min-width: 168px;
  padding: 0.8rem;
  border: 1px solid rgba(22, 59, 54, 0.12);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 244, 237, 0.95));
  box-shadow: 0 18px 36px rgba(22, 48, 43, 0.12);
}

.reback-task__action-item {
  width: 100%;
}

.reback-task__action-item--danger {
  border: 1px solid rgba(177, 54, 68, 0.18);
  color: #9b2936;
  background: rgba(255, 243, 244, 0.88);
}

.reback-task__action-item--danger:hover:not(:disabled),
.reback-task__action-item--danger:focus-visible:not(:disabled) {
  background: rgba(255, 233, 236, 0.98);
}

.reback-preview-dialog {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgba(12, 24, 35, 0.56);
  backdrop-filter: blur(6px);
}

.reback-preview-dialog__panel {
  display: grid;
  gap: 1rem;
  width: min(960px, 100%);
  max-height: calc(100vh - 3rem);
  padding: 1.15rem;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(245, 248, 251, 0.95));
  box-shadow: 0 26px 54px rgba(10, 23, 35, 0.2);
}

.reback-preview-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.reback-preview-dialog__header h2 {
  margin: 0.2rem 0 0;
  font-size: 1.15rem;
}

.reback-preview-dialog__body {
  display: grid;
  gap: 0.85rem;
  min-height: 0;
}

.reback-preview-dialog__player {
  width: 100%;
  max-height: calc(100vh - 12rem);
  border-radius: 18px;
  background: #09131c;
}

.reback-preview-dialog__hint {
  margin: 0;
  color: rgba(32, 54, 73, 0.7);
  font-size: 0.92rem;
}

.reback-preview-dialog__error {
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(177, 54, 68, 0.18);
  border-radius: 14px;
  background: rgba(255, 243, 244, 0.92);
  color: #9b2936;
  font-size: 0.92rem;
  line-height: 1.55;
}

@media (max-width: 1200px) {
  .reback-task__table {
    min-width: 1320px;
  }
}
</style>
