<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { backupAccountApi } from '../api/backup-accounts'
import BackupAccountDialog from '../components/BackupAccountDialog.vue'

const feedback = ref(null)
const loading = ref(false)
const optionsLoading = ref(false)
const pendingAction = ref('')
const items = ref([])
const openActionMenuId = ref(null)
const actionMenuRefs = new Map()

const filters = reactive({
  keyword: '',
  status: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const formOptions = reactive({
  backupTypes: [
    { value: 0, label: '全量备份' },
    { value: 1, label: '增量备份' },
  ],
  cachePathPattern: '/home/screen/nasbackup/{accountId}',
  cacheRoot: '/home/screen',
  defaultBackupScheduleTime: '02:00',
  storageGroups: [],
})

const dialogState = reactive({
  errorMessage: '',
  mode: 'create',
  open: false,
  submitting: false,
})

const editingId = ref(null)
const dialogValue = ref(buildEmptyValue())

const totalPages = computed(() =>
  Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 20))),
)

const enabledCount = computed(() =>
  items.value.filter((item) => Number(item.status) === 1).length,
)

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  bootstrap()
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})

function buildEmptyValue() {
  return {
    backupType: 1,
    backupScheduleEnabled: 0,
    backupScheduleTime: formOptions.defaultBackupScheduleTime,
    dirName: '',
    password: '',
    serverIp: '',
    status: 1,
    storageId: 0,
    storageKey: '',
    storageType: 2,
    title: '',
    uploadScheduleEnabled: 0,
    uploadScheduleTime: '02:00',
    username: '',
  }
}

async function bootstrap() {
  await Promise.all([loadOptions(true), loadBackupAccounts(1, true)])
}

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
}

function buildActionKey(accountId, action) {
  return `${accountId}:${action}`
}

function toggleActionMenu(accountId) {
  openActionMenuId.value = openActionMenuId.value === accountId ? null : accountId
}

function closeActionMenu() {
  openActionMenuId.value = null
}

function isActionMenuOpen(accountId) {
  return openActionMenuId.value === accountId
}

function setActionMenuRef(accountId, element) {
  if (element) {
    actionMenuRefs.set(accountId, element)
    return
  }
  actionMenuRefs.delete(accountId)
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
    closeActionMenu()
  }
}

