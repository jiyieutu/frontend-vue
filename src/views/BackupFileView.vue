<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { nasFileApi } from '../api/nas-files'

const feedback = ref(null)
const items = ref([])
const loading = ref(false)

const filters = reactive({
  fileName: '',
  title: '',
})

const browsing = reactive({
  accountId: 0,
  accountTitle: '',
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
      label: '全部账号',
      type: 'root',
    },
  ]

  if (Number(browsing.accountId) > 0) {
    items.push({
      accountId: browsing.accountId,
      key: `account:${browsing.accountId}`,
      label: browsing.accountTitle || `账号 ${browsing.accountId}`,
      type: 'account',
    })
  }

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
    accountId: browsing.accountId || undefined,
    currentPath: browsing.currentPath,
    fileName: filters.fileName,
    page,
    pageSize: pagination.pageSize,
    title: filters.title,
  }
}

async function loadItems(page = 1, silent = false) {
  loading.value = true

  try {
    const data = await nasFileApi.listBackup(buildParams(page))
    items.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!items.value.length && !silent) {
      setFeedback('当前条件下没有匹配的备份文件。', 'warning')
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
  filters.title = ''
  browsing.accountId = 0
  browsing.accountTitle = ''
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
  if (!item) {
    return
  }

  if (item.entryType === 'account') {
    browsing.accountId = Number(item.accountId || 0)
    browsing.accountTitle = item.accountTitle || item.fileName || ''
    browsing.currentPath = ''
    await loadItems(1, true)
    return
  }

  if (item.entryType === 'folder') {
    browsing.accountId = Number(item.accountId || browsing.accountId || 0)
    browsing.accountTitle = item.accountTitle || browsing.accountTitle || ''
    browsing.currentPath = item.entryPath || ''
    await loadItems(1, true)
  }
}

async function openBreadcrumb(item) {
  if (!item) {
    return
  }

  if (item.type === 'root') {
    browsing.accountId = 0
    browsing.accountTitle = ''
    browsing.currentPath = ''
  } else if (item.type === 'account') {
    browsing.accountId = Number(item.accountId || 0)
    browsing.accountTitle = item.label || ''
    browsing.currentPath = ''
  } else {
    browsing.currentPath = item.path || ''
  }

  await loadItems(1, true)
}

async function goParent() {
  if (browsing.currentPath) {
    const parts = browsing.currentPath.split('/')
    parts.pop()
    browsing.currentPath = parts.join('/')
  } else if (Number(browsing.accountId) > 0) {
    browsing.accountId = 0
    browsing.accountTitle = ''
  }

  await loadItems(1, true)
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
  if (value === 'account') {
    return '账号'
  }
  if (value === 'folder') {
    return '文件夹'
  }
  return '文件'
}

function rowStatusClass(item) {
  if (item.entryType === 'account' || item.entryType === 'folder') {
    return 'status-pill--info'
  }
  return item.fileExists ? 'status-pill--active' : 'status-pill--idle'
}
</script>

<template>
  <section class="content-grid">
    <article class="panel panel--hero">
      <div class="account-toolbar">
        <div>
          <p class="eyebrow">备份文件管理</p>
          <h1>备份文件管理</h1>
          <p>按 NAS 账号浏览备份目录，也可以按文件名直接检索备份文件。</p>
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

        <button
          type="button"
          class="ghost"
          :disabled="Number(browsing.accountId) <= 0"
          @click="goParent"
        >
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
          <p class="eyebrow">查询条件</p>
          <h2>备份目录检索</h2>
        </div>
      </div>

      <form class="toolbar-grid toolbar-grid--wide" @submit.prevent="submitSearch">
        <label class="field">
          <span class="field__label">账号名称</span>
          <input v-model.trim="filters.title" type="text" placeholder="按账号名称或挂载目录搜索" />
        </label>

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
              <th>NAS 账号</th>
              <th>挂载目录</th>
              <th>文件名称</th>
              <th>大小/数量</th>
              <th>备份时间</th>
              <th>本地状态</th>
              <th>本地路径</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="empty-cell">正在加载备份文件...</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="8" class="empty-cell">未找到备份文件。</td>
            </tr>
            <tr v-for="item in items" :key="`${item.entryType}:${item.accountId || 0}:${item.entryPath || item.fileName}`">
              <td>
                <span class="status-pill" :class="rowStatusClass(item)">
                  {{ typeLabel(item.entryType) }}
                </span>
              </td>
              <td>{{ formatValue(item.accountTitle) }}</td>
              <td>{{ formatValue(item.dirName) }}</td>
              <td>
                <button
                  v-if="item.entryType === 'account' || item.entryType === 'folder'"
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
