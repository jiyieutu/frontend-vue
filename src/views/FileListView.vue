<script setup>
import { reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fileApi } from '../api/files'

const route = useRoute()
const router = useRouter()

const feedback = ref(null)
const files = ref([])
const loading = ref(false)

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

async function loadFiles(page = 1) {
  loading.value = true

  try {
    const data = await fileApi.list({
      ...filters,
      page,
      pageSize: pagination.pageSize,
    })
    files.value = data.items
    pagination.page = data.page
    pagination.pageSize = data.pageSize
    pagination.total = data.total

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

function boolLabel(value) {
  return value === 'Y' ? '是' : '否'
}
</script>

<template>
  <section class="content-grid">
    <article class="panel">
      <div class="account-toolbar">
        <div>
          <p class="eyebrow">文件管理</p>
          <h1>文件列表</h1>
          <p>按任务、摄像头、时间、盘号和上传下载状态查询采集文件。</p>
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
        <table class="account-table">
          <thead>
            <tr>
              <th>任务</th>
              <th>摄像头</th>
              <th>盘号</th>
              <th>标识</th>
              <th>文件</th>
              <th>大小</th>
              <th>采集开始</th>
              <th>采集结束</th>
              <th>已下载</th>
              <th>已上传</th>
              <th>本地状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="11" class="empty-cell">文件加载中...</td>
            </tr>
            <tr v-else-if="!files.length">
              <td colspan="11" class="empty-cell">未找到文件。</td>
            </tr>
            <tr v-for="item in files" :key="item.id">
              <td>{{ item.jobTitle || '--' }}</td>
              <td>
                <strong>{{ item.cameraTitle || '--' }}</strong>
                <div class="subtle-text">{{ item.ip || '--' }}</div>
              </td>
              <td>{{ item.magazine || '--' }}</td>
              <td>{{ item.flag || '--' }}</td>
              <td>
                <strong>{{ item.fileName }}</strong>
                <div class="subtle-text">{{ item.noteInfo || '--' }}</div>
              </td>
              <td>{{ item.fileSizeLabel }}</td>
              <td>{{ item.captureStartTime || '--' }}</td>
              <td>{{ item.captureEndTime || '--' }}</td>
              <td>{{ boolLabel(item.isDown) }}</td>
              <td>{{ boolLabel(item.isUpload) }}</td>
              <td>
                <span class="status-pill" :class="item.fileExists ? 'status-pill--active' : 'status-pill--idle'">
                  {{ item.fileExists ? '存在' : '缺失' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>
