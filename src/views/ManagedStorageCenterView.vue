<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { managedFsApi } from '../api/managed-fs'
import { storageTargetApi } from '../api/storage-targets'

const route = useRoute()
const router = useRouter()

const info = ref({})
const directory = ref({})
const items = ref([])
const loading = ref(false)
const infoLoading = ref(false)
const syncing = ref(false)
const uploading = ref(false)
const deleting = ref(false)
const lifecycleLoading = ref(false)
const lifecycleSubmitting = ref(false)
const lifecycleDialogOpen = ref(false)
const activeTargetPopoverId = ref(null)
const feedback = ref(null)

// ... (existing computed/watch)

function toggleTargetPopover(id) {
  activeTargetPopoverId.value = activeTargetPopoverId.value === id ? null : id
}

function closeAllPopovers() {
  activeActionPath.value = ''
  activeTargetPopoverId.value = null
}
const currentPath = ref('/')
const selectedPaths = ref([])
const activeActionPath = ref('')
const fileInput = ref(null)
const folderInput = ref(null)
const lifecycleRules = ref([])
const storageOptions = ref({})
const lifecycleTargets = ref([])

const lifecycleForm = reactive({
  id: null,
  ruleName: '',
  pathPrefix: '/',
  enabled: true,
  priority: 100,
  minAgeSeconds: 0,
  dispatchMode: 'IMMEDIATE',
  dispatchStartTime: '00:00',
  sourceRetentionDays: -1,
  dispatchTypes: [],
  objectTargetIds: [],
  nasTargetIds: [],
  discTargetIds: [],
  note: '',
})

const filters = reactive({
  keyword: '',
})

const pagination = reactive({
  hasMore: false,
  matchedCount: 0,
  page: 1,
  pageSize: 200,
  scannedCount: 0,
})

const uploadProgress = reactive({
  active: false,
  label: '',
  percent: 0,
})

const preview = reactive({
  contentType: '',
  kind: 'frame',
  name: '',
  open: false,
  url: '',
})

const rootReady = computed(() =>
  Boolean(info.value.enabled && info.value.exists && info.value.directory && info.value.readable),
)

const rootStatus = computed(() => {
  if (!info.value.enabled) return { label: '未启用', tone: 'danger' }
  if (!info.value.exists) return { label: '挂载不存在', tone: 'danger' }
  if (!info.value.directory) return { label: '不是目录', tone: 'danger' }
  if (!info.value.readable) return { label: '不可读', tone: 'danger' }
  if (!info.value.writable) return { label: '只读', tone: 'warning' }
  return { label: '可读写', tone: 'active' }
})

const pathSegments = computed(() => {
  if (currentPath.value === '/') {
    return []
  }

  const segments = currentPath.value.split('/').filter(Boolean)
  let accumulator = ''
  return segments.map((segment) => {
    accumulator = `${accumulator}/${segment}`
    return {
      label: segment,
      path: accumulator,
    }
  })
})

const statusCards = computed(() => [
  {
    label: '挂载根',
    value: info.value.root || '/mnt/juicefs/shared',
    hint: rootStatus.value.label,
    tone: rootStatus.value.tone,
  },
  {
    label: '可用空间',
    value: formatBytes(info.value.usableSpace),
    hint: `总容量 ${formatBytes(info.value.totalSpace)}`,
    tone: 'info',
  },
  {
    label: '入账节点',
    value: formatNumber(info.value.lifecycleNodeCount),
    hint: info.value.lifecycleLedgerReady ? '生命周期台账正常' : '生命周期台账未就绪',
    tone: info.value.lifecycleLedgerReady ? 'active' : 'warning',
  },
  {
    label: '分发任务',
    value: formatNumber(info.value.lifecycleDispatchTaskCount),
    hint: scanCursorHint.value,
    tone: 'info',
  },
])

const scanCursorHint = computed(() => {
  const cursors = Array.isArray(info.value.scanCursors) ? info.value.scanCursors : []
  if (!cursors.length) {
    return '等待扫描'
  }

  const cursor = cursors[0]
  return `${cursor.scanStatus || 'IDLE'} ${cursor.lastScanAt || ''}`.trim()
})

const selectablePaths = computed(() => items.value.filter((item) => !item.archiveOnly).map((item) => item.path))
const selectedCount = computed(() => selectedPaths.value.length)
const allSelected = computed(() =>
  selectablePaths.value.length > 0 &&
  selectablePaths.value.every((path) => selectedPaths.value.includes(path)),
)

const storageGroups = computed(() => Array.isArray(storageOptions.value.groups) ? storageOptions.value.groups : [])
const activeTab = computed(() => route.query.tab === 'lifecycle' ? 'lifecycle' : 'files')
const isFilesView = computed(() => activeTab.value === 'files')
const isLifecycleView = computed(() => activeTab.value === 'lifecycle')

watch(
  () => route.query.path,
  async (path) => {
    currentPath.value = normalizeDisplayPath(path)
    pagination.page = 1
    selectedPaths.value = []
    await loadEntries(1)
  },
  { immediate: true },
)

onMounted(() => {
  loadInfo()
  loadLifecycleRules()
  loadStorageOptions()
})

async function loadInfo() {
  infoLoading.value = true
  try {
    info.value = await managedFsApi.info()
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    infoLoading.value = false
  }
}

