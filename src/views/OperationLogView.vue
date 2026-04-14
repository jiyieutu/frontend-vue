<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { systemLogApi } from '../api/system-logs'

const feedback = ref(null)
const loading = ref(false)
const detailLoading = ref(false)
const logs = ref([])

const filters = reactive({
  content: '',
  endDate: '',
  loginName: '',
  startDate: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 30,
  total: 0,
})

const detailDialog = reactive({
  errorMessage: '',
  item: null,
  open: false,
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 1))),
)

onMounted(() => {
  loadLogs(1, true)
})

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
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

function buildParams(page = pagination.page) {
  return {
    content: filters.content,
    endDate: filters.endDate,
    loginName: filters.loginName,
    page,
    pageSize: pagination.pageSize,
    startDate: filters.startDate,
  }
}

async function loadLogs(page = 1, silent = false) {
  loading.value = true

  try {
    const data = await systemLogApi.listOperationLogs(buildParams(page))
    logs.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!logs.value.length && !silent) {
      setFeedback('当前筛选条件下没有匹配的操作日志。', 'warning')
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
  await loadLogs(1)
}

async function resetSearch() {
  filters.content = ''
  filters.endDate = ''
  filters.loginName = ''
  filters.startDate = ''
  pagination.page = 1
  await loadLogs(1)
}

async function previousPage() {
  if (pagination.page > 1) {
    await loadLogs(pagination.page - 1)
  }
}

async function nextPage() {
  if (pagination.page < totalPages.value) {
    await loadLogs(pagination.page + 1)
  }
}

async function openDetailDialog(item) {
  detailDialog.errorMessage = ''
  detailDialog.item = null
  detailDialog.open = true
  detailLoading.value = true

  try {
    detailDialog.item = await systemLogApi.getOperation(item.id)
  } catch (error) {
    detailDialog.errorMessage = error.message
  } finally {
    detailLoading.value = false
  }
}

function closeDetailDialog() {
  detailDialog.errorMessage = ''
  detailDialog.item = null
  detailDialog.open = false
}
</script>

<template>
  <section class="content-grid">
    <article class="panel">
      <div class="account-toolbar">
        <div>
          <p class="eyebrow">系统管理</p>
          <h1>操作日志</h1>
          <p>参考旧版日志页面，支持按账号、内容和日期范围筛选操作记录。</p>
        </div>

        <div class="account-toolbar__summary">
          <span class="metric-card__label">当前总数</span>
          <strong>{{ formatCount(pagination.total) }}</strong>
        </div>
      </div>

      <form class="toolbar-grid toolbar-grid--wide" @submit.prevent="submitSearch">
        <label class="field">
          <span class="field__label">账号</span>
          <input v-model.trim="filters.loginName" type="text" placeholder="按账号搜索" />
        </label>

        <label class="field">
          <span class="field__label">操作内容</span>
          <input v-model.trim="filters.content" type="text" placeholder="按内容搜索" />
        </label>

        <label class="field">
          <span class="field__label">开始日期</span>
          <input v-model="filters.startDate" type="date" />
        </label>

        <label class="field">
          <span class="field__label">结束日期</span>
          <input v-model="filters.endDate" type="date" />
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
          <p class="eyebrow">日志列表</p>
          <h2>共 {{ formatCount(pagination.total) }} 条日志</h2>
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
              <th>操作时间</th>
              <th>操作内容</th>
              <th>IP</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="empty-cell">正在加载操作日志...</td>
            </tr>
            <tr v-else-if="!logs.length">
              <td colspan="5" class="empty-cell">未找到操作日志。</td>
            </tr>
            <tr v-for="item in logs" :key="item.id">
              <td>{{ formatValue(item.userName) }}</td>
              <td>{{ formatValue(item.operTime) }}</td>
              <td>{{ formatValue(item.content) }}</td>
              <td>{{ formatValue(item.ip) }}</td>
              <td>
                <div class="action-group">
                  <button type="button" class="ghost" @click="openDetailDialog(item)">详情</button>
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

    <div v-if="detailDialog.open" class="dialog-backdrop" @click.self="closeDetailDialog">
      <section class="dialog dialog--wide">
        <header class="dialog__header">
          <div>
            <p class="eyebrow">操作日志</p>
            <h3>日志详情</h3>
          </div>
          <button type="button" class="ghost" @click="closeDetailDialog">关闭</button>
        </header>

        <div class="dialog__body dialog__body--wide">
          <div v-if="detailLoading" class="empty-state-inline">正在加载日志详情...</div>

          <template v-else-if="detailDialog.item">
            <div class="log-detail-grid">
              <div class="detail-card">
                <span class="field__label">账号</span>
                <p>{{ formatValue(detailDialog.item.userName) }}</p>
              </div>

              <div class="detail-card">
                <span class="field__label">操作时间</span>
                <p>{{ formatValue(detailDialog.item.operTime) }}</p>
              </div>

              <div class="detail-card">
                <span class="field__label">IP</span>
                <p>{{ formatValue(detailDialog.item.ip) }}</p>
              </div>

              <div class="detail-card">
                <span class="field__label">模块</span>
                <p>{{ formatValue(detailDialog.item.modelCode) }}</p>
              </div>
            </div>

            <div class="detail-card">
              <span class="field__label">操作内容</span>
              <pre class="text-block">{{ formatValue(detailDialog.item.content) }}</pre>
            </div>
          </template>

          <p v-else-if="detailDialog.errorMessage" class="error-text">
            {{ detailDialog.errorMessage }}
          </p>
        </div>

        <footer class="dialog__footer">
          <button type="button" class="ghost" @click="closeDetailDialog">关闭</button>
        </footer>
      </section>
    </div>
  </section>
</template>