function isBusy(accountId, action) {
  return pendingAction.value === buildActionKey(accountId, action)
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

function formatStatusLabel(status) {
  return Number(status) === 1 ? '启用' : '停用'
}

function formatStatusClass(status) {
  return Number(status) === 1 ? 'status-pill--active' : 'status-pill--idle'
}

function formatSwitchLabel(value) {
  return Number(value) === 1 ? '已启用' : '未启用'
}

function formatSwitchClass(value) {
  return Number(value) === 1 ? 'backup-account-tag--accent' : 'backup-account-tag--muted'
}

function formatBackupType(item) {
  if (item?.backupTypeLabel) {
    return item.backupTypeLabel
  }
  return Number(item?.backupType ?? item) === 0 ? '全量备份' : '增量备份'
}

function formatScheduleLabel(item) {
  if (!item?.uploadScheduleEnabled) {
    return '未启用'
  }
  return `每日 ${item.uploadScheduleTime || '02:00'}`
}

function formatBackupScheduleLabel(item) {
  if (!item?.backupScheduleEnabled) {
    return '未启用'
  }
  return `${formatBackupType(item)} / 每日 ${item.backupScheduleTime || '02:00'}`
}

function formatStorageLabel(item) {
  const typeLabel = item?.storageTypeLabel || item?.storageTypeCode || '--'
  const title = item?.storageTargetTitle || '--'
  return `${typeLabel} / ${title}`
}

function formatCacheState(item) {
  return item?.cacheExists ? '缓存目录已存在' : '缓存目录待生成'
}

function buildParams(page = pagination.page) {
  return {
    keyword: filters.keyword,
    page,
    pageSize: pagination.pageSize,
    status: filters.status,
  }
}

async function loadOptions(silent = false) {
  optionsLoading.value = true

  try {
    const data = await backupAccountApi.options()
    formOptions.backupTypes = data.backupTypes || formOptions.backupTypes
    formOptions.cachePathPattern = data.cachePathPattern || formOptions.cachePathPattern
    formOptions.cacheRoot = data.cacheRoot || formOptions.cacheRoot
    formOptions.defaultBackupScheduleTime = data.defaultBackupScheduleTime || formOptions.defaultBackupScheduleTime
    formOptions.storageGroups = data.storageTargetGroups || []
  } catch (error) {
    if (!silent) {
      setFeedback(error.message, 'danger')
    }
  } finally {
    optionsLoading.value = false
  }
}

async function loadBackupAccounts(page = 1, silent = false) {
  closeActionMenu()
  loading.value = true

  try {
    const data = await backupAccountApi.list(buildParams(page))
    items.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!items.value.length && !silent) {
      setFeedback('当前筛选条件下没有匹配的存储节点配置。', 'warning')
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
  await loadBackupAccounts(1)
}

async function resetSearch() {
  filters.keyword = ''
  filters.status = ''
  pagination.page = 1
  await loadBackupAccounts(1)
}

async function previousPage() {
  if (pagination.page > 1) {
    await loadBackupAccounts(pagination.page - 1, true)
  }
}

async function nextPage() {
  if (pagination.page < totalPages.value) {
    await loadBackupAccounts(pagination.page + 1, true)
  }
}

async function changePageSize(event) {
  const newSize = Number(event.target.value)
  if (newSize !== pagination.pageSize) {
    pagination.pageSize = newSize
    pagination.page = 1
    await loadBackupAccounts(1, true)
  }
}

function openCreateDialog() {
  closeActionMenu()
  editingId.value = null
  dialogState.errorMessage = ''
  dialogState.mode = 'create'
  dialogValue.value = buildEmptyValue()
  dialogState.open = true
}

async function openEditDialog(item) {
  closeActionMenu()
  dialogState.errorMessage = ''
  dialogState.mode = 'edit'

  try {
    const detail = await backupAccountApi.get(item.id)
    editingId.value = item.id
    dialogValue.value = {
      ...detail,
      backupType: Number(detail.backupType ?? 1),
      backupScheduleEnabled: detail.backupScheduleEnabled ? 1 : 0,
      storageKey: `${detail.storageType}:${detail.storageId}`,
      uploadScheduleEnabled: detail.uploadScheduleEnabled ? 1 : 0,
    }
    dialogState.open = true
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

function closeDialog() {
  closeActionMenu()
  dialogState.open = false
  dialogState.errorMessage = ''
}

async function submitDialog(payload) {
  dialogState.submitting = true
  dialogState.errorMessage = ''

  try {
    if (dialogState.mode === 'edit' && editingId.value) {
      await backupAccountApi.update(editingId.value, payload)
      setFeedback('存储节点配置已更新。', 'success')
    } else {
      await backupAccountApi.create(payload)
      setFeedback('存储节点配置已新增。', 'success')
    }

    dialogState.open = false
    await loadBackupAccounts(1, true)
  } catch (error) {
    dialogState.errorMessage = error.message
  } finally {
    dialogState.submitting = false
  }
}

async function toggleStatus(item) {
  closeActionMenu()
  pendingAction.value = buildActionKey(item.id, 'toggle')

  try {
    const result = await backupAccountApi.toggleStatus(item.id)
    item.status = result.status
    item.enabled = result.enabled
    setFeedback(`存储节点配置“${item.title}”状态已更新。`, 'success')
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function executeBackup(item, mode) {
  closeActionMenu()
  const modeLabel = mode === 'full' ? '全量备份' : '增量备份'
  if (!window.confirm(`确认从备份客户端对“${item.title}”执行${modeLabel}到本地缓存？`)) {
    return
  }

  pendingAction.value = buildActionKey(item.id, `backup-${mode}`)

  try {
    const result = await backupAccountApi.backup(item.id, mode)
    setFeedback(result.message || `${modeLabel}已执行。`, 'success')
    await loadBackupAccounts(pagination.page, true)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function uploadNow(item) {
  closeActionMenu()
  if (!window.confirm(`确认把存储节点配置“${item.title}”的本地缓存上传到目标存储设备？`)) {
    return
  }

  pendingAction.value = buildActionKey(item.id, 'upload')

  try {
    const result = await backupAccountApi.upload(item.id)
    setFeedback(result.message || '上传已执行。', 'success')
    await loadBackupAccounts(pagination.page, true)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function deleteAccount(item) {
  closeActionMenu()
  if (!window.confirm(`确认删除存储节点配置“${item.title}”？`)) {
    return
  }

  pendingAction.value = buildActionKey(item.id, 'delete')

  try {
    await backupAccountApi.remove(item.id)
    setFeedback(`存储节点配置“${item.title}”已删除。`, 'success')
    await loadBackupAccounts(1, true)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}
</script>

<template>
  <section class="content-grid">
    <article class="panel">
      <div class="panel__toolbar panel__toolbar--stack">
        <div>
          <p class="eyebrow">查询条件</p>
          <h2>存储节点配置列表</h2>
          <p class="subtle-text" style="margin-top: 0.5rem; display: flex; gap: 1.5rem;">
            <span>总数：<strong style="color: var(--text);">{{ formatCount(pagination.total) }}</strong></span>
            <span>启用中：<strong style="color: var(--text);">{{ formatCount(enabledCount) }}</strong></span>
          </p>
        </div>

        <div class="inline-actions">
          <button type="button" :disabled="optionsLoading" @click="openCreateDialog">新增存储节点配置</button>
        </div>
      </div>

      <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`" style="margin-bottom: 1.5rem;">
        {{ feedback.message }}
      </div>

      <form class="toolbar-grid toolbar-grid--wide" @submit.prevent="submitSearch">
        <label class="field">
          <span class="field__label">关键字</span>
          <input v-model.trim="filters.keyword" type="text" placeholder="名称、客户端 IP、源路径" />
        </label>

        <label class="field">
          <span class="field__label">状态</span>
          <select v-model="filters.status" class="select-field">
            <option value="">全部</option>
            <option :value="1">启用</option>
            <option :value="0">停用</option>
          </select>
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
          <h2>共 {{ formatCount(pagination.total) }} 个存储节点配置</h2>
        </div>
      </div>

      <div v-if="loading" class="backup-account-empty">
        存储节点配置加载中...
      </div>
      <div v-else-if="!items.length" class="backup-account-empty">
        未找到存储节点配置。
      </div>
      <div v-else class="backup-account-list">
        <article v-for="item in items" :key="item.id" class="backup-account-card">
          <header class="backup-account-card__header">
            <div class="backup-account-card__identity">
              <div class="backup-account-card__title-row">
                <div>
                  <h3>{{ item.title }}</h3>
                  <div class="backup-account-card__meta-line">
                    <span>客户端 {{ formatValue(item.serverIp) }}</span>
                    <span>账号 {{ formatValue(item.username) }}</span>
                  </div>
                </div>

                <span class="status-pill" :class="formatStatusClass(item.status)">
                  {{ formatStatusLabel(item.status) }}
                </span>
              </div>

              <div class="backup-account-card__tags">
                <span class="backup-account-tag">默认 {{ formatBackupType(item) }}</span>
                <span class="backup-account-tag" :class="formatSwitchClass(item.backupScheduleEnabled)">
                  备份 {{ formatSwitchLabel(item.backupScheduleEnabled) }}
                </span>
                <span class="backup-account-tag" :class="formatSwitchClass(item.uploadScheduleEnabled)">
                  上传 {{ formatSwitchLabel(item.uploadScheduleEnabled) }}
                </span>
              </div>
            </div>

            <div
              :ref="(element) => setActionMenuRef(item.id, element)"
              class="backup-account-action"
            >
              <button
                type="button"
                class="ghost backup-account-action__trigger"
                :aria-controls="`backup-account-actions-${item.id}`"
                :aria-expanded="isActionMenuOpen(item.id)"
                @click="toggleActionMenu(item.id)"
              >
                {{ isActionMenuOpen(item.id) ? '收起操作' : '操作' }}
              </button>

              <div
                v-if="isActionMenuOpen(item.id)"
                :id="`backup-account-actions-${item.id}`"
                class="backup-account-action__menu"
              >
                <button type="button" class="ghost backup-account-action__item" @click="openEditDialog(item)">
                  编辑账户
                </button>
                <button
                  type="button"
                  class="ghost backup-account-action__item"
                  :disabled="isBusy(item.id, 'toggle')"
                  @click="toggleStatus(item)"
                >
                  {{ isBusy(item.id, 'toggle') ? '处理中...' : Number(item.status) === 1 ? '停用账户' : '启用账户' }}
                </button>
                <button
                  type="button"
                  class="ghost backup-account-action__item"
                  :disabled="isBusy(item.id, 'backup-full')"
                  @click="executeBackup(item, 'full')"
                >
                  {{ isBusy(item.id, 'backup-full') ? '备份中...' : '全量备份' }}
                </button>
                <button
                  type="button"
                  class="ghost backup-account-action__item"
                  :disabled="isBusy(item.id, 'backup-incremental')"
                  @click="executeBackup(item, 'incremental')"
                >
                  {{ isBusy(item.id, 'backup-incremental') ? '备份中...' : '增量备份' }}
                </button>
                <button
                  type="button"
                  class="ghost backup-account-action__item"
                  :disabled="isBusy(item.id, 'upload')"
                  @click="uploadNow(item)"
                >
                  {{ isBusy(item.id, 'upload') ? '上传中...' : '立即上传' }}
                </button>
                <button
                  type="button"
                  class="danger backup-account-action__item"
                  :disabled="isBusy(item.id, 'delete')"
                  @click="deleteAccount(item)"
                >
                  {{ isBusy(item.id, 'delete') ? '删除中...' : '删除账户' }}
                </button>
              </div>
            </div>
          </header>

          <div class="backup-account-card__source" style="grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem;">
            <div style="display: grid; gap: 0.35rem;">
              <span class="field__label">备份源路径</span>
              <strong>{{ formatValue(item.dirName) }}</strong>
            </div>
            <div v-if="formOptions.cacheRoot" style="display: grid; gap: 0.35rem;">
              <span class="field__label">缓存根目录</span>
              <strong>{{ formOptions.cacheRoot }}</strong>
            </div>
          </div>

          <div class="backup-account-card__sections">
            <section class="backup-account-section">
              <p class="eyebrow">备份概况</p>
              <div class="backup-account-section__grid">
                <div class="backup-account-kv">
                  <span>定时备份</span>
                  <strong>{{ formatBackupScheduleLabel(item) }}</strong>
                </div>
                <div class="backup-account-kv">
                  <span>上次备份</span>
                  <strong>{{ formatValue(item.lastBackupAt) }}</strong>
                </div>
                <div class="backup-account-kv backup-account-kv--wide">
                  <span>备份结果</span>
                  <strong>{{ formatValue(item.lastBackupInfo) }}</strong>
                </div>
              </div>
            </section>

            <section class="backup-account-section">
              <p class="eyebrow">缓存与上传</p>
              <div class="backup-account-section__grid">
                <div class="backup-account-kv backup-account-kv--wide">
                  <span>本地缓存路径</span>
                  <strong>{{ formatValue(item.localCachePath) }}</strong>
                  <small>{{ formatCacheState(item) }}</small>
                </div>
                <div class="backup-account-kv">
                  <span>上传存储设备</span>
                  <strong>{{ formatStorageLabel(item) }}</strong>
                </div>
                <div class="backup-account-kv">
                  <span>定时上传</span>
                  <strong>{{ formatScheduleLabel(item) }}</strong>
                </div>
                <div class="backup-account-kv">
                  <span>上次上传</span>
                  <strong>{{ formatValue(item.lastUploadAt) }}</strong>
                </div>
                <div class="backup-account-kv backup-account-kv--wide">
                  <span>上传结果</span>
                  <strong>{{ formatValue(item.lastUploadInfo) }}</strong>
                </div>
              </div>
            </section>
          </div>
        </article>
      </div>

      <div class="panel__footer" style="display: flex; justify-content: flex-end; margin-top: 1rem;">
        <div class="page-nav">
          <select
            class="input-field"
            style="width: 8rem; padding: 0.1rem;"
            :value="pagination.pageSize"
            @change="changePageSize"
          >
            <option :value="10">10 条/页</option>
            <option :value="20">20 条/页</option>
            <option :value="50">50 条/页</option>
            <option :value="100">100 条/页</option>
          </select>

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

    <BackupAccountDialog
      :open="dialogState.open"
      :mode="dialogState.mode"
      :submitting="dialogState.submitting"
      :error-message="dialogState.errorMessage"
      :initial-value="dialogValue"
      :backup-types="formOptions.backupTypes"
      :storage-groups="formOptions.storageGroups"
      :cache-path-pattern="formOptions.cachePathPattern"
      @close="closeDialog"
      @submit="submitDialog"
    />
  </section>
</template>

<style scoped>
.backup-account-list {
  display: grid;
  gap: 1rem;
}

.backup-account-empty {
  padding: 2.4rem 1rem;
  border-radius: 22px;
  border: 1px dashed rgba(22, 59, 54, 0.16);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(247, 244, 237, 0.72)),
    rgba(22, 59, 54, 0.03);
  text-align: center;
  color: var(--text-muted);
}

.backup-account-card {
  position: relative;
  display: grid;
  gap: 1rem;
  padding: 1.35rem;
  border-radius: 24px;
  border: 1px solid rgba(22, 59, 54, 0.1);
  background:
    radial-gradient(circle at top right, rgba(31, 96, 88, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 245, 239, 0.9));
  box-shadow: 0 18px 34px rgba(22, 48, 43, 0.06);
}

.backup-account-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.backup-account-card__identity {
  display: grid;
  gap: 0.8rem;
  min-width: 0;
}

.backup-account-card__title-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  justify-content: space-between;
}

.backup-account-card__title-row h3 {
  margin: 0;
  font-size: 1.28rem;
}

.backup-account-card__meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  margin-top: 0.35rem;
  color: var(--text-muted);
  font-size: 0.92rem;
}

.backup-account-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.backup-account-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.78rem;
  border-radius: 999px;
  background: rgba(22, 59, 54, 0.06);
  border: 1px solid rgba(22, 59, 54, 0.08);
  color: var(--text-main);
  font-size: 0.82rem;
  font-weight: 700;
}

.backup-account-tag--accent {
  background: rgba(31, 96, 88, 0.14);
  border-color: rgba(31, 96, 88, 0.12);
  color: var(--accent);
}

.backup-account-tag--muted {
  background: rgba(92, 114, 109, 0.1);
  border-color: rgba(92, 114, 109, 0.1);
  color: var(--text-muted);
}

.backup-account-card__source {
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem 1rem;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(22, 59, 54, 0.08);
}

.backup-account-card__source strong {
  overflow-wrap: anywhere;
  font-size: 1rem;
}

.backup-account-card__sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.backup-account-section {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 20px;
  background: rgba(22, 59, 54, 0.04);
  border: 1px solid var(--border-soft);
}

.backup-account-section__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.backup-account-kv {
  display: grid;
  gap: 0.28rem;
  min-width: 0;
}

.backup-account-kv--wide {
  grid-column: 1 / -1;
}

.backup-account-kv span,
.backup-account-kv small {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.backup-account-kv strong {
  overflow-wrap: anywhere;
  font-size: 0.98rem;
  line-height: 1.55;
}

.backup-account-action {
  position: relative;
  flex-shrink: 0;
}

.backup-account-action__trigger {
  min-width: 6rem;
}

.backup-account-action__menu {
  position: absolute;
  top: calc(100% + 0.7rem);
  right: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  width: min(24rem, calc(100vw - 5rem));
  padding: 0.9rem;
  border-radius: 18px;
  border: 1px solid rgba(22, 59, 54, 0.12);
  background: rgba(255, 252, 247, 0.98);
  box-shadow: 0 24px 48px rgba(22, 59, 54, 0.16);
}

.backup-account-action__item {
  width: 100%;
  min-width: 0;
  justify-content: center;
  white-space: normal;
}

@media (max-width: 960px) {
  .backup-account-card__header,
  .backup-account-card__title-row {
    flex-direction: column;
  }

  .backup-account-action {
    width: 100%;
  }

  .backup-account-action__trigger {
    width: 100%;
  }

  .backup-account-action__menu {
    left: 0;
    right: auto;
    width: 100%;
  }

  .backup-account-card__sections,
  .backup-account-section__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1180px) {
  .backup-account-card__sections {
    grid-template-columns: 1fr;
  }
}
</style>