async function loadEntries(page = pagination.page) {
  loading.value = true
  closeAllPopovers()
  closeActionMenu()
  
  const prevPage = pagination.page
  pagination.page = page

  try {
    const data = await managedFsApi.list({
      keyword: filters.keyword,
      page,
      pageSize: pagination.pageSize,
      path: currentPath.value,
    })
    directory.value = data || {}
    items.value = Array.isArray(data?.items) ? data.items : []
    pagination.page = Number(data?.page || page)
    pagination.hasMore = Boolean(data?.hasMore)
    pagination.matchedCount = Number(data?.matchedCount || items.value.length)
    pagination.scannedCount = Number(data?.scannedCount || 0)
  } catch (error) {
    pagination.page = prevPage
    items.value = []
    setFeedback(error.message, 'danger')
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  await Promise.all([loadInfo(), loadEntries(1), loadLifecycleRules()])
}

async function loadLifecycleRules() {
  lifecycleLoading.value = true
  try {
    lifecycleRules.value = await managedFsApi.lifecycleRules()
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    lifecycleLoading.value = false
  }
}

async function loadStorageOptions() {
  try {
    storageOptions.value = await storageTargetApi.options()
  } catch (error) {
    storageOptions.value = {}
  }
}

async function saveLifecycleRule() {
  lifecycleSubmitting.value = true
  try {
    const result = await managedFsApi.saveLifecycleRule({
      ...lifecycleForm,
      priority: Number(lifecycleForm.priority || 0),
      minAgeSeconds: Number(lifecycleForm.minAgeSeconds || 0),
      sourceRetentionDays: Number(lifecycleForm.sourceRetentionDays ?? -1),
    })
    lifecycleRules.value = result?.rules || await managedFsApi.lifecycleRules()
    resetLifecycleForm()
    setFeedback('生命周期规则已保存。', 'success')
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    lifecycleSubmitting.value = false
  }
}

async function saveLifecycleRuleAndClose() {
  // 同步列表数据到 form
  const objectIds = []
  const nasIds = []
  const discIds = []
  const types = new Set()

  lifecycleTargets.value.forEach((t) => {
    if (!t.id) return
    if (t.type === 'object') objectIds.push(t.id)
    if (t.type === 'nas') nasIds.push(t.id)
    if (t.type === 'disc-group') discIds.push(t.id)
    types.add(t.type)
  })

  lifecycleForm.objectTargetIds = objectIds
  lifecycleForm.nasTargetIds = nasIds
  lifecycleForm.discTargetIds = discIds
  lifecycleForm.dispatchTypes = Array.from(types)

  await saveLifecycleRule()
  if (feedback.value?.tone === 'success') {
    lifecycleDialogOpen.value = false
  }
}

async function removeLifecycleRule(rule) {
  if (!rule?.id || !window.confirm(`确认删除规则 ${rule.ruleName}？`)) {
    return
  }
  lifecycleSubmitting.value = true
  try {
    const result = await managedFsApi.removeLifecycleRule(rule.id)
    lifecycleRules.value = result?.rules || await managedFsApi.lifecycleRules()
    setFeedback('生命周期规则已删除。', 'success')
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    lifecycleSubmitting.value = false
  }
}

function editLifecycleRule(rule) {
  lifecycleForm.id = rule.id || null
  lifecycleForm.ruleName = rule.ruleName || ''
  lifecycleForm.pathPrefix = rule.pathPrefix || '/'
  lifecycleForm.enabled = Number(rule.enabled) === 1 || rule.enabled === true
  lifecycleForm.priority = Number(rule.priority || 100)
  lifecycleForm.minAgeSeconds = Number(rule.minAgeSeconds || 0)
  lifecycleForm.dispatchMode = rule.dispatchMode || 'IMMEDIATE'
  lifecycleForm.dispatchStartTime = rule.dispatchStartTime || '00:00'
  lifecycleForm.sourceRetentionDays = Number(rule.sourceRetentionDays ?? -1)
  lifecycleForm.note = rule.note || ''

  // 转换为列表格式
  const targets = []
  splitValues(rule.objectTargetIds).forEach((id) => targets.push({ type: 'object', id: Number(id) }))
  splitValues(rule.nasTargetIds).forEach((id) => targets.push({ type: 'nas', id: Number(id) }))
  splitValues(rule.discTargetIds).forEach((id) => targets.push({ type: 'disc-group', id: Number(id) }))

  if (targets.length === 0) {
    targets.push({ type: 'object', id: null })
  }
  lifecycleTargets.value = targets
}

function resetLifecycleForm() {
  lifecycleForm.id = null
  lifecycleForm.ruleName = ''
  lifecycleForm.pathPrefix = currentPath.value || '/'
  lifecycleForm.enabled = true
  lifecycleForm.priority = 100
  lifecycleForm.minAgeSeconds = 0
  lifecycleForm.dispatchMode = 'IMMEDIATE'
  lifecycleForm.dispatchStartTime = '00:00'
  lifecycleForm.sourceRetentionDays = -1
  lifecycleForm.note = ''

  lifecycleTargets.value = [{ type: 'object', id: null }]
}

function addLifecycleTarget() {
  lifecycleTargets.value.push({ type: 'object', id: null })
}

function removeLifecycleTarget(index) {
  lifecycleTargets.value.splice(index, 1)
  if (lifecycleTargets.value.length === 0) {
    lifecycleTargets.value.push({ type: 'object', id: null })
  }
}

async function syncCurrent(recursive = false) {
  syncing.value = true
  try {
    const result = await managedFsApi.sync({
      path: currentPath.value,
      recursive,
    })
    setFeedback(`已同步 ${formatNumber(result?.scannedCount)} 个路径。`, 'success')
    await refreshAll()
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    syncing.value = false
  }
}

async function createDirectory() {
  const rawName = window.prompt('请输入新目录名称')
  const name = normalizeChildName(rawName)
  if (!name) {
    return
  }

  try {
    await managedFsApi.createDirectory(joinPath(currentPath.value, name))
    setFeedback('目录已创建。', 'success')
    await refreshAll()
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

async function createMountRootDirectory() {
  const rawName = window.prompt('请输入挂载根目录名称，例如 项目A 或 导入区1')
  const name = normalizeChildName(rawName)
  if (!name) {
    return
  }
  if (name.includes('/')) {
    setFeedback('挂载根目录必须是一级目录，名称不能包含 /。', 'warning')
    return
  }

  const targetPath = joinPath('/', name)
  try {
    await managedFsApi.createDirectory(targetPath)
    setFeedback(`挂载根目录 ${targetPath} 已创建。`, 'success')
    navigateTo(targetPath)
    await loadInfo()
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

function triggerUpload(kind) {
  if (kind === 'folder') {
    folderInput.value?.click()
    return
  }

  fileInput.value?.click()
}

async function handleUpload(event) {
  const input = event.target
  const files = Array.from(input.files || [])
  if (!files.length) {
    return
  }

  const formData = new FormData()
  files.forEach((file) => {
    formData.append('files', file)
    formData.append('relativePaths', file.webkitRelativePath || file.name)
  })

  uploading.value = true
  uploadProgress.active = true
  uploadProgress.percent = 0
  uploadProgress.label = `${files.length} 个文件`
  try {
    const result = await managedFsApi.upload(currentPath.value, formData, (progress) => {
      uploadProgress.percent = progress.percent
    })
    setFeedback(
      `上传完成，新增 ${formatNumber(result?.created)}，覆盖 ${formatNumber(result?.updated)}，失败 ${formatNumber(result?.failed)}。`,
      result?.failed ? 'warning' : 'success',
    )
    await refreshAll()
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    uploading.value = false
    uploadProgress.active = false
    input.value = ''
  }
}

async function deleteItem(item) {
  closeActionMenu()
  if (!item?.path || !window.confirm(`确认删除 ${item.name}？`)) {
    return
  }

  deleting.value = true
  try {
    await managedFsApi.remove(item.path)
    setFeedback('已删除。', 'success')
    selectedPaths.value = selectedPaths.value.filter((path) => path !== item.path)
    await refreshAll()
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    deleting.value = false
  }
}

async function deleteSelected() {
  if (!selectedPaths.value.length || !window.confirm(`确认删除选中的 ${selectedPaths.value.length} 个路径？`)) {
    return
  }

  deleting.value = true
  try {
    for (const path of selectedPaths.value) {
      await managedFsApi.remove(path)
    }
    setFeedback('选中路径已删除。', 'success')
    selectedPaths.value = []
    await refreshAll()
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    deleting.value = false
  }
}

function openItem(item) {
  closeActionMenu()
  if (item.directory) {
    navigateTo(item.path)
    return
  }
  if (item.archiveOnly) {
    previewArchiveItem(item)
    return
  }

  previewItem(item)
}

function previewItem(item) {
  closeActionMenu()
  preview.name = item.name || item.path
  preview.contentType = item.contentType || ''
  preview.kind = previewKind(item.contentType)
  preview.url = managedFsApi.previewUrl(item.path)
  preview.open = true
}

function closePreview() {
  preview.open = false
  preview.url = ''
}

function downloadItem(item) {
  closeActionMenu()
  window.open(managedFsApi.downloadUrl(item.path), '_blank', 'noopener')
}

function firstReadableArchiveCopy(item) {
  const copies = Array.isArray(item?.archiveCopies) ? item.archiveCopies : []
  return copies.find((copy) => copy.onlineReadable) || copies[0] || null
}

function previewArchiveItem(item) {
  closeActionMenu()
  const copy = firstReadableArchiveCopy(item)
  if (!copy?.onlineReadable) {
    setFeedback('该文件只有离线归档副本，请到对应光盘组取盘读取。', 'warning')
    return
  }
  preview.name = item.name || item.path
  preview.contentType = item.contentType || ''
  preview.kind = previewKind(item.contentType)
  preview.url = managedFsApi.archivePreviewUrl(item.path, copy.copyKey)
  preview.open = true
}

function downloadArchiveItem(item) {
  closeActionMenu()
  const copy = firstReadableArchiveCopy(item)
  if (!copy?.onlineReadable) {
    setFeedback('该文件只有离线归档副本，请到对应光盘组取盘读取。', 'warning')
    return
  }
  window.open(managedFsApi.archiveDownloadUrl(item.path, copy.copyKey), '_blank', 'noopener')
}

function toggleActionMenu(item) {
  activeActionPath.value = activeActionPath.value === item?.path ? '' : item?.path || ''
}

function closeActionMenu() {
  activeActionPath.value = ''
}

function hasArchiveCopies(item) {
  return Array.isArray(item?.archiveCopies) && item.archiveCopies.length > 0
}

function navigateTo(path) {
  const normalized = normalizeDisplayPath(path)
  router.push({
    name: 'storage-center',
    query: normalized === '/' ? { tab: 'files' } : { tab: 'files', path: normalized },
  })
}

function goParent() {
  if (directory.value.parentPath) {
    navigateTo(directory.value.parentPath)
  }
}

function applySearch() {
  selectedPaths.value = []
  loadEntries(1)
}

function resetSearch() {
  filters.keyword = ''
  applySearch()
}

function previousPage() {
  if (pagination.page <= 1 || loading.value) {
    return
  }

  selectedPaths.value = []
  loadEntries(pagination.page - 1)
}

function nextPage() {
  if (!pagination.hasMore || loading.value) {
    return
  }

  selectedPaths.value = []
  loadEntries(pagination.page + 1)
}

function jumpToPage(event) {
  const target = Number(event.target.value)
  if (target >= 1 && target !== pagination.page) {
    selectedPaths.value = []
    loadEntries(target)
  } else {
    event.target.value = pagination.page
  }
}

function changePageSize(event) {
  const newSize = Number(event.target.value)
  if (newSize !== pagination.pageSize) {
    pagination.pageSize = newSize
    selectedPaths.value = []
    loadEntries(1)
  }
}

function toggleSelect(path, checked) {
  if (checked) {
    if (!selectedPaths.value.includes(path)) {
      selectedPaths.value = [...selectedPaths.value, path]
    }
    return
  }

  selectedPaths.value = selectedPaths.value.filter((item) => item !== path)
}

function toggleSelectAll(checked) {
  selectedPaths.value = checked ? [...selectablePaths.value] : []
}

function isSelected(path) {
  return selectedPaths.value.includes(path)
}

function lifecycleLabel(item) {
  if (item?.directory) {
    return item?.lifecycleManaged || item?.managed ? '目录已入账' : '目录待扫描'
  }
  if (item?.archiveOnly) {
    return item?.archiveAvailable ? '源已删，副本可读' : '源已删，离线归档'
  }

  const status = String(item?.lifecycle?.syncStatus || '').toUpperCase()
  const labels = {
    FAILED: '分发失败',
    DELETED: '已删除',
    DISPATCHING: '分发中',
    INDEXED: '已生成分发任务',
    NEW: '等待稳定检测',
    PARTIAL_SUCCESS: '部分成功',
    STABLE: '待分发',
    STABILIZING: '稳定检测中',
    SUCCESS: '已分发',
  }

  if (status) {
    return labels[status] || status
  }
  if (item?.lifecycleManaged) {
    return '已入账'
  }
  if (item?.managed) {
    return '元数据已入账'
  }
  return '待扫描'
}

function lifecycleClass(item) {
  if (item?.directory) {
    return item?.lifecycleManaged || item?.managed ? 'status-pill--info' : 'status-pill--idle'
  }
  if (item?.archiveOnly) {
    return item?.archiveAvailable ? 'status-pill--info' : 'status-pill--muted'
  }

  const status = String(item?.lifecycle?.syncStatus || '').toUpperCase()
  if (status === 'SUCCESS') return 'status-pill--active'
  if (status === 'STABLE' || status === 'INDEXED') return 'status-pill--info'
  if (status === 'DISPATCHING' || status === 'NEW' || status === 'STABILIZING' || status === 'PARTIAL_SUCCESS') return 'status-pill--warning'
  if (status === 'FAILED') return 'status-pill--danger'
  if (status === 'DELETED') return 'status-pill--muted'
  return item?.lifecycleManaged || item?.managed ? 'status-pill--info' : 'status-pill--idle'
}

function typeLabel(item) {
  if (item.directory) return '目录'
  if (item.archiveOnly) return '归档副本'
  if (item.contentType) return item.contentType
  return '文件'
}

function rowTypeClass(item) {
  if (item.archiveOnly) return 'status-pill--info'
  return item.directory ? 'status-pill--info' : 'status-pill--active'
}

function permissionLabel(item) {
  const permissions = item.permissions || {}
  const values = []
  if (permissions.read) values.push('读')
  if (permissions.write) values.push('写')
  if (permissions.delete) values.push('删')
  return values.length ? values.join('/') : '无'
}

function targetItems(type) {
  const group = storageGroups.value.find((item) => item.code === type)
  return Array.isArray(group?.items) ? group.items : []
}

function splitValues(value) {
  if (!value) {
    return []
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function dispatchTypeLabel(type) {
  const labels = {
    OBJECT: '对象存储',
    object: '对象存储',
    NAS: 'NAS',
    nas: 'NAS',
    'DISC-GROUP': '光盘组',
    'disc-group': '光盘组',
  }
  return labels[type] || type
}

function ruleTypesLabel(rule) {
  const values = splitValues(rule.dispatchTypes)
  return values.length ? values.map(dispatchTypeLabel).join(' / ') : '全部类型'
}

function ruleTargetsLabel(rule) {
  const parts = []
  const objectTargets = targetLabels('object', rule.objectTargetIds)
  const nasTargets = targetLabels('nas', rule.nasTargetIds)
  const discTargets = targetLabels('disc-group', rule.discTargetIds)
  if (objectTargets) parts.push(`对象:${objectTargets}`)
  if (nasTargets) parts.push(`NAS:${nasTargets}`)
  if (discTargets) parts.push(`光盘:${discTargets}`)
  return parts.length ? parts.join('  ') : '使用所有启用目标'
}

function ruleDispatchTimeLabel(rule) {
  if (rule.dispatchMode === 'SCHEDULED') {
    return `每天 ${rule.dispatchStartTime || '00:00'} 后分发`
  }
  return '立刻分发'
}

function ruleCleanupLabel(rule) {
  const days = Number(rule.sourceRetentionDays)
  if (!Number.isFinite(days) || days < 0) {
    return '源文件不自动清理'
  }
  if (days === 0) {
    return '分发完成后立即清理源文件'
  }
  return `分发完成后保留 ${formatNumber(days)} 天再清理源文件`
}

function targetLabels(type, value) {
  const ids = splitValues(value)
  if (!ids.length) {
    return ''
  }
  const items = targetItems(type)
  return ids
    .map((id) => {
      const option = items.find((item) => String(item.id) === String(id))
      return option?.label || id
    })
    .join(',')
}

function previewKind(contentType) {
  const type = String(contentType || '').toLowerCase()
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  return 'frame'
}

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
}

function formatBytes(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    return '--'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = number
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index++
  }

  const precision = index === 0 || size >= 100 ? 0 : 1
  return `${size.toFixed(precision)} ${units[index]}`
}

function formatNumber(value) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number.toLocaleString() : '0'
}

function normalizeDisplayPath(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return '/'
  }

  let normalized = value.trim().replace(/\\/g, '/')
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  while (normalized.includes('//')) {
    normalized = normalized.replace(/\/\//g, '/')
  }
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : '/'
}

function normalizeChildName(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

function joinPath(base, child) {
  const normalizedBase = normalizeDisplayPath(base)
  const normalizedChild = normalizeChildName(child)
  if (!normalizedChild) {
    return normalizedBase
  }
  return normalizedBase === '/' ? `/${normalizedChild}` : `${normalizedBase}/${normalizedChild}`
}
</script>

<template>
  <section class="storage-center-page">
    <header class="panel storage-overview">
      <div class="storage-overview__heading">
        <p class="eyebrow">JuiceFS</p>
        <h1>JuiceFS管理页</h1>
      </div>
      <div class="storage-overview__actions">
        <button type="button" class="ghost" :disabled="infoLoading || loading" @click="refreshAll">
          {{ infoLoading || loading ? '刷新中...' : '刷新' }}
        </button>
        <button v-if="isFilesView" type="button" class="ghost" :disabled="!rootReady" @click="createMountRootDirectory">
          创建挂载根目录
        </button>
        <button v-if="isFilesView" type="button" :disabled="syncing || !rootReady" @click="syncCurrent(false)">
          {{ syncing ? '同步中...' : '同步当前目录' }}
        </button>
        <button v-if="isFilesView" type="button" class="ghost" :disabled="syncing || !rootReady" @click="syncCurrent(true)">
          递归同步
        </button>
      </div>
    </header>

    <section class="storage-metrics">
      <article v-for="card in statusCards" :key="card.label" class="storage-metric" :class="`storage-metric--${card.tone}`">
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
        <p>{{ card.hint }}</p>
      </article>
    </section>

    <section v-if="feedback" class="storage-feedback" :class="`storage-feedback--${feedback.tone}`">
      {{ feedback.message }}
    </section>

    <section v-if="isLifecycleView" class="panel lifecycle-panel" @click="closeAllPopovers">
      <header class="lifecycle-panel__header">
        <div>
          <p class="eyebrow">Lifecycle Rules</p>
          <h2>生命周期规则</h2>
        </div>
        <div class="lifecycle-panel__actions">
          <button type="button" class="primary-button" @click="resetLifecycleForm(); lifecycleDialogOpen = true">新增规则</button>
          <button type="button" class="ghost" :disabled="lifecycleLoading" @click="loadLifecycleRules">
            {{ lifecycleLoading ? '加载中...' : '刷新规则' }}
          </button>
        </div>
      </header>

      <div class="lifecycle-list">
        <div class="lifecycle-list__header">
          <span>规则名称</span>
          <span>路径前缀</span>
          <span>分发配置</span>
          <span>优先级</span>
          <span>状态</span>
          <span class="text-right">操作</span>
        </div>
        <div v-if="!lifecycleRules.length" class="lifecycle-rule-empty">
          {{ lifecycleLoading ? '正在加载规则...' : '暂无生命周期规则' }}
        </div>
        <article v-for="rule in lifecycleRules" :key="rule.id" class="lifecycle-row">
          <div class="lifecycle-row__name">
            <strong>{{ rule.ruleName }}</strong>
            <small v-if="rule.note">{{ rule.note }}</small>
          </div>
          <code class="lifecycle-row__path">{{ rule.pathPrefix }}</code>
          <div class="lifecycle-row__types">
            <div class="lifecycle-type-trigger" @click.stop="toggleTargetPopover(rule.id)">
              <span class="status-pill status-pill--info small">{{ ruleTypesLabel(rule) }}</span>
              <span class="icon-arrow-down"></span>
            </div>
            
            <div v-if="activeTargetPopoverId === rule.id" class="lifecycle-target-popover" @click.stop>
              <div class="lifecycle-popover-item">
                <p class="lifecycle-popover-label">分发策略</p>
                <strong>{{ ruleDispatchTimeLabel(rule) }} / {{ ruleCleanupLabel(rule) }}</strong>
              </div>
              <div class="lifecycle-popover-item">
                <p class="lifecycle-popover-label">详细目标设备</p>
                <p class="lifecycle-popover-value">{{ ruleTargetsLabel(rule) }}</p>
              </div>
            </div>
          </div>
          <div class="lifecycle-row__priority">{{ rule.priority }}</div>
          <div class="lifecycle-row__status">
            <span class="status-pill" :class="Number(rule.enabled) === 1 ? 'status-pill--active' : 'status-pill--idle'">
              {{ Number(rule.enabled) === 1 ? '启用' : '停用' }}
            </span>
          </div>
          <div class="lifecycle-row__actions">
            <button type="button" class="ghost small" @click="editLifecycleRule(rule); lifecycleDialogOpen = true">编辑</button>
            <button type="button" class="ghost small danger-inline" :disabled="lifecycleSubmitting" @click="removeLifecycleRule(rule)">删除</button>
          </div>
        </article>
      </div>
    </section>

    <!-- Lifecycle Rule Dialog -->
    <div v-if="lifecycleDialogOpen" class="storage-preview" @click.self="lifecycleDialogOpen = false">
      <section class="storage-preview__dialog lifecycle-dialog">
        <header>
          <div>
            <p class="eyebrow">Lifecycle Settings</p>
            <h2>{{ lifecycleForm.id ? '编辑生命周期规则' : '新增生命周期规则' }}</h2>
          </div>
          <button type="button" class="ghost" @click="lifecycleDialogOpen = false">关闭</button>
        </header>
        <div class="storage-preview__body">
          <form class="lifecycle-dialog-form" @submit.prevent="saveLifecycleRuleAndClose">
            <div class="lifecycle-dialog-form__grid">
              <label>
                <span>规则名称</span>
                <input v-model="lifecycleForm.ruleName" class="input-field" placeholder="例如 项目A分发规则" required />
              </label>
              <label>
                <span>路径前缀</span>
                <input v-model="lifecycleForm.pathPrefix" class="input-field" placeholder="/项目A" required />
              </label>
              <label>
                <span>优先级</span>
                <input v-model.number="lifecycleForm.priority" class="input-field" type="number" min="0" />
              </label>
              <label>
                <span>延迟秒数</span>
                <input v-model.number="lifecycleForm.minAgeSeconds" class="input-field" type="number" min="0" />
              </label>
              <label>
                <span>分发方式</span>
                <select v-model="lifecycleForm.dispatchMode" class="input-field">
                  <option value="IMMEDIATE">立刻分发</option>
                  <option value="SCHEDULED">定时分发</option>
                </select>
              </label>
              <label>
                <span>开始时间</span>
                <input
                  v-model="lifecycleForm.dispatchStartTime"
                  class="input-field"
                  type="time"
                  :disabled="lifecycleForm.dispatchMode !== 'SCHEDULED'"
                />
              </label>
              <label>
                <span>源文件清理 (天)</span>
                <input v-model.number="lifecycleForm.sourceRetentionDays" class="input-field" type="number" min="-1" placeholder="-1 不清理, 0 立即清理" />
              </label>
              <label>
                <span>启用状态</span>
                <select v-model="lifecycleForm.enabled" class="input-field">
                  <option :value="true">启用</option>
                  <option :value="false">停用</option>
                </select>
              </label>
              
              <div class="lifecycle-dialog-form__wide">
                <div class="lifecycle-targets-editor">
                  <div v-for="(target, index) in lifecycleTargets" :key="index" class="lifecycle-target-row">
                    <span class="lifecycle-target-label">{{ index === 0 ? '存储目标：' : '' }}</span>
                    <select v-model="target.type" class="input-field type-select" @change="target.id = null">
                      <option value="disc-group">蓝光光盘库</option>
                      <option value="object">对象存储</option>
                      <option value="nas">NAS存储</option>
                    </select>
                    <select v-model="target.id" class="input-field target-select">
                      <option :value="null">请选择设备</option>
                      <option v-for="item in targetItems(target.type)" :key="item.id" :value="Number(item.id)">
                        {{ item.label }}
                      </option>
                    </select>
                    <button type="button" class="ghost small danger-inline" @click="removeLifecycleTarget(index)">删除</button>
                  </div>
                  <div class="lifecycle-target-add">
                    <button type="button" class="link-button" @click="addLifecycleTarget">+ 添加存储目标</button>
                  </div>
                </div>
              </div>

              <label class="lifecycle-dialog-form__wide">
                <span>备注</span>
                <textarea v-model="lifecycleForm.note" class="input-field" rows="2" placeholder="规则说明"></textarea>
              </label>
            </div>
            <footer class="lifecycle-dialog-footer">
              <button type="button" class="ghost" @click="lifecycleDialogOpen = false">取消</button>
              <button type="submit" class="primary-button" :disabled="lifecycleSubmitting">
                {{ lifecycleSubmitting ? '保存中...' : '提交规则' }}
              </button>
            </footer>
          </form>
        </div>
      </section>
    </div>

    <section v-if="isFilesView" class="panel storage-browser" @click="closeActionMenu">
      <div class="storage-browser__toolbar">
        <div class="path-line">
          <button type="button" class="link-button" @click="navigateTo('/')">根目录</button>
          <template v-for="segment in pathSegments" :key="segment.path">
            <span>/</span>
            <button type="button" class="link-button" @click="navigateTo(segment.path)">
              {{ segment.label }}
            </button>
          </template>
        </div>

        <div class="storage-browser__buttons">
          <button type="button" class="ghost" :disabled="currentPath === '/'" @click="goParent">上级目录</button>
          <button type="button" class="ghost" :disabled="!directory.permissions?.write" @click="createDirectory">新建目录</button>
          <button type="button" class="ghost" :disabled="uploading || !directory.permissions?.write" @click="triggerUpload('files')">上传文件</button>
          <button type="button" class="ghost" :disabled="uploading || !directory.permissions?.write" @click="triggerUpload('folder')">上传文件夹</button>
          <button type="button" class="danger" :disabled="deleting || selectedCount === 0" @click="deleteSelected">
            删除选中 {{ selectedCount ? `(${selectedCount})` : '' }}
          </button>
        </div>
      </div>

      <div class="storage-filter">
        <input
          v-model="filters.keyword"
          class="input-field"
          type="search"
          placeholder="按文件名搜索当前目录"
          @keyup.enter="applySearch"
        />
        <button type="button" @click="applySearch">搜索</button>
        <button type="button" class="ghost" :disabled="!filters.keyword" @click="resetSearch">清空</button>
      </div>

      <div v-if="uploadProgress.active" class="upload-progress storage-upload-progress">
        <div class="upload-progress__meta">
          <strong>正在上传 {{ uploadProgress.label }}</strong>
          <span>{{ uploadProgress.percent }}%</span>
        </div>
        <div class="upload-progress__track">
          <span class="upload-progress__fill" :style="{ width: `${uploadProgress.percent}%` }"></span>
        </div>
      </div>

      <input ref="fileInput" type="file" multiple hidden @change="handleUpload" />
      <input ref="folderInput" type="file" multiple hidden webkitdirectory directory @change="handleUpload" />

      <div class="account-table-wrap storage-table-wrap">
        <table class="account-table storage-table">
          <thead>
            <tr>
              <th class="storage-table__check">
                <input type="checkbox" :checked="allSelected" :disabled="!items.length" @change="toggleSelectAll($event.target.checked)" />
              </th>
              <th>名称</th>
              <th>类型</th>
              <th>大小</th>
              <th>修改时间</th>
              <th>生命周期</th>
              <th>权限</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="empty-cell">正在读取目录...</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="8" class="empty-cell">当前目录暂无文件。</td>
            </tr>
            <template v-else>
              <tr v-for="item in items" :key="item.path">
                <td class="storage-table__check">
                  <input type="checkbox" :checked="isSelected(item.path)" :disabled="item.archiveOnly" @change="toggleSelect(item.path, $event.target.checked)" />
                </td>
                <td>
                  <button type="button" class="link-button storage-name-button" @click="openItem(item)">
                    <span class="storage-name-mark" :class="{ 'storage-name-mark--file': !item.directory }"></span>
                    {{ item.name || item.path }}
                  </button>
                </td>
                <td>
                  <span class="status-pill" :class="rowTypeClass(item)">{{ typeLabel(item) }}</span>
                </td>
                <td>{{ item.directory ? '--' : formatBytes(item.size) }}</td>
                <td>{{ item.lastModifiedAt || '--' }}</td>
                <td>
                  <span class="status-pill" :class="lifecycleClass(item)">{{ lifecycleLabel(item) }}</span>
                </td>
                <td>{{ permissionLabel(item) }}</td>
                <td class="storage-actions-cell">
                  <div class="storage-row-actions" @click.stop>
                    <button type="button" class="ghost small storage-action-trigger" @click="toggleActionMenu(item)">操作</button>
                    <div v-if="activeActionPath === item.path" class="storage-action-popover">
                      <button v-if="!item.directory && !item.archiveOnly" type="button" @click="previewItem(item)">预览</button>
                      <button v-if="!item.directory && !item.archiveOnly" type="button" @click="downloadItem(item)">下载</button>
                      <button v-if="!item.directory && hasArchiveCopies(item)" type="button" @click="previewArchiveItem(item)">查看副本</button>
                      <button v-if="!item.directory && hasArchiveCopies(item)" type="button" @click="downloadArchiveItem(item)">下载副本</button>
                      <button
                        v-if="!item.archiveOnly"
                        type="button"
                        class="danger-inline"
                        :disabled="deleting || !item.permissions?.delete"
                        @click="deleteItem(item)"
                      >
                        删除
                      </button>
                      <span v-if="item.archiveOnly && !hasArchiveCopies(item)" class="storage-action-empty">无可用操作</span>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <footer class="storage-browser__footer">
        <div class="storage-browser__pagination-info">
          <span>本页 {{ items.length }} 条</span>
          <span>已扫描 {{ formatNumber(pagination.scannedCount) }} 条</span>
        </div>
        <div class="page-nav">
          <select class="input-field" :value="pagination.pageSize" @change="changePageSize">
            <option :value="50">50 条/页</option>
            <option :value="100">100 条/页</option>
            <option :value="200">200 条/页</option>
            <option :value="500">500 条/页</option>
          </select>
          <button type="button" class="ghost" :disabled="loading || pagination.page <= 1" @click="previousPage">上一页</button>
          <span class="page-jump">
            第 <input type="number" :value="pagination.page" min="1" @change="jumpToPage" /> 页
          </span>
          <button type="button" class="ghost" :disabled="loading || !pagination.hasMore" @click="nextPage">下一页</button>
        </div>
      </footer>
    </section>

    <div v-if="preview.open" class="storage-preview" @click.self="closePreview">
      <section class="storage-preview__dialog">
        <header>
          <div>
            <p class="eyebrow">Preview</p>
            <h2>{{ preview.name }}</h2>
          </div>
          <button type="button" class="ghost" @click="closePreview">关闭</button>
        </header>
        <div class="storage-preview__body">
          <img v-if="preview.kind === 'image'" :src="preview.url" :alt="preview.name" />
          <video v-else-if="preview.kind === 'video'" :src="preview.url" controls></video>
          <audio v-else-if="preview.kind === 'audio'" :src="preview.url" controls></audio>
          <iframe v-else :src="preview.url" :title="preview.name"></iframe>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.storage-center-page {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.storage-center-page .panel,
.storage-center-page button,
.storage-center-page input,
.storage-center-page select {
  border-radius: 8px;
}

.storage-overview,
.storage-browser__toolbar,
.storage-browser__footer,
.storage-filter,
.storage-row-actions,
.storage-overview__actions,
.storage-browser__buttons,
.path-line,
.storage-share-note {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.storage-overview,
.storage-browser__toolbar,
.storage-browser__footer,
.storage-share-note {
  justify-content: space-between;
}

.storage-overview__heading {
  min-width: min(100%, 26rem);
}

.storage-overview h1,
.storage-share-note h2 {
  margin: 0;
}

.storage-overview p,
.storage-share-note p,
.storage-metric p {
  margin: 0;
  color: var(--text-muted);
}

.storage-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.9rem;
}

.storage-metric {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 12px 24px rgba(22, 48, 43, 0.06);
}

.storage-metric span {
  display: block;
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.storage-metric strong {
  display: block;
  overflow-wrap: anywhere;
  margin: 0.35rem 0;
  font-size: 1.28rem;
}

.storage-metric--danger {
  border-color: rgba(155, 59, 42, 0.28);
}

.storage-metric--warning {
  border-color: rgba(208, 122, 76, 0.35);
}

.storage-metric--info {
  border-color: rgba(32, 101, 157, 0.22);
}

.storage-feedback {
  padding: 0.85rem 1rem;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: rgba(31, 96, 88, 0.08);
}

.storage-feedback--success {
  border-color: rgba(31, 96, 88, 0.25);
  background: rgba(31, 96, 88, 0.1);
}

.storage-feedback--warning {
  border-color: rgba(208, 122, 76, 0.3);
  background: rgba(208, 122, 76, 0.12);
}

.storage-feedback--danger {
  border-color: rgba(155, 59, 42, 0.25);
  background: rgba(155, 59, 42, 0.1);
}

.lifecycle-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 2rem;
  flex-wrap: wrap;
}

.lifecycle-panel__actions {
  display: flex;
  gap: 0.75rem;
}

.lifecycle-list {
  display: flex;
  flex-direction: column;
  margin-top: 1rem;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
}

.lifecycle-list__header {
  display: grid;
  grid-template-columns: 200px 1fr 180px 80px 100px 120px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--bg-soft);
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-soft);
}

.lifecycle-row {
  display: grid;
  grid-template-columns: 200px 1fr 180px 80px 100px 120px;
  gap: 1rem;
  align-items: center;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-soft);
  transition: background 0.2s;
}

.lifecycle-row:last-child {
  border-bottom: 0;
}

.lifecycle-row:hover {
  background: rgba(31, 96, 88, 0.02);
}

.lifecycle-row__name {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.lifecycle-row__name strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lifecycle-row__name small {
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lifecycle-row__path {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--accent);
  word-break: break-all;
}

.lifecycle-row__types {
  position: relative;
  min-width: 0;
}

.lifecycle-type-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.4rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.lifecycle-type-trigger:hover {
  background: rgba(31, 96, 88, 0.08);
}

.lifecycle-type-trigger .icon-arrow-down {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--text-muted);
  opacity: 0.7;
}

.lifecycle-target-popover {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 320px;
  padding: 1rem;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 12px 32px rgba(17, 43, 39, 0.18);
}

.lifecycle-popover-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.lifecycle-popover-label {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.lifecycle-popover-item strong {
  font-size: 0.88rem;
  color: var(--text-primary);
}

.lifecycle-popover-value {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--text-primary);
  word-break: break-all;
}

.lifecycle-row__priority {
  font-weight: 700;
  color: var(--text-muted);
}

.lifecycle-row__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.lifecycle-dialog {
  max-width: 700px;
  height: auto;
  max-height: 90vh;
}

.lifecycle-dialog-form {
  padding: 1.5rem;
}

.lifecycle-dialog-form__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.lifecycle-dialog-form__wide {
  grid-column: 1 / -1;
}

.lifecycle-targets-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-soft);
  border-radius: 8px;
}

.lifecycle-target-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.lifecycle-target-label {
  width: 80px;
  flex-shrink: 0;
  color: var(--text-primary);
  font-size: 0.88rem;
  font-weight: 600;
  text-align: right;
}

.lifecycle-target-row .type-select {
  width: 140px;
}

.lifecycle-target-row .target-select {
  flex: 1;
  min-width: 120px;
}

.lifecycle-target-add {
  padding-left: 80px;
}

.lifecycle-dialog-form label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.lifecycle-dialog-form textarea {
  resize: vertical;
}

.lifecycle-dialog-form select[multiple] {
  min-height: 6rem;
}

.lifecycle-checks-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lifecycle-checks {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.lifecycle-checks label {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-primary);
  font-weight: 600;
}

.lifecycle-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-soft);
}

