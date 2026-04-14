<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { systemLogApi } from '../api/system-logs'

const feedback = ref(null)
const loading = ref(false)
const logs = ref([])

const filters = reactive({
  userCode: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 30,
  total: 0,
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
    page,
    pageSize: pagination.pageSize,
    userCode: filters.userCode,
  }
}

async function loadLogs(page = 1, silent = false) {
  loading.value = true

  try {
    const data = await systemLogApi.listLoginLogs(buildParams(page))
    logs.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!logs.value.length && !silent) {
      setFeedback('当前筛选条件下没有匹配的登录日志。', 'warning')
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
  filters.userCode = ''
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
</script>

<template>
  <section class="content-grid">
    <article class="panel">
      <div class="account-toolbar">
        <div>
          <p class="eyebrow">系统管理</p>
          <h1>登录日志</h1>
          <p>参考旧版登录日志页面，支持按账号筛选登录记录。</p>
        </div>

        <div class="account-toolbar__summary">
          <span class="metric-card__label">当前总数</span>
          <strong>{{ formatCount(pagination.total) }}</strong>
        </div>
      </div>

      <form class="account-search" @submit.prevent="submitSearch">
        <label class="field field--inline">
          <span class="field__label">账号</span>
          <input v-model.trim="filters.userCode" type="text" placeholder="按账号搜索" />
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
          <p class="eyebrow">登录日志</p>
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
              <th>登录时间</th>
              <th>登录 IP</th>
              <th>系统标识</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="4" class="empty-cell">正在加载登录日志...</td>
            </tr>
            <tr v-else-if="!logs.length">
              <td colspan="4" class="empty-cell">未找到登录日志。</td>
            </tr>
            <tr v-for="item in logs" :key="item.id">
              <td>{{ formatValue(item.userCode) }}</td>
              <td>{{ formatValue(item.loginTime) }}</td>
              <td>{{ formatValue(item.loginIp) }}</td>
              <td>{{ formatValue(item.systemName) }}</td>
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
  </section>
</template>
