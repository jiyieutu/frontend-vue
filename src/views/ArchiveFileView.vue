<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { nasFileApi } from '../api/nas-files'

const ARCHIVE_UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024
const ARCHIVE_UPLOAD_COMPLETED_STORAGE_KEY = 'archive-upload-completed-files'

const feedback = ref(null)
const items = ref([])
const loading = ref(false)
const uploading = ref(false)
const selectedFiles = ref([])
const uploadProgress = reactive({
  completedFiles: 0,
  currentFileName: '',
  fileCount: 0,
  loaded: 0,
  percent: 0,
  total: 0,
})

const fileInput = ref(null)
const folderInput = ref(null)

const filters = reactive({
  fileName: '',
})

const browsing = reactive({
  currentPath: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 20))),
)

const selectedTotalBytes = computed(() =>
  selectedFiles.value.reduce((sum, file) => sum + Number(file.size || 0), 0),
)

const uploadProgressPercent = computed(() => Math.max(0, Math.min(100, Number(uploadProgress.percent || 0))))

const uploadProgressText = computed(() => {
  if (!uploading.value) {
    return ''
  }

  const total = Number(uploadProgress.total || 0)
  const loaded = Math.min(Number(uploadProgress.loaded || 0), total || Number(uploadProgress.loaded || 0))
  const fileCount = Number(uploadProgress.fileCount || 0)
  const completedFiles = Number(uploadProgress.completedFiles || 0)
  const currentFileName = uploadProgress.currentFileName || ''

  if (total > 0) {
    if (currentFileName) {
      return `正在上传 ${completedFiles}/${fileCount} 个文件，当前：${currentFileName}，${formatBytes(loaded)} / ${formatBytes(total)}`
    }
    return `正在上传 ${fileCount} 个文件，${formatBytes(loaded)} / ${formatBytes(total)}`
  }

  return `正在上传 ${fileCount} 个文件，请稍候...`
})

const breadcrumbItems = computed(() => {
  const items = [
    {
      key: 'root',
      label: '全部文件',
      type: 'root',
    },
  ]

  if (!browsing.currentPath) {
    return items
  }

  let currentPath = ''
  browsing.currentPath.split('/').forEach((part, index) => {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    items.push({
      key: `path:${index}:${currentPath}`,
      label: part,
      path: currentPath,
      type: 'folder',
    })
  })

  return items
})

const selectedSummary = computed(() => {
  if (!selectedFiles.value.length) {
    return '未选择文件'
  }

  const sample = selectedFiles.value[0]?.webkitRelativePath || selectedFiles.value[0]?.name || '--'
  return `已选择 ${selectedFiles.value.length} 个文件，共 ${formatBytes(selectedTotalBytes.value)}，示例：${sample}`
})

onMounted(() => {
  loadItems(1, true)
})

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
}

function buildParams(page = pagination.page) {
  return {
    currentPath: browsing.currentPath,
    fileName: filters.fileName,
    page,
    pageSize: pagination.pageSize,
  }
}