.lifecycle-dialog-footer button {
  min-width: 6rem;
}

.text-right {
  text-align: right;
}

@media (max-width: 1000px) {
  .lifecycle-list__header,
  .lifecycle-row {
    grid-template-columns: 150px 1fr 100px 80px 100px;
  }
  .lifecycle-row__types {
    display: none;
  }
}

@media (max-width: 760px) {
  .lifecycle-list__header {
    display: none;
  }
  .lifecycle-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  .lifecycle-row__actions {
    justify-content: flex-start;
  }
  .lifecycle-dialog-form__grid {
    grid-template-columns: 1fr;
  }
}



.storage-browser {
  display: grid;
  gap: 1rem;
}

.path-line {
  min-width: 0;
  max-width: 100%;
  color: var(--text-muted);
}

.storage-browser__buttons {
  justify-content: flex-end;
}

.storage-filter {
  align-items: stretch;
}

.storage-filter input {
  max-width: 28rem;
}

.storage-upload-progress {
  margin-top: 0;
}

.storage-table-wrap {
  max-height: calc(100vh - 430px);
  min-height: 260px;
  overflow: auto;
}

.storage-table {
  min-width: 1060px;
}

.storage-table__check {
  width: 3.2rem;
}

.storage-table input[type='checkbox'] {
  width: 1rem;
  height: 1rem;
}

