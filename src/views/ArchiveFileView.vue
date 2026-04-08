<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { nasFileApi } from '../api/nas-files'

const feedback = ref(null)
const items = ref([])
const loading = ref(false)
const uploading = ref(false)
const selectedFiles = ref([])

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

  const totalBytes = selectedFiles.value.reduce((sum, file) => sum + Number(file.size || 0), 0)
  const sample = selectedFiles.value[0]?.webkitRelativePath || selectedFiles.value[0]?.name || '--'
  return `已选择 ${selectedFiles.value.length} 个文件，共 ${formatBytes(totalBytes)}，示例：${sample}`
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
}

function handleFolderSelection(event) {
  selectedFiles.value = Array.from(event.target?.files || [])
}

async function uploadSelected() {
  if (!selectedFiles.value.length) {
    setFeedback('请先选择要上传的文件或文件夹。', 'warning')
    return
  }

  uploading.value = true

  try {
    const formData = new FormData()
    selectedFiles.value.forEach((file) => {
      formData.append('files', file, file.name)
      formData.append('relativePath', file.webkitRelativePath || file.name)
    })

    const result = await nasFileApi.uploadArchive(formData)
    selectedFiles.value = []
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    if (folderInput.value) {
      folderInput.value.value = ''
    }
    filters.fileName = ''
    browsing.currentPath = ''
    setFeedback(result.message || '归档文件上传完成。', result.failed ? 'warning' : 'success')
    await loadItems(1, true)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    uploading.value = false
  }
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
</script>

<template>
  <section class="content-grid">
    <article class="panel panel--hero">
      <div class="account-toolbar">
        <div>
          <p class="eyebrow">归档文件管理</p>
          <h1>归档文件管理</h1>
          <p>浏览手工归档目录，支持文件上传和文件夹上传，保留原有相对路径。</p>
        </div>

        <div class="account-toolbar__summary">
          <span class="metric-card__label">当前结果</span>
          <strong>{{ pagination.total }}</strong>
        </div>
      </div>

      <div class="path-toolbar">
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

      <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`">
        {{ feedback.message }}
      </div>
    </article>

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

      <div class="upload-summary">
        {{ selectedSummary }}
      </div>

      <input ref="fileInput" type="file" multiple hidden @change="handleFileSelection" />
      <input ref="folderInput" type="file" multiple webkitdirectory directory hidden @change="handleFolderSelection" />
    </article>

    <article class="panel">
      <div class="panel__toolbar panel__toolbar--stack">
        <div>
          <p class="eyebrow">查询条件</p>
          <h2>归档目录检索</h2>
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
          <span>第 {{ pagination.page }} 页 / {{ totalPages }}</span>
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
    </article>
  </section>
</template>
