<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { nasTargetApi } from '../api/nas-targets'
import NasBackupScheduleDialog from '../components/NasBackupScheduleDialog.vue'
import NasTargetDialog from '../components/NasTargetDialog.vue'

const feedback = ref(null)
const loading = ref(false)
const pendingAction = ref('')
const items = ref([])

const filters = reactive({
  keyword: '',
  serverIp: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const dialogState = reactive({
  errorMessage: '',
  mode: 'create',
  open: false,
  submitting: false,
})

const scheduleDialogState = reactive({
  errorMessage: '',
  open: false,
  submitting: false,
  title: '',
})

const editingId = ref(null)
const dialogValue = ref(buildEmptyValue())
const scheduleEditingId = ref(null)
const scheduleDialogValue = ref(buildEmptyScheduleValue())

const BACKUP_TYPE_LABELS = {
  0: '全量备份',
  1: '增量备份',
}

const totalPages = computed(() =>
  Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 20))),
)

onMounted(() => {
  loadNasTargets(1, true)
})

function buildEmptyValue() {
  return {
    backupType: 0,
    backupScheduleEnabled: false,
    backupScheduleTime: '02:00',
    maxSize: '0',
    lastBackupAt: '',
    lastBackupInfo: '',
    password: '',
    path: '',
    serverIp: '',
    startSize: '0',
    status: 1,
    title: '',
    username: '',
  }
}

function buildEmptyScheduleValue() {
  return {
    backupType: 0,
    enabled: 0,
    scheduleTime: '02:00',
  }
}

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
}

function buildActionKey(targetId, action) {
  return `${targetId}:${action}`
}