.storage-name-button {
  max-width: 24rem;
  min-height: 2rem;
  justify-content: flex-start;
  overflow-wrap: anywhere;
  text-align: left;
}

.storage-name-mark {
  width: 0.72rem;
  height: 0.72rem;
  flex: 0 0 auto;
  border-radius: 3px;
  background: #1f5e91;
}

.storage-name-mark--file {
  border-radius: 50%;
  background: #1f6058;
}

.storage-row-actions {
  position: relative;
  display: inline-flex;
  flex-wrap: nowrap;
}

.storage-row-actions .small {
  padding: 0.42rem 0.66rem;
  white-space: nowrap;
}

.storage-actions-cell {
  width: 7.2rem;
}

.storage-action-trigger {
  min-width: 4.6rem;
}

.storage-action-popover {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 20;
  display: grid;
  min-width: 9rem;
  overflow: hidden;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 16px 36px rgba(17, 43, 39, 0.16);
}

.storage-action-popover button,
.storage-action-empty {
  width: 100%;
  min-height: 2.3rem;
  padding: 0.55rem 0.78rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  text-align: left;
  white-space: nowrap;
}

.storage-action-popover button:hover:not(:disabled) {
  background: rgba(31, 96, 88, 0.08);
}

.storage-action-popover button:disabled {
  color: var(--text-muted);
  cursor: not-allowed;
}

