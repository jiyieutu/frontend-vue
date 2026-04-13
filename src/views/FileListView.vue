<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fileApi } from '../api/files'
import { apiBaseUrl } from '../lib/config'
import { sessionState } from '../lib/session'

const route = useRoute()
const router = useRouter()

const feedback = ref(null)
const files = ref([])
const loading = ref(false)
const batchSubmitting = ref(false)
const selectedFileIds = ref([])
const openActionMenuId = ref(null)
const actionMenuRefs = new Map()
const previewVideoRef = ref(null)
const previewDialog = reactive({
  cameraTitle: '',
  fileName: '',
  open: false,
  source: '',
  storageTitle: '',
  storageTypeLabel: '',
})
const previewState = reactive({
  error: '',
  loading: false,
  ready: false,
})

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

const columnWidths = reactive({
  camera: 220,
  file: 260,
  job: 240,
})
const resizeState = ref(null)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 1))),
)

const tableLayoutWidth = computed(() => 620 + columnWidths.job + columnWidths.camera + columnWidths.file)

const selectableFileIds = computed(() =>
  files.value.filter((item) => canSelectReback(item)).map((item) => item.id),
)

const selectedCount = computed(() => selectedFileIds.value.length)

const allSelectableChecked = computed(() =>
  selectableFileIds.value.length > 0 &&
  selectableFileIds.value.every((id) => selectedFileIds.value.includes(id)),
)

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  document.addEventListener('mousemove', handleDocumentMouseMove)
  document.addEventListener('mouseup', handleDocumentMouseUp)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)
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

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }
  return value
}

function formatCount(value) {
  return Number(value || 0).toLocaleString()
}

function normalizeColumnWidth(value, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.min(520, Math.max(180, Math.round(numeric)))
}

function applyAutoColumnWidths(items) {
  columnWidths.job = estimateStructuredColumnWidth(
    items.map((item) => item.jobTitle),
    items.map((item) => item.noteInfo),
    150,
    280,
  )
  columnWidths.camera = estimateStructuredColumnWidth(
    items.map((item) => item.cameraTitle),
    items.map((item) => item.ip),
    150,
    260,
  )
  columnWidths.file = estimateStructuredColumnWidth(
    items.map((item) => item.fileName),
    items.map((item) => item.accountTitle),
    180,
    320,
  )
}

function estimateStructuredColumnWidth(primaryValues, secondaryValues, minWidth, maxWidth) {
  const primaryLength = representativeLength(primaryValues)
  const secondaryLength = representativeLength(secondaryValues)
  return Math.min(
    maxWidth,
    Math.max(minWidth, 28 + primaryLength * 7 + Math.min(secondaryLength, 16) * 1.5),
  )
}

function representativeLength(values) {
  const lengths = values
    .map((value) => Array.from(formatValue(value)).length)
    .filter((length) => length > 0)
    .sort((left, right) => left - right)

  if (!lengths.length) {
    return 0
  }

  const index = Math.min(lengths.length - 1, Math.floor(lengths.length * 0.8))
  return lengths[index]
}

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
}

function previewAvailable(item) {
  return item.fileExists || item.rebackFileExists
}

function canShowReback(item) {
  return item.isUpload === 'Y'
}

function isRebackSupported(item) {
  return item.storageTypeCode === 0 || item.storageTypeCode === 2 || item.storageTypeCode === 4
}