function isBusy(targetId, action) {
  return pendingAction.value === buildActionKey(targetId, action)
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

function formatBackupType(value) {
  return BACKUP_TYPE_LABELS[Number(value)] || BACKUP_TYPE_LABELS[0]
}

function formatScheduleLabel(item) {
  if (!item?.backupScheduleEnabled) {
    return '未启用'
  }
  return `${formatBackupType(item.backupType)} ${item.backupScheduleTime || '02:00'}`
}

function formatStatusLabel(status) {
  return Number(status) === 1 ? '启用' : '停用'
}

function formatStatusClass(status) {
  return Number(status) === 1 ? 'status-pill--active' : 'status-pill--idle'
}

function formatWorkStatus(value) {
  return Number(value) === 1 ? '工作中' : '空闲'
}

function buildParams(page = pagination.page) {
  return {
    keyword: filters.keyword,
    page,
    pageSize: pagination.pageSize,
    serverIp: filters.serverIp,
  }
}

async function loadNasTargets(page = 1, silent = false) {
  loading.value = true

  try {
    const data = await nasTargetApi.list(buildParams(page))
    items.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!items.value.length && !silent) {
      setFeedback('当前筛选条件下没有匹配的 NAS。', 'warning')
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
  await loadNasTargets(1)
}

async function resetSearch() {
  filters.keyword = ''
  filters.serverIp = ''
  pagination.page = 1
  await loadNasTargets(1)
}

async function previousPage() {
  if (pagination.page > 1) {
    await loadNasTargets(pagination.page - 1, true)
  }
}

async function nextPage() {
  if (pagination.page < totalPages.value) {
    await loadNasTargets(pagination.page + 1, true)
  }
}

function openCreateDialog() {
  editingId.value = null
  dialogState.errorMessage = ''
  dialogState.mode = 'create'
  dialogValue.value = buildEmptyValue()
  dialogState.open = true
}

async function openEditDialog(item) {
  dialogState.errorMessage = ''
  dialogState.mode = 'edit'

  try {
    const detail = await nasTargetApi.get(item.id)
    editingId.value = item.id
    dialogValue.value = {
      ...detail,
      backupType: Number(detail.backupType ?? 0),
      password: detail.secretKey || '',
      username: detail.accessKey || '',
    }
    dialogState.open = true
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

function closeDialog() {
  dialogState.open = false
  dialogState.errorMessage = ''
}

function openScheduleDialog(item) {
  scheduleEditingId.value = item.id
  scheduleDialogState.errorMessage = ''
  scheduleDialogState.title = item.title || ''
  scheduleDialogValue.value = {
    backupType: Number(item.backupType ?? 0),
    enabled: item.backupScheduleEnabled ? 1 : 0,
    scheduleTime: item.backupScheduleTime || '02:00',
  }
  scheduleDialogState.open = true
}

function closeScheduleDialog() {
  scheduleDialogState.open = false
  scheduleDialogState.errorMessage = ''
  scheduleDialogState.title = ''
  scheduleEditingId.value = null
}

async function submitDialog(payload) {
  dialogState.submitting = true
  dialogState.errorMessage = ''

  try {
    if (dialogState.mode === 'edit' && editingId.value) {
      await nasTargetApi.update(editingId.value, payload)
      setFeedback('NAS 已更新。', 'success')
    } else {
      await nasTargetApi.create(payload)
      setFeedback('NAS 已新增。', 'success')
    }

    dialogState.open = false
    await loadNasTargets(1, true)
  } catch (error) {
    dialogState.errorMessage = error.message
  } finally {
    dialogState.submitting = false
  }
}

async function submitScheduleDialog(payload) {
  if (!scheduleEditingId.value) {
    return
  }

  scheduleDialogState.submitting = true
  scheduleDialogState.errorMessage = ''

  try {
    await nasTargetApi.updateBackupSchedule(scheduleEditingId.value, payload)
    closeScheduleDialog()
    setFeedback('定时备份设置已更新。', 'success')
    await loadNasTargets(pagination.page, true)
  } catch (error) {
    scheduleDialogState.errorMessage = error.message
  } finally {
    scheduleDialogState.submitting = false
  }
}

async function toggleStatus(item) {
  pendingAction.value = buildActionKey(item.id, 'toggle')

  try {
    const result = await nasTargetApi.toggleStatus(item.id)
    item.status = result.status
    item.enabled = result.enabled
    setFeedback(`NAS“${item.title}”状态已更新。`, 'success')
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function testNas(item) {
  pendingAction.value = buildActionKey(item.id, 'test')

  try {
    const result = await nasTargetApi.test(item.id)
    const message = result.reachable
      ? `NAS 路径可访问：${result.path}`
      : `NAS 路径不可访问：${result.path}`
    setFeedback(message, result.reachable ? 'success' : 'warning')
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function executeBackup(item, mode) {
  const modeLabel = mode === 'incremental' ? '增量备份' : '全量备份'
  if (!window.confirm(`确认对 NAS“${item.title}”执行${modeLabel}？`)) {
    return
  }

  pendingAction.value = buildActionKey(item.id, `backup-${mode}`)

  try {
    const result = await nasTargetApi.executeBackup(item.id, mode)
    setFeedback(result.message || `${modeLabel}已执行。`, 'success')
    await loadNasTargets(pagination.page, true)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function deleteNas(item) {
  if (!window.confirm(`确认删除 NAS“${item.title}”？`)) {
    return
  }

  pendingAction.value = buildActionKey(item.id, 'delete')

  try {
    await nasTargetApi.remove(item.id)
    setFeedback(`NAS“${item.title}”已删除。`, 'success')
    await loadNasTargets(1, true)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}
</script>

<template>
  <section class="content-grid">
    <article class="panel panel--hero">
      <div class="account-toolbar">
        <div>
          <p class="eyebrow">存储设备配置</p>
          <h1>存储设备管理</h1>
          <p>独立管理上传目标存储设备、路径、状态和备份方式。</p>
        </div>

        <div class="account-toolbar__summary">
          <span class="metric-card__label">设备总数</span>
          <strong>{{ formatCount(pagination.total) }}</strong>
        </div>
      </div>

      <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`">
        {{ feedback.message }}
      </div>
    </article>

    <article class="panel">
      <div class="panel__toolbar panel__toolbar--stack">
        <div>
          <p class="eyebrow">查询条件</p>
          <h2>NAS 列表</h2>
        </div>

        <div class="inline-actions">
          <button type="button" @click="openCreateDialog">新增 NAS</button>
        </div>
      </div>

      <form class="toolbar-grid toolbar-grid--wide" @submit.prevent="submitSearch">
        <label class="field">
          <span class="field__label">关键字</span>
          <input v-model.trim="filters.keyword" type="text" placeholder="名称、路径或账号" />
        </label>

        <label class="field">
          <span class="field__label">NAS IP</span>
          <input v-model.trim="filters.serverIp" type="text" placeholder="请输入 NAS IP" />
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
          <p class="eyebrow">列表结果</p>
          <h2>共 {{ formatCount(pagination.total) }} 个 NAS</h2>
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
              <th>NAS 名称</th>
              <th>NAS IP</th>
              <th>账号</th>
              <th>NAS 路径</th>
              <th>备份方式</th>
              <th>定时备份</th>
              <th>上次备份</th>
              <th>状态</th>
              <th>工作状态</th>
              <th>创建时间</th>
              <th>最后错误</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="12" class="empty-cell">NAS 加载中...</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="12" class="empty-cell">未找到 NAS。</td>
            </tr>
            <tr v-for="item in items" :key="item.id">
              <td><strong>{{ item.title }}</strong></td>
              <td>{{ formatValue(item.serverIp) }}</td>
              <td>{{ formatValue(item.accessKey) }}</td>
              <td>{{ formatValue(item.path) }}</td>
              <td>{{ formatBackupType(item.backupType) }}</td>
              <td>{{ formatScheduleLabel(item) }}</td>
              <td>
                <div>{{ formatValue(item.lastBackupAt) }}</div>
                <div class="subtle-text">{{ formatValue(item.lastBackupInfo) }}</div>
              </td>
              <td>
                <span class="status-pill" :class="formatStatusClass(item.status)">
                  {{ formatStatusLabel(item.status) }}
                </span>
              </td>
              <td>{{ formatWorkStatus(item.workStatus) }}</td>
              <td>{{ formatValue(item.createdAt) }}</td>
              <td>{{ formatValue(item.lastError) }}</td>
              <td>
                <div class="action-group">
                  <button type="button" class="ghost" @click="openEditDialog(item)">编辑</button>
                  <button
                    type="button"
                    class="ghost"
                    :disabled="isBusy(item.id, 'backup-full')"
                    @click="executeBackup(item, 'full')"
                  >
                    {{ isBusy(item.id, 'backup-full') ? '备份中...' : '全量备份' }}
                  </button>
                  <button
                    type="button"
                    class="ghost"
                    :disabled="isBusy(item.id, 'backup-incremental')"
                    @click="executeBackup(item, 'incremental')"
                  >
                    {{ isBusy(item.id, 'backup-incremental') ? '备份中...' : '增量备份' }}
                  </button>
                  <button type="button" class="ghost" @click="openScheduleDialog(item)">定时设置</button>
                  <button
                    type="button"
                    class="ghost"
                    :disabled="isBusy(item.id, 'toggle')"
                    @click="toggleStatus(item)"
                  >
                    {{ isBusy(item.id, 'toggle') ? '处理中...' : Number(item.status) === 1 ? '停用' : '启用' }}
                  </button>
                  <button
                    type="button"
                    class="ghost"
                    :disabled="isBusy(item.id, 'test')"
                    @click="testNas(item)"
                  >
                    {{ isBusy(item.id, 'test') ? '测试中...' : '测试' }}
                  </button>
                  <button
                    type="button"
                    class="danger"
                    :disabled="isBusy(item.id, 'delete')"
                    @click="deleteNas(item)"
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

    <NasTargetDialog
      :open="dialogState.open"
      :mode="dialogState.mode"
      :submitting="dialogState.submitting"
      :error-message="dialogState.errorMessage"
      :initial-value="dialogValue"
      @close="closeDialog"
      @submit="submitDialog"
    />

    <NasBackupScheduleDialog
      :open="scheduleDialogState.open"
      :submitting="scheduleDialogState.submitting"
      :error-message="scheduleDialogState.errorMessage"
      :initial-value="scheduleDialogValue"
      :title="scheduleDialogState.title"
      @close="closeScheduleDialog"
      @submit="submitScheduleDialog"
    />
  </section>
</template>