.storage-action-popover .danger-inline {
  color: var(--accent-danger);
}

.storage-action-empty {
  color: var(--text-muted);
}

.danger-inline {
  color: var(--accent-danger);
}

.storage-browser__footer {
  color: var(--text-muted);
}

.storage-browser__pagination-info {
  display: flex;
  gap: 1rem;
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.page-nav select {
  width: auto;
  padding: 0.2rem 0.5rem;
  height: 2.2rem;
}

.page-jump {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.page-jump input {
  width: 4rem;
  text-align: center;
  padding: 0.2rem;
  height: 2.2rem;
}

.storage-browser__footer > div:first-child {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.storage-share-note code {
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  background: rgba(22, 59, 54, 0.06);
  border: 1px solid var(--border-soft);
}

.storage-preview {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(8, 18, 16, 0.62);
}

.storage-preview__dialog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(1100px, 96vw);
  height: min(780px, 92vh);
  overflow: hidden;
  border-radius: 8px;
  background: #f8fbfa;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.26);
}

.storage-preview__dialog header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border-soft);
}

.storage-preview__dialog h2 {
  margin: 0;
  overflow-wrap: anywhere;
}

.storage-preview__body {
  min-height: 0;
  background: #ffffff;
  overflow-y: auto;
}

.storage-preview__body img,
.storage-preview__body video,
.storage-preview__body iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.storage-preview__body img,
.storage-preview__body video {
  object-fit: contain;
}

.storage-preview__body audio {
  width: calc(100% - 2rem);
  margin: 2rem 1rem;
}

@media (max-width: 760px) {
  .storage-overview,
  .storage-browser__toolbar,
  .storage-browser__footer,
  .storage-share-note,
  .lifecycle-panel__header {
    align-items: stretch;
    flex-direction: column;
  }

  .lifecycle-grid,
  .lifecycle-form,
  .lifecycle-rule {
    grid-template-columns: 1fr;
  }

  .storage-overview__actions,
  .storage-browser__buttons,
  .storage-filter,
  .page-nav {
    width: 100%;
  }

  .storage-overview__actions button,
  .storage-browser__buttons button,
  .storage-filter button,
  .page-nav button {
    flex: 1 1 9rem;
  }

  .storage-filter input {
    max-width: none;
  }

  .storage-preview {
    padding: 0.8rem;
  }
}
</style>