async function loadItems(page = 1, silent = false) {
  loading.value = true

  try {
    const data = await nasFileApi.listArchive(buildParams(page))
    items.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!items.value.length && !silent) {
      setFeedback('当前条件下没有匹配的归档文件。', 'warning')
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
  await loadItems(1)
}

async function resetSearch() {
  filters.fileName = ''
  browsing.currentPath = ''
  pagination.page = 1
  await loadItems(1)
}

async function previousPage() {
  if (pagination.page > 1) {
    await loadItems(pagination.page - 1, true)
  }
}

async function nextPage() {
  if (pagination.page < totalPages.value) {
    await loadItems(pagination.page + 1, true)
  }
}

async function openItem(item) {
  if (item?.entryType !== 'folder') {
    return
  }
  browsing.currentPath = item.entryPath || ''
  await loadItems(1, true)
}

async function openBreadcrumb(item) {
  if (!item) {
    return
  }
  browsing.currentPath = item.type === 'root' ? '' : item.path || ''
  await loadItems(1, true)
}

async function goParent() {
  if (!browsing.currentPath) {
    return
  }
  const parts = browsing.currentPath.split('/')
  parts.pop()
  browsing.currentPath = parts.join('/')
  await loadItems(1, true)
}

function triggerFileInput() {
  fileInput.value?.click()
}

function triggerFolderInput() {
  folderInput.value?.click()
}

function handleFileSelection(event) {
  selectedFiles.value = Array.from(event.target?.files || [])
  resetUploadProgress()
}

function handleFolderSelection(event) {
  selectedFiles.value = Array.from(event.target?.files || [])
  resetUploadProgress()
}

async function uploadSelected() {
  if (!selectedFiles.value.length) {
    setFeedback('请先选择要上传的文件或文件夹。', 'warning')
    return
  }

  const totalBytes = selectedTotalBytes.value
  let overallLoaded = 0
  let created = 0
  let skipped = 0
  let updated = 0
  uploadProgress.fileCount = selectedFiles.value.length
  uploadProgress.completedFiles = 0
  uploadProgress.currentFileName = ''
  uploadProgress.loaded = 0
  uploadProgress.percent = 0
  uploadProgress.total = totalBytes
  uploading.value = true

  try {
    for (let index = 0; index < selectedFiles.value.length; index += 1) {
      const file = selectedFiles.value[index]
      const relativePath = buildRelativePath(file)
      const totalChunks = buildTotalChunks(file)
      uploadProgress.currentFileName = relativePath

      if (hasCompletedUpload(file)) {
        overallLoaded += Number(file.size || 0)
        syncUploadProgress(overallLoaded, totalBytes)
        skipped += 1
        uploadProgress.completedFiles = index + 1
        continue
      }

      const session = await nasFileApi.initArchiveUpload({
        chunkSize: ARCHIVE_UPLOAD_CHUNK_SIZE,
        fileName: file.name,
        fileSize: Number(file.size || 0),
        lastModified: Number(file.lastModified || 0),
        relativePath,
        totalChunks,
      })

      const resumedBytes = Math.min(Number(session?.uploadedBytes || 0), Number(file.size || 0))
      overallLoaded += resumedBytes
      syncUploadProgress(overallLoaded, totalBytes)

      const startChunkIndex = Math.max(0, Number(session?.nextChunkIndex || 0))
      for (let chunkIndex = startChunkIndex; chunkIndex < totalChunks; chunkIndex += 1) {
        const chunk = sliceUploadChunk(file, chunkIndex)
        const formData = new FormData()
        formData.append('uploadId', session.uploadId)
        formData.append('chunkIndex', String(chunkIndex))
        formData.append('chunk', chunk, `${file.name}.part`)
        await nasFileApi.uploadArchiveChunk(formData)
        overallLoaded += chunk.size
        syncUploadProgress(overallLoaded, totalBytes)
      }

      const result = await nasFileApi.completeArchiveUpload({
        uploadId: session.uploadId,
      })
      if (result?.created) {
        created += 1
      } else {
        updated += 1
      }
      markCompletedUpload(file)
      uploadProgress.completedFiles = index + 1
    }

    uploadProgress.currentFileName = ''
    syncUploadProgress(totalBytes, totalBytes)
    clearSelection()
    filters.fileName = ''
    browsing.currentPath = ''
    setFeedback(`上传完成：新增 ${created} 个，更新 ${updated} 个，跳过 ${skipped} 个已完成文件。`, 'success')
    await loadItems(1, true)
  } catch (error) {
    const currentFileName = uploadProgress.currentFileName || '当前文件'
    setFeedback(
      `${currentFileName} 上传中断：${error.message}。已保留已完成分片，再次点击“开始上传”会继续传输。`,
      'warning',
    )
  } finally {
    uploading.value = false
  }
}

function buildRelativePath(file) {
  return file?.webkitRelativePath || file?.name || `upload_${Date.now()}`
}

function buildCompletedUploadKey(file) {
  return `${buildRelativePath(file)}|${Number(file?.size || 0)}|${Number(file?.lastModified || 0)}`
}

function loadCompletedUploadKeys() {
  try {
    const rawValue = window.localStorage.getItem(ARCHIVE_UPLOAD_COMPLETED_STORAGE_KEY)
    if (!rawValue) {
      return []
    }
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

function saveCompletedUploadKeys(keys) {
  try {
    window.localStorage.setItem(ARCHIVE_UPLOAD_COMPLETED_STORAGE_KEY, JSON.stringify(keys.slice(-500)))
  } catch (error) {
    // Ignore storage failures and continue with in-memory upload flow.
  }
}

function hasCompletedUpload(file) {
  const key = buildCompletedUploadKey(file)
  return loadCompletedUploadKeys().includes(key)
}

function markCompletedUpload(file) {
  const key = buildCompletedUploadKey(file)
  const keys = loadCompletedUploadKeys()
  if (!keys.includes(key)) {
    keys.push(key)
    saveCompletedUploadKeys(keys)
  }
}

function buildTotalChunks(file) {
  const size = Number(file?.size || 0)
  if (size <= 0) {
    return 0
  }
  return Math.ceil(size / ARCHIVE_UPLOAD_CHUNK_SIZE)
}

function sliceUploadChunk(file, chunkIndex) {
  const start = chunkIndex * ARCHIVE_UPLOAD_CHUNK_SIZE
  const end = Math.min(Number(file.size || 0), start + ARCHIVE_UPLOAD_CHUNK_SIZE)
  return file.slice(start, end)
}

function syncUploadProgress(loaded, total) {
  const safeTotal = Number(total || 0)
  const safeLoaded = Math.min(Number(loaded || 0), safeTotal || Number(loaded || 0))
  uploadProgress.loaded = safeLoaded
  uploadProgress.total = safeTotal
  uploadProgress.percent = safeTotal > 0 ? Math.min(100, Math.round((safeLoaded / safeTotal) * 100)) : 100
}

function clearSelection() {
  selectedFiles.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  if (folderInput.value) {
    folderInput.value.value = ''
  }
}

function resetUploadProgress() {
  uploadProgress.completedFiles = 0
  uploadProgress.currentFileName = ''
  uploadProgress.fileCount = 0
  uploadProgress.loaded = 0
  uploadProgress.percent = 0
  uploadProgress.total = 0
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }
  return value
}

function formatExists(value) {
  return value ? '存在' : '缺失'
}

function typeLabel(value) {
  return value === 'folder' ? '文件夹' : '文件'
}

function formatBytes(bytes) {
  const value = Number(bytes || 0)
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(2)} KB`
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(2)} MB`
  }
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
}