function canSelectReback(item) {
  return canShowReback(item) && isRebackSupported(item)
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

function captureStatusClass(item) {
  return item.isDown === 'Y' ? 'status-pill--active' : 'status-pill--idle'
}

function uploadStatusClass(item) {
  return item.isUpload === 'Y' ? 'status-pill--active' : 'status-pill--idle'
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

function buildPreviewUrl(item) {
  const basePath = item.fileExists
    ? `/files/${item.id}/preview`
    : `/video-reback-tasks/${item.rebackTaskId}/preview`
  const token = sessionState.token ? `?token=${encodeURIComponent(sessionState.token)}` : ''
  return `${apiBaseUrl}${basePath}${token}`
}

function resolveStorageLocation(item) {
  if (item.uploadFileName) {
    return item.uploadFileName
  }
  if (item.localFullName) {
    return item.localFullName
  }
  if (item.rebackLocalFileName) {
    return item.rebackLocalFileName
  }
  return '--'
}

function resolveStorageDeviceTitle(item) {
  if (item.storageTypeCode === 4) {
    return '光盘库存储'
  }
  return formatValue(item.storageTitle)
}

function resolveDiscGroupTitle(item) {
  return formatValue(item.storageTitle)
}

function resolveDiscMagazineTitle(item) {
  if (item.discBarcode) {
    return item.discBarcode
  }
  if (item.magazine) {
    return item.magazine
  }
  return '--'
}

function resolveDiscMagazineMeta(item) {
  const parts = []
  if (item.discBarcode) {
    parts.push(`条码 ${item.discBarcode}`)
  }
  if (item.magazine) {
    parts.push(`RFID ${item.magazine}`)
  }
  if (Number(item.discSlotNo || 0) > 0) {
    parts.push(`槽位 ${item.discSlotNo}`)
  }
  return parts.length ? parts.join(' · ') : '--'
}

function syncSelectedFiles() {
  const allowedIds = new Set(selectableFileIds.value)
  selectedFileIds.value = selectedFileIds.value.filter((id) => allowedIds.has(id))
}

function toggleSelectAll() {
  if (allSelectableChecked.value) {
    selectedFileIds.value = []
    return
  }
  selectedFileIds.value = selectableFileIds.value.slice()
}

function toggleActionMenu(fileId) {
  openActionMenuId.value = openActionMenuId.value === fileId ? null : fileId
}

function startColumnResize(event, columnKey) {
  resizeState.value = {
    columnKey,
    startWidth: columnWidths[columnKey],
    startX: event.clientX,
  }
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function closeActionMenu() {
  openActionMenuId.value = null
}

function isActionMenuOpen(fileId) {
  return openActionMenuId.value === fileId
}

function setActionMenuRef(fileId, element) {
  if (element) {
    actionMenuRefs.set(fileId, element)
    return
  }
  actionMenuRefs.delete(fileId)
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

function handleDocumentMouseMove(event) {
  if (!resizeState.value) {
    return
  }

  const { columnKey, startWidth, startX } = resizeState.value
  const width = normalizeColumnWidth(startWidth + (event.clientX - startX), startWidth)
  columnWidths[columnKey] = width
}

function handleDocumentMouseUp() {
  if (!resizeState.value) {
    return
  }

  resizeState.value = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
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
    applyAutoColumnWidths(files.value)
    syncSelectedFiles()
    closeActionMenu()

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
  pagination.page = 1
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
  selectedFileIds.value = []
  closeActionMenu()

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
  if (pagination.page < totalPages.value) {
    await loadFiles(pagination.page + 1)
  }
}

async function previewItem(item) {
  if (!previewAvailable(item)) {
    return
  }
  previewDialog.fileName = formatValue(item.fileName)
  previewDialog.cameraTitle = formatValue(item.cameraTitle)
  previewDialog.storageTitle = formatValue(item.storageTitle)
  previewDialog.storageTypeLabel = formatValue(item.storageTypeLabel)
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
  }
}

function closePreviewDialog() {
  const video = previewVideoRef.value
  if (video) {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
  previewDialog.open = false
  previewDialog.fileName = ''
  previewDialog.cameraTitle = ''
  previewDialog.storageTitle = ''
  previewDialog.storageTypeLabel = ''
  previewDialog.source = ''
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
    return '当前文件不是浏览器可直接播放的标准流，服务端正在尝试兼容预览。'
  }
  return '预览流启动失败，请稍后重试。'
}

function resolveMediaError(error) {
  const code = Number(error?.code || 0)
  if (code === 4) {
    return '当前文件不是浏览器可直接播放的标准视频流，或服务端预览转换失败。'
  }
  if (code === 3) {
    return '视频解码失败，请稍后重试。'
  }
  if (code === 2) {
    return '预览流在传输过程中被中断，请重新打开播放窗口。'
  }
  return '预览流加载失败，请稍后重试。'
}

function openRebackTasks() {
  closeActionMenu()
  router.push({ name: 'video-reback-tasks' })
}

function buildBatchFeedback(result) {
  const fragments = []
  if (result.createdCount) {
    fragments.push(`新增 ${result.createdCount} 个回迁任务`)
  }
  if (result.reusedCount) {
    fragments.push(`复用 ${result.reusedCount} 个已有回迁任务`)
  }
  if (result.completedCount) {
    fragments.push(`${result.completedCount} 个文件已具备本地副本`)
  }

  let message = `已处理 ${result.selectedCount || 0} 个文件`
  if (fragments.length) {
    message += `，${fragments.join('，')}`
  }
  if (result.failedCount) {
    const firstFailure = result.failures?.[0]?.message
    message += `。${result.failedCount} 个处理失败`
    if (firstFailure) {
      message += `：${firstFailure}`
    }
  } else {
    message += '。'
  }
  return message
}

async function createBatchRebackTasks() {
  if (!selectedFileIds.value.length) {
    setFeedback('请先勾选需要回迁的文件。', 'warning')
    return
  }

  batchSubmitting.value = true

  try {
    const result = await fileApi.createRebackTasks(selectedFileIds.value)
    const tone = result.failedCount
      ? result.successCount
        ? 'warning'
        : 'danger'
      : 'success'
    setFeedback(buildBatchFeedback(result), tone)
    await loadFiles(pagination.page)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    batchSubmitting.value = false
  }
}
</script>

<template>
  <section class="content-grid">
    <article class="account-toolbar">
      <div>
        <p class="eyebrow">文件管理</p>
        <h1>文件列表</h1>
        <p>按任务、摄像头、文件和采集时间查询，并支持批量添加回迁与本地播放。</p>
      </div>

      <div class="account-toolbar__summary">
        <span class="metric-card__label">当前总数</span>
        <strong>{{ formatCount(pagination.total) }}</strong>
        <span>个文件</span>
      </div>
    </article>

    <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`">
      {{ feedback.message }}
    </div>

    <article class="panel file-list__panel">
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
          <span class="field__label">盘号</span>
          <input v-model.trim="filters.magazine" type="text" placeholder="RFID 或磁盘编号" />
        </label>

        <label class="field">
          <span class="field__label">采集开始日期</span>
          <input v-model="filters.startDateFrom" type="date" />
        </label>

        <label class="field">
          <span class="field__label">采集结束日期</span>
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
          <span class="field__label">采集状态</span>
          <select v-model="filters.isDown" class="select-field">
            <option value="">全部</option>
            <option value="Y">已采集</option>
            <option value="N">未采集</option>
          </select>
        </label>

        <label class="field">
          <span class="field__label">上传状态</span>
          <select v-model="filters.isUpload" class="select-field">
            <option value="">全部</option>
            <option value="Y">已上传</option>
            <option value="N">未上传</option>
          </select>
        </label>

        <div class="inline-actions">
          <button type="submit" :disabled="loading">查询</button>
          <button type="button" class="ghost" :disabled="loading" @click="resetSearch">重置</button>
        </div>
      </form>
    </article>

    <article class="panel file-list__panel">
      <div class="panel__toolbar">
        <div>
          <p class="eyebrow">文件列表</p>
          <h2>共 {{ formatCount(pagination.total) }} 个文件</h2>
          <p class="subtle-text">左右滚动只作用于下方文件列表，任务、摄像头、文件三列会按当前结果自动收紧宽度，需要时也可拖拽分隔线临时调宽。</p>
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

      <div class="file-list__batch-bar">
        <span class="file-list__selected">已选 {{ selectedCount }} 项</span>
        <button
          type="button"
          class="ghost"
          :disabled="loading || !selectableFileIds.length"
          @click="toggleSelectAll"
        >
          {{ allSelectableChecked ? '取消全选' : '全选当前页' }}
        </button>
        <button
          type="button"
          :disabled="loading || batchSubmitting || !selectedCount"
          @click="createBatchRebackTasks"
        >
          {{ batchSubmitting ? '提交中...' : '批量添加回迁' }}
        </button>
        <button type="button" class="ghost" @click="openRebackTasks">查看回迁任务</button>
      </div>

      <div class="account-table-wrap file-list__wrap">
        <table class="account-table file-list__table" :style="{ width: `${tableLayoutWidth}px`, minWidth: `${tableLayoutWidth}px` }">
          <colgroup>
            <col style="width: 64px" />
            <col :style="{ width: `${columnWidths.job}px` }" />
            <col :style="{ width: `${columnWidths.camera}px` }" />
            <col :style="{ width: `${columnWidths.file}px` }" />
            <col style="width: 190px" />
            <col style="width: 190px" />
            <col style="width: 130px" />
          </colgroup>
          <thead>
            <tr>
              <th class="file-list__checkbox-col">选择</th>
              <th class="file-list__th-resizable">
                <span class="file-list__th-label">任务</span>
                <button type="button" class="file-list__resize-handle" @mousedown.stop.prevent="startColumnResize($event, 'job')" />
              </th>
              <th class="file-list__th-resizable">
                <span class="file-list__th-label">摄像头</span>
                <button type="button" class="file-list__resize-handle" @mousedown.stop.prevent="startColumnResize($event, 'camera')" />
              </th>
              <th class="file-list__th-resizable">
                <span class="file-list__th-label">文件</span>
                <button type="button" class="file-list__resize-handle" @mousedown.stop.prevent="startColumnResize($event, 'file')" />
              </th>
              <th>采集时间</th>
              <th>状态</th>
              <th class="file-list__action-col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="empty-cell">正在加载文件...</td>
            </tr>
            <tr v-else-if="!files.length">
              <td colspan="7" class="empty-cell">未找到文件。</td>
            </tr>
            <tr v-for="item in files" :key="item.id">
              <td class="file-list__checkbox-col">
                <label v-if="canSelectReback(item)" class="file-list__checkbox">
                  <input v-model="selectedFileIds" type="checkbox" :value="item.id" />
                </label>
                <span v-else class="file-list__checkbox-placeholder">-</span>
              </td>
              <td class="file-list__text-col">
                <div class="file-list__cell-copy">
                  <strong class="file-list__primary" :title="formatValue(item.jobTitle)">{{ formatValue(item.jobTitle) }}</strong>
                  <div class="file-list__secondary" :title="formatValue(item.noteInfo)">{{ formatValue(item.noteInfo) }}</div>
                </div>
              </td>
              <td class="file-list__text-col">
                <div class="file-list__cell-copy">
                  <strong class="file-list__primary" :title="formatValue(item.cameraTitle)">{{ formatValue(item.cameraTitle) }}</strong>
                  <div class="file-list__secondary" :title="formatValue(item.ip)">{{ formatValue(item.ip) }}</div>
                </div>
              </td>
              <td class="file-list__text-col">
                <div class="file-list__cell-copy">
                  <strong class="file-list__primary" :title="formatValue(item.fileName)">{{ formatValue(item.fileName) }}</strong>
                  <div class="file-list__secondary">{{ formatValue(item.fileSizeLabel) }}</div>
                  <div class="file-list__secondary" :title="formatValue(item.accountTitle)">{{ formatValue(item.accountTitle) }}</div>
                </div>
              </td>
              <td class="file-list__time">
                <div class="file-list__time-entry">
                  <span class="file-list__time-label">开始</span>
                  <span>{{ formatValue(item.captureStartTime) }}</span>
                </div>
                <div class="file-list__time-entry">
                  <span class="file-list__time-label">结束</span>
                  <span>{{ formatValue(item.captureEndTime) }}</span>
                </div>
              </td>
              <td>
                <div class="file-list__status-stack">
                  <div class="file-list__status-row">
                    <span class="status-pill" :class="captureStatusClass(item)">
                      {{ item.isDown === 'Y' ? '已采集' : '未采集' }}
                    </span>
                    <span class="status-pill" :class="uploadStatusClass(item)">
                      {{ item.isUpload === 'Y' ? '已上传' : '未上传' }}
                    </span>
                  </div>
                  <div class="file-list__status-row">
                    <span class="status-pill" :class="localStatusClass(item)">
                      {{ localStatusLabel(item) }}
                    </span>
                    <span class="status-pill" :class="rebackStatusClass(item.rebackStatusKey)">
                      {{ formatValue(item.rebackStatusLabel) }}
                    </span>
                  </div>
                </div>
              </td>
              <td class="file-list__action-col">
                <div
                  :ref="(element) => setActionMenuRef(item.id, element)"
                  class="file-list__action"
                >
                  <button
                    type="button"
                    class="ghost file-list__action-trigger"
                    :aria-controls="`file-actions-${item.id}`"
                    :aria-expanded="isActionMenuOpen(item.id)"
                    @click="toggleActionMenu(item.id)"
                  >
                    {{ isActionMenuOpen(item.id) ? '收起操作' : '操作' }}
                  </button>

                  <div
                    v-if="isActionMenuOpen(item.id)"
                    :id="`file-actions-${item.id}`"
                    class="file-list__action-menu"
                  >
                    <button
                      type="button"
                      class="ghost file-list__action-item"
                      :disabled="!previewAvailable(item)"
                      @click="previewItem(item)"
                    >
                      播放
                    </button>

                    <div class="file-list__location-block">
                      <span class="file-list__location-label">存储设备</span>
                      <strong>{{ resolveStorageDeviceTitle(item) }}</strong>
                      <small>{{ formatValue(item.storageTypeLabel) }}</small>
                    </div>

                    <div v-if="item.storageTypeCode === 4" class="file-list__location-block">
                      <span class="file-list__location-label">盘匣组</span>
                      <strong>{{ resolveDiscGroupTitle(item) }}</strong>
                      <small>{{ formatValue(item.storageTypeLabel) }}</small>
                    </div>

                    <div v-if="item.storageTypeCode === 4" class="file-list__location-block">
                      <span class="file-list__location-label">光盘匣</span>
                      <strong>{{ resolveDiscMagazineTitle(item) }}</strong>
                      <small>{{ resolveDiscMagazineMeta(item) }}</small>
                    </div>

                    <div class="file-list__location-block">
                      <span class="file-list__location-label">文件位置</span>
                      <small :title="resolveStorageLocation(item)">{{ resolveStorageLocation(item) }}</small>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <div v-if="previewDialog.open" class="file-preview-dialog" @click="closePreviewDialog">
      <div class="file-preview-dialog__panel" @click.stop>
        <div class="file-preview-dialog__header">
          <div>
            <p class="eyebrow">文件预览</p>
            <h2>{{ previewDialog.fileName }}</h2>
            <p class="subtle-text">
              {{ previewDialog.cameraTitle }}<span v-if="previewDialog.storageTitle !== '--'"> · {{ previewDialog.storageTitle }}</span>
            </p>
          </div>

          <button type="button" class="ghost" @click="closePreviewDialog">关闭</button>
        </div>

        <div class="file-preview-dialog__body">
          <p v-if="previewState.loading" class="file-preview-dialog__hint">
            正在准备预览流，较大的录像可能需要几秒。
          </p>
          <div v-if="previewState.error" class="file-preview-dialog__error">
            {{ previewState.error }}
          </div>
          <video
            v-if="previewDialog.source"
            ref="previewVideoRef"
            :src="previewDialog.source"
            class="file-preview-dialog__player"
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
.content-grid,
.account-toolbar,
.file-list__panel {
  min-width: 0;
}

.file-list__panel {
  overflow: hidden;
}

.file-list__batch-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.95rem 1rem;
  border: 1px solid rgba(19, 93, 137, 0.12);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(248, 252, 255, 0.97), rgba(241, 247, 252, 0.92));
}

.file-list__selected {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  background: rgba(19, 93, 137, 0.08);
  color: #135d89;
  font-weight: 600;
}

.file-list__wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  overscroll-behavior-x: contain;
}

.file-list__table {
  width: auto;
  table-layout: fixed;
}

.file-list__table th,
.file-list__table td {
  vertical-align: middle;
  min-width: 0;
}

.file-list__checkbox-col {
  width: 64px;
  text-align: center;
}

.file-list__action-col {
  width: 130px;
}

.file-list__th-resizable {
  position: relative;
  padding-right: 1rem;
}

.file-list__th-label {
  display: inline-block;
}

.file-list__resize-handle {
  position: absolute;
  top: 50%;
  right: -0.2rem;
  width: 12px;
  height: 1.8rem;
  transform: translateY(-50%);
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: col-resize;
}

.file-list__resize-handle::before {
  content: '';
  position: absolute;
  top: 0.15rem;
  bottom: 0.15rem;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: rgba(22, 59, 54, 0.14);
}

.file-list__resize-handle:hover::before,
.file-list__resize-handle:focus-visible::before {
  background: rgba(19, 93, 137, 0.38);
}

.file-list__checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.file-list__checkbox input {
  width: 1rem;
  height: 1rem;
}

.file-list__checkbox-placeholder {
  color: rgba(32, 54, 73, 0.35);
}

.file-list__time {
  display: grid;
  gap: 0.45rem;
}

.file-list__text-col {
  min-width: 0;
}

.file-list__cell-copy {
  display: grid;
  gap: 0.28rem;
  min-width: 0;
}

.file-list__primary,
.file-list__secondary {
  display: -webkit-box;
  overflow: hidden;
  max-width: 100%;
  -webkit-box-orient: vertical;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.file-list__primary {
  line-height: 1.45;
  -webkit-line-clamp: 2;
}

.file-list__secondary {
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.4;
  -webkit-line-clamp: 2;
}

.file-list__time-entry {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  white-space: nowrap;
}

.file-list__time-label {
  min-width: 2.4rem;
  color: rgba(32, 54, 73, 0.68);
  font-weight: 600;
}

.file-list__status-stack {
  display: grid;
  gap: 0.45rem;
}

.file-list__status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.file-list__action {
  position: relative;
}

.file-list__action-trigger {
  min-width: 88px;
}

.file-list__action-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 12;
  display: grid;
  gap: 0.75rem;
  min-width: 240px;
  padding: 0.9rem;
  border: 1px solid rgba(22, 59, 54, 0.12);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 244, 237, 0.95));
  box-shadow: 0 18px 36px rgba(22, 48, 43, 0.12);
}

.file-list__action-item {
  width: 100%;
}

.file-list__location-block {
  display: grid;
  gap: 0.22rem;
  padding-top: 0.15rem;
  border-top: 1px solid rgba(22, 59, 54, 0.08);
}

.file-list__location-block strong,
.file-list__location-block small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-list__location-label {
  color: rgba(32, 54, 73, 0.68);
  font-size: 0.82rem;
  font-weight: 700;
}

.file-preview-dialog {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgba(12, 24, 35, 0.56);
  backdrop-filter: blur(6px);
}

.file-preview-dialog__panel {
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

.file-preview-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.file-preview-dialog__header h2 {
  margin: 0.2rem 0 0;
  font-size: 1.15rem;
}

.file-preview-dialog__body {
  display: grid;
  gap: 0.85rem;
  min-height: 0;
}

.file-preview-dialog__player {
  width: 100%;
  max-height: calc(100vh - 12rem);
  border-radius: 18px;
  background: #09131c;
}

.file-preview-dialog__hint {
  margin: 0;
  color: rgba(32, 54, 73, 0.7);
  font-size: 0.92rem;
}

.file-preview-dialog__error {
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(177, 54, 68, 0.18);
  border-radius: 14px;
  background: rgba(255, 243, 244, 0.92);
  color: #9b2936;
  font-size: 0.92rem;
  line-height: 1.55;
}

@media (max-width: 1200px) {
  .file-list__batch-bar {
    justify-content: flex-start;
  }
}
</style>