async function jumpToPage(event) {
  const target = Number(event.target.value)
  if (target >= 1 && target <= totalPages.value && target !== pagination.page) {
    pagination.page = target
    await loadItems(target, true)
  } else {
    event.target.value = pagination.page
  }
}
</script>

<template>
  <section class="content-grid">
    <article class="panel">
      <div class="panel__toolbar panel__toolbar--stack">
        <div>
          <p class="eyebrow">归档上传</p>
          <h2>上传归档文件</h2>
        </div>

        <div class="inline-actions">
          <button type="button" class="ghost" :disabled="uploading" @click="triggerFileInput">选择文件</button>
          <button type="button" class="ghost" :disabled="uploading" @click="triggerFolderInput">选择文件夹</button>
          <button type="button" :disabled="uploading || !selectedFiles.length" @click="uploadSelected">
            {{ uploading ? '上传中...' : '开始上传' }}
          </button>
        </div>
      </div>

      <div class="path-toolbar" style="margin-bottom: 1.5rem;">
        <div class="path-breadcrumb">
          <button
            v-for="item in breadcrumbItems"
            :key="item.key"
            type="button"
            class="link-button"
            @click="openBreadcrumb(item)"
          >
            {{ item.label }}
          </button>
        </div>

        <button type="button" class="ghost" :disabled="!browsing.currentPath" @click="goParent">
          返回上一级
        </button>
      </div>

      <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`" style="margin-bottom: 1.5rem;">
        {{ feedback.message }}
      </div>

      <div class="upload-summary">
        <p>{{ selectedSummary }}</p>

        <div
          v-if="uploading"
          class="upload-progress"
          role="progressbar"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-valuenow="uploadProgressPercent"
        >
          <div class="upload-progress__meta">
            <strong>上传进度 {{ uploadProgressPercent }}%</strong>
            <span>{{ uploadProgressText }}</span>
          </div>
          <div class="upload-progress__track">
            <div class="upload-progress__fill" :style="{ width: `${uploadProgressPercent}%` }"></div>
          </div>
        </div>
      </div>

      <input ref="fileInput" type="file" multiple hidden @change="handleFileSelection" />
      <input ref="folderInput" type="file" multiple webkitdirectory directory hidden @change="handleFolderSelection" />
    </article>

    <article class="panel">
      <div class="panel__toolbar panel__toolbar--stack">
        <div>
          <p class="eyebrow">查询条件</p>
          <h2>归档目录检索</h2>
          <p class="subtle-text" style="margin-top: 0.5rem; display: flex; gap: 1.5rem;">
            <span>当前结果：<strong style="color: var(--text);">{{ pagination.total }}</strong></span>
          </p>
        </div>
      </div>

      <form class="toolbar-grid toolbar-grid--wide" @submit.prevent="submitSearch">
        <label class="field">
          <span class="field__label">文件名称</span>
          <input v-model.trim="filters.fileName" type="text" placeholder="支持模糊检索" />
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
          <p class="eyebrow">结果列表</p>
          <h2>共 {{ pagination.total }} 条</h2>
        </div>

        <div class="page-nav">
          <button type="button" class="ghost" :disabled="loading || pagination.page <= 1" @click="previousPage">
            上一页
          </button>
          <span style="display: flex; align-items: center; gap: 0.5rem;">
            第
            <input
              type="number"
              :value="pagination.page"
              class="input-field"
              style="width: 4rem; text-align: center; padding: 0.1rem;"
              :min="1"
              :max="totalPages"
              @change="jumpToPage"
            />
            页 / {{ totalPages }}
          </span>
          <button type="button" class="ghost" :disabled="loading || pagination.page >= totalPages" @click="nextPage">
            下一页
          </button>
        </div>
      </div>

      <div class="account-table-wrap">
        <table class="account-table resource-table">
          <thead>
            <tr>
              <th>类型</th>
              <th>文件名称</th>
              <th>大小/数量</th>
              <th>归档时间</th>
              <th>本地状态</th>
              <th>本地路径</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="empty-cell">正在加载归档文件...</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="6" class="empty-cell">未找到归档文件。</td>
            </tr>
            <tr v-for="item in items" :key="`${item.entryType}:${item.entryPath || item.fileName}`">
              <td>
                <span class="status-pill" :class="item.entryType === 'folder' ? 'status-pill--info' : 'status-pill--active'">
                  {{ typeLabel(item.entryType) }}
                </span>
              </td>
              <td>
                <button
                  v-if="item.entryType === 'folder'"
                  type="button"
                  class="link-button"
                  @click="openItem(item)"
                >
                  {{ item.fileName }}
                </button>
                <strong v-else>{{ item.fileName }}</strong>
              </td>
              <td>{{ formatValue(item.fileSizeLabel) }}</td>
              <td>{{ formatValue(item.uploadStartTime) }}</td>
              <td>
                <span class="status-pill" :class="item.fileExists ? 'status-pill--active' : 'status-pill--idle'">
                  {{ formatExists(item.fileExists) }}
                </span>
              </td>
              <td>{{ formatValue(item.localFullName) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="panel__footer" style="display: flex; justify-content: flex-end; margin-top: 1rem;">
        <div class="page-nav">
          <button type="button" class="ghost" :disabled="loading || pagination.page <= 1" @click="previousPage">
            上一页
          </button>
          <span style="display: flex; align-items: center; gap: 0.5rem;">
            第
            <input
              type="number"
              :value="pagination.page"
              class="input-field"
              style="width: 4rem; text-align: center; padding: 0.1rem;"
              :min="1"
              :max="totalPages"
              @change="jumpToPage"
            />
            页 / {{ totalPages }}
          </span>
          <button type="button" class="ghost" :disabled="loading || pagination.page >= totalPages" @click="nextPage">
            下一页
          </button>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.content-grid,
.panel {
  min-width: 0;
}

.account-table-wrap {
  overflow: auto;
  max-height: calc(100vh - 420px);
  min-height: 200px;
}
</style>
