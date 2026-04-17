<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cameraApi } from '../api/cameras'
import { storageTargetApi } from '../api/storage-targets'
import { videoPlatformApi } from '../api/video-platforms'
import CameraDialog from '../components/CameraDialog.vue'
import PlatformDialog from '../components/PlatformDialog.vue'
import StorageTargetDialog from '../components/StorageTargetDialog.vue'

const route = useRoute()
const router = useRouter()

const activeTab = ref(resolveTabFromRoute(route.path))
const feedback = ref(null)
const pendingAction = ref('')

const PLATFORM_TYPE_LABELS = {
  HK: '海康平台',
  YS: '宇视平台',
  YC: '云存储平台',
  YG: '运管平台',
  KD: '科达平台',
}

const STORAGE_TYPE_LABELS = {
  object: '对象存储设备',
  nas: 'NAS 存储设备',
  'disc-group': '光盘匣组设备',
}

const STORAGE_TYPE_DESCRIPTIONS = {
  object: '通过兼容 S3 的对象存储接口接收采集文件。',
  nas: '通过 NAS 目录或本地挂载目录接收采集文件。',
  'disc-group': '将未分组光盘匣编组为可用的光盘匣组设备。',
}

const platformLoading = ref(false)
const cameraLoading = ref(false)
const storageLoading = ref(false)

const platformOptions = reactive({
  types: [],
})

const cameraOptions = reactive({
  platforms: [],
})

const storageOptions = reactive({
  discGroupRaidLevels: [],
  groups: [],
  types: [],
})

const platformFilters = reactive({
  keyword: '',
  status: '',
  type: '',
})

const cameraFilters = reactive({
  ip: '',
  name: '',
  platformId: '',
  platformTitle: '',
  roomName: '',
})

const storageFilters = reactive({
  keyword: '',
  serverIp: '',
})

const platformPagination = reactive({
  page: 1,
  pageSize: 12,
  total: 0,
})

const cameraPagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const platforms = ref([])
const cameras = ref([])
const storageSections = ref([])
const storageTypePickerOpen = ref(false)

const platformDialog = reactive({
  errorMessage: '',
  mode: 'create',
  open: false,
  submitting: false,
})

const cameraDialog = reactive({
  errorMessage: '',
  open: false,
  submitting: false,
})

const storageDialog = reactive({
  errorMessage: '',
  mode: 'create',
  open: false,
  submitting: false,
})

const editingPlatformId = ref(null)
const editingCameraId = ref(null)
const editingStorageTarget = ref(null)

const platformTotalPages = computed(() =>
  Math.max(1, Math.ceil(platformPagination.total / platformPagination.pageSize)),
)

const cameraTotalPages = computed(() =>
  Math.max(1, Math.ceil(cameraPagination.total / cameraPagination.pageSize)),
)

const storageItemCount = computed(() =>
  storageSections.value.reduce((sum, section) => sum + Number(section.total || 0), 0),
)

const storageDevices = computed(() =>
  storageSections.value.reduce((items, section) => {
    const nextItems = (section.items || []).map((item) => ({
      ...item,
      sectionTitle: section.title,
    }))
    return items.concat(nextItems)
  }, []),
)

const totalResources = computed(
  () => Number(platformPagination.total) + Number(cameraPagination.total) + Number(storageItemCount.value),
)

const writableStorageTypes = computed(() =>
  storageOptions.types.filter((item) => item.writable),
)

const tabItems = computed(() => [
  {
    count: platformPagination.total,
    label: '视频平台',
    value: 'platforms',
  },
  {
    count: cameraPagination.total,
    label: '摄像头',
    value: 'cameras',
  },
  {
    count: storageItemCount.value,
    label: '存储设备',
    value: 'storage',
  },
])

const platformDialogValue = ref(buildEmptyPlatformValue())
const cameraDialogValue = ref(buildEmptyCameraValue())
const storageDialogValue = ref(buildEmptyStorageValue())

onMounted(() => {
  bootstrap()
})

watch(
  () => route.path,
  (path) => {
    activeTab.value = resolveTabFromRoute(path)
  },
)

async function bootstrap() {
  await Promise.all([
    loadPlatformOptions(true),
    loadCameraOptions(true),
    loadStorageOptions(true),
  ])

  await Promise.all([
    loadPlatforms(1, true),
    loadCameras(1, true),
    loadStorageTargets(true),
  ])
}

function buildEmptyPlatformValue() {
  return {
    cloudAk: '',
    cloudIp: '',
    cloudPort: '',
    cloudSk: '',
    password: '',
    playPort: '',
    port: '',
    serverIp: '',
    status: 1,
    title: '',
    type: platformOptions.types[0]?.value || 'HK',
    username: '',
  }
}

function resolveTabFromRoute(path) {
  if (path === '/cameras') {
    return 'cameras'
  }

  if (path === '/storage-targets') {
    return 'storage'
  }

  return 'platforms'
}

function routeNameForTab(tab) {
  if (tab === 'cameras') {
    return 'cameras'
  }

  if (tab === 'storage') {
    return 'storage-targets'
  }

  return 'accounts'
}

async function navigateToTab(tab) {
  const routeName = routeNameForTab(tab)
  if (route.name !== routeName) {
    await router.push({ name: routeName })
  }
  activeTab.value = tab
}

function buildEmptyCameraValue() {
  return {
    roomName: '',
    title: '',
  }
}

function buildEmptyStorageValue(type = writableStorageTypes.value[0]?.value || 'object') {
  return {
    accessKey: '',
    autoAppend: false,
    availableCandidates: [],
    maxSize: '0',
    members: [],
    path: '',
    raidLevel: storageOptions.discGroupRaidLevels[0]?.value ?? 5,
    remark: '',
    secretKey: '',
    serverIp: '',
    startSize: '0',
    status: 1,
    title: '',
    type,
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

function buildActionKey(scope, itemId, action) {
  return `${scope}:${itemId}:${action}`
}

function isBusy(scope, itemId, action) {
  return pendingAction.value === buildActionKey(scope, itemId, action)
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  return value
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

function formatCount(value) {
  return Number(value || 0).toLocaleString()
}

function formatPlatformTypeLabel(type, fallback = '') {
  const normalized = normalizeCode(type)
  if (PLATFORM_TYPE_LABELS[normalized]) {
    return PLATFORM_TYPE_LABELS[normalized]
  }

  const fallbackNormalized = normalizeCode(fallback)
  if (PLATFORM_TYPE_LABELS[fallbackNormalized]) {
    return PLATFORM_TYPE_LABELS[fallbackNormalized]
  }

  return translateBackendMessage(fallback || type || '--')
}

function formatStorageTypeLabel(type, fallback = '') {
  const normalized = normalizeLabel(type)
  if (STORAGE_TYPE_LABELS[normalized]) {
    return STORAGE_TYPE_LABELS[normalized]
  }

  const fallbackNormalized = normalizeLabel(fallback)
  if (STORAGE_TYPE_LABELS[fallbackNormalized]) {
    return STORAGE_TYPE_LABELS[fallbackNormalized]
  }

  return translateBackendMessage(fallback || type || '--')
}

function formatStorageTypeDescription(type) {
  return STORAGE_TYPE_DESCRIPTIONS[normalizeLabel(type)] || '统一管理采集侧使用的存储设备。'
}

function formatCameraStatus(value) {
  const normalized = normalizeLabel(value)
  if (normalized === '1') {
    return '启用'
  }
  if (normalized === '0') {
    return '停用'
  }
  if (normalized === 'enabled') {
    return '启用'
  }
  if (normalized === 'disabled') {
    return '停用'
  }
  if (normalized === 'online') {
    return '在线'
  }
  if (normalized === 'offline') {
    return '离线'
  }

  return translateBackendMessage(formatValue(value))
}

function formatMessageValue(value) {
  const text = formatValue(value)
  return text === '--' ? text : translateBackendMessage(text)
}

function translateBackendMessage(message) {
  if (message === null || message === undefined || message === '') {
    return ''
  }

  const text = String(message).trim()

  if (text === 'The platform endpoint is reachable.') {
    return '平台接口连通正常。'
  }
  if (text.startsWith('The platform endpoint is not reachable:')) {
    return `平台接口不可达：${text.slice('The platform endpoint is not reachable:'.length).trim()}`
  }
  if (text === 'Camera sync completed.') {
    return '摄像头同步完成。'
  }
  if (text === 'Platform login succeeded but no cameras were returned.') {
    return '平台登录成功，但未返回摄像头数据。'
  }
  if (text === 'Platform login failed.') {
    return '平台登录失败。'
  }
  if (text.startsWith('The platform sync command could not be started:')) {
    return `摄像头同步命令启动失败：${text.slice('The platform sync command could not be started:'.length).trim()}`
  }
  if (text === 'Object storage is reachable and the bucket exists.') {
    return '对象存储连通正常，桶存在。'
  }
  if (text === 'Object storage is reachable, but the configured bucket does not exist.') {
    return '对象存储连通正常，但配置的桶不存在。'
  }
  if (text.startsWith('Object storage test failed:')) {
    return `对象存储测试失败：${text.slice('Object storage test failed:'.length).trim()}`
  }
  if (text === 'The NAS path is accessible.') {
    return 'NAS 路径可访问。'
  }
  if (text === 'The NAS path is not accessible from the current service process.') {
    return '当前服务进程无法访问 NAS 路径。'
  }
  if (text === 'Object Storage') {
    return '对象存储'
  }
  if (text === 'Disc Group') {
    return '光盘组'
  }
  if (text === 'NAS') {
    return 'NAS 存储'
  }
  if (text === 'Hikvision') {
    return '海康平台'
  }
  if (text === 'Cloud Storage') {
    return '云存储平台'
  }
  if (text === 'Operations Platform') {
    return '运管平台'
  }
  if (text === 'Keda') {
    return '科达平台'
  }

  return text
}

function normalizeLabel(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function storageUsedPercent(item) {
  const maxSize = Number(item.maxSize || 0)
  const currentSize = Number(item.currentSize || 0)

  if (maxSize <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, (currentSize / maxSize) * 100))
}

function syncCameraPlatformFilter() {
  if (!cameraFilters.platformId) {
    return
  }

  const exists = cameraOptions.platforms.some((item) => String(item.id) === String(cameraFilters.platformId))
  if (!exists) {
    cameraFilters.platformId = ''
  }
}

async function loadPlatformOptions(silent = false) {
  try {
    const data = await videoPlatformApi.options()
    platformOptions.types = data.types || []
  } catch (error) {
    if (!silent) {
      setFeedback(error.message, 'danger')
    }
  }
}

async function loadCameraOptions(silent = false) {
  try {
    const data = await cameraApi.options()
    cameraOptions.platforms = data.platforms || []
    syncCameraPlatformFilter()
  } catch (error) {
    if (!silent) {
      setFeedback(error.message, 'danger')
    }
  }
}

async function loadStorageOptions(silent = false) {
  try {
    const data = await storageTargetApi.options()
    storageOptions.discGroupRaidLevels = data.discGroupRaidLevels || []
    storageOptions.groups = data.groups || []
    storageOptions.types = data.types || []
  } catch (error) {
    if (!silent) {
      setFeedback(error.message, 'danger')
    }
  }
}

function buildPlatformParams(page = platformPagination.page) {
  return {
    keyword: platformFilters.keyword,
    page,
    pageSize: platformPagination.pageSize,
    status: platformFilters.status === '' ? undefined : Number(platformFilters.status),
    type: platformFilters.type,
  }
}

function buildCameraParams(page = cameraPagination.page) {
  return {
    ip: cameraFilters.ip,
    name: cameraFilters.name,
    page,
    pageSize: cameraPagination.pageSize,
    platformId: cameraFilters.platformId === '' ? undefined : Number(cameraFilters.platformId),
    platformTitle: cameraFilters.platformTitle,
    roomName: cameraFilters.roomName,
  }
}

async function loadPlatforms(page = 1, silent = false) {
  platformLoading.value = true

  try {
    const data = await videoPlatformApi.list(buildPlatformParams(page))
    platforms.value = data.items || []
    platformPagination.page = data.page || page
    platformPagination.pageSize = data.pageSize || platformPagination.pageSize
    platformPagination.total = data.total || 0

    if (!platforms.value.length && !silent) {
      setFeedback('当前筛选条件下没有匹配的视频平台。', 'warning')
    } else if (feedback.value?.tone === 'warning' && activeTab.value === 'platforms') {
      setFeedback('')
    }
  } catch (error) {
    if (!silent) {
      setFeedback(error.message, 'danger')
    }
  } finally {
    platformLoading.value = false
  }
}

async function loadCameras(page = 1, silent = false) {
  cameraLoading.value = true

  try {
    const data = await cameraApi.list(buildCameraParams(page))
    cameras.value = data.items || []
    cameraPagination.page = data.page || page
    cameraPagination.pageSize = data.pageSize || cameraPagination.pageSize
    cameraPagination.total = data.total || 0

    if (!cameras.value.length && !silent) {
      setFeedback('当前筛选条件下没有匹配的摄像头。', 'warning')
    } else if (feedback.value?.tone === 'warning' && activeTab.value === 'cameras') {
      setFeedback('')
    }
  } catch (error) {
    if (!silent) {
      setFeedback(error.message, 'danger')
    }
  } finally {
    cameraLoading.value = false
  }
}

async function loadStorageTargets(silent = false) {
  storageLoading.value = true

  try {
    storageSections.value = await storageTargetApi.overview({
      keyword: storageFilters.keyword,
      serverIp: storageFilters.serverIp,
    })

    if (!storageItemCount.value && !silent) {
      setFeedback('当前筛选条件下没有匹配的存储设备。', 'warning')
    } else if (feedback.value?.tone === 'warning' && activeTab.value === 'storage') {
      setFeedback('')
    }
  } catch (error) {
    if (!silent) {
      setFeedback(error.message, 'danger')
    }
  } finally {
    storageLoading.value = false
  }
}

async function submitPlatformSearch() {
  platformPagination.page = 1
  await loadPlatforms(1)
}

async function changePlatformPageSize(event) {
  const newSize = Number(event.target.value)
  if (newSize !== platformPagination.pageSize) {
    platformPagination.pageSize = newSize
    platformPagination.page = 1
    await loadPlatforms(1, true)
  }
}

async function resetPlatformSearch() {
  platformFilters.keyword = ''
  platformFilters.status = ''
  platformFilters.type = ''
  platformPagination.page = 1
  await loadPlatforms(1)
}

async function previousPlatformPage() {
  if (platformPagination.page > 1) {
    await loadPlatforms(platformPagination.page - 1)
  }
}

async function nextPlatformPage() {
  if (platformPagination.page < platformTotalPages.value) {
    await loadPlatforms(platformPagination.page + 1)
  }
}

function openCreatePlatformDialog() {
  editingPlatformId.value = null
  platformDialog.errorMessage = ''
  platformDialog.mode = 'create'
  platformDialogValue.value = buildEmptyPlatformValue()
  platformDialog.open = true
}

async function openEditPlatformDialog(item) {
  platformDialog.errorMessage = ''
  platformDialog.mode = 'edit'

  try {
    const platform = await videoPlatformApi.get(item.id)
    editingPlatformId.value = item.id
    platformDialogValue.value = { ...platform }
    platformDialog.open = true
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

function closePlatformDialog() {
  platformDialog.open = false
  platformDialog.errorMessage = ''
}

async function submitPlatformDialog(payload) {
  platformDialog.submitting = true
  platformDialog.errorMessage = ''

  try {
    if (platformDialog.mode === 'edit' && editingPlatformId.value) {
      await videoPlatformApi.update(editingPlatformId.value, payload)
      setFeedback('视频平台已更新。', 'success')
    } else {
      await videoPlatformApi.create(payload)
      setFeedback('视频平台已新增。', 'success')
    }

    platformDialog.open = false
    await Promise.all([
      loadPlatformOptions(true),
      loadCameraOptions(true),
      loadPlatforms(1, true),
      loadCameras(cameraPagination.page, true),
    ])
  } catch (error) {
    platformDialog.errorMessage = error.message
  } finally {
    platformDialog.submitting = false
  }
}

async function togglePlatformStatus(item) {
  pendingAction.value = buildActionKey('platform', item.id, 'toggle')

  try {
    const result = await videoPlatformApi.toggleStatus(item.id)
    item.status = result.status
    item.enabled = result.enabled
    setFeedback(`视频平台“${item.title}”状态已更新。`, 'success')
    await Promise.all([loadPlatformOptions(true), loadCameraOptions(true)])
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function testPlatform(item) {
  pendingAction.value = buildActionKey('platform', item.id, 'test')

  try {
    const result = await videoPlatformApi.test(item.id)
    setFeedback(translateBackendMessage(result.message), result.reachable ? 'success' : 'warning')
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function syncPlatformCameras(item) {
  pendingAction.value = buildActionKey('platform', item.id, 'sync')

  try {
    const result = await videoPlatformApi.syncCameras(item.id)
    setFeedback(
      `${translateBackendMessage(result.message)} 有效摄像头 ${result.activeCount} 个，返回总数 ${result.totalCount} 个。`,
      'success',
    )
    await loadCameras(cameraPagination.page, true)
    await loadPlatforms(platformPagination.page, true)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function deletePlatform(item) {
  if (!window.confirm(`确认删除视频平台“${item.title}”？`)) {
    return
  }

  pendingAction.value = buildActionKey('platform', item.id, 'delete')

  try {
    await videoPlatformApi.remove(item.id)
    setFeedback(`视频平台“${item.title}”已删除。`, 'success')

    if (String(cameraFilters.platformId) === String(item.id)) {
      cameraFilters.platformId = ''
    }

    await Promise.all([
      loadPlatformOptions(true),
      loadCameraOptions(true),
      loadPlatforms(1, true),
      loadCameras(1, true),
    ])
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function focusPlatformCameras(item) {
  cameraFilters.platformId = String(item.id)
  cameraFilters.platformTitle = ''
  cameraPagination.page = 1
  await navigateToTab('cameras')
  await loadCameras(1)
}

async function submitCameraSearch() {
  cameraPagination.page = 1
  await loadCameras(1)
}

async function changeCameraPageSize(event) {
  const newSize = Number(event.target.value)
  if (newSize !== cameraPagination.pageSize) {
    cameraPagination.pageSize = newSize
    cameraPagination.page = 1
    await loadCameras(1, true)
  }
}

async function resetCameraSearch() {
  cameraFilters.ip = ''
  cameraFilters.name = ''
  cameraFilters.platformId = ''
  cameraFilters.platformTitle = ''
  cameraFilters.roomName = ''
  cameraPagination.page = 1
  await loadCameras(1)
}

async function previousCameraPage() {
  if (cameraPagination.page > 1) {
    await loadCameras(cameraPagination.page - 1)
  }
}

async function nextCameraPage() {
  if (cameraPagination.page < cameraTotalPages.value) {
    await loadCameras(cameraPagination.page + 1)
  }
}

async function openEditCameraDialog(item) {
  cameraDialog.errorMessage = ''

  try {
    const camera = await cameraApi.get(item.id)
    editingCameraId.value = item.id
    cameraDialogValue.value = { ...camera }
    cameraDialog.open = true
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

function closeCameraDialog() {
  cameraDialog.open = false
  cameraDialog.errorMessage = ''
}

async function submitCameraDialog(payload) {
  if (!editingCameraId.value) {
    return
  }

  cameraDialog.submitting = true
  cameraDialog.errorMessage = ''

  try {
    await cameraApi.update(editingCameraId.value, payload)
    cameraDialog.open = false
    setFeedback('摄像头已更新。', 'success')
    await loadCameras(cameraPagination.page, true)
  } catch (error) {
    cameraDialog.errorMessage = error.message
  } finally {
    cameraDialog.submitting = false
  }
}

async function submitStorageSearch() {
  await loadStorageTargets()
}

async function resetStorageSearch() {
  storageFilters.keyword = ''
  storageFilters.serverIp = ''
  await loadStorageTargets()
}

async function openCreateStorageDialog(type) {
  storageTypePickerOpen.value = false
  editingStorageTarget.value = null
  storageDialog.errorMessage = ''
  storageDialog.mode = 'create'

  try {
    const nextValue = buildEmptyStorageValue(type)
    if (type === 'disc-group') {
      nextValue.availableCandidates = await storageTargetApi.discGroupCandidates()
    }
    storageDialogValue.value = nextValue
    storageDialog.open = true
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

async function openEditStorageDialog(item) {
  storageTypePickerOpen.value = false
  storageDialog.errorMessage = ''
  storageDialog.mode = 'edit'

  try {
    const [target, availableCandidates] = item.type === 'disc-group'
      ? await Promise.all([
          storageTargetApi.get(item.type, item.id),
          storageTargetApi.discGroupCandidates(),
        ])
      : [await storageTargetApi.get(item.type, item.id), []]
    editingStorageTarget.value = {
      id: item.id,
      type: item.type,
    }
    storageDialogValue.value = {
      ...buildEmptyStorageValue(item.type),
      ...target,
      availableCandidates,
      maxSize: String(target.maxSize ?? 0),
      startSize: String(target.startSize ?? 0),
    }
    storageDialog.open = true
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

function closeStorageDialog() {
  storageDialog.open = false
  storageDialog.errorMessage = ''
}

function openStorageTypePicker() {
  storageTypePickerOpen.value = true
}

function closeStorageTypePicker() {
  storageTypePickerOpen.value = false
}

async function submitStorageDialog(payload) {
  storageDialog.submitting = true
  storageDialog.errorMessage = ''

  try {
    if (storageDialog.mode === 'edit' && editingStorageTarget.value) {
      await storageTargetApi.update(editingStorageTarget.value.type, editingStorageTarget.value.id, payload)
      setFeedback('存储设备已更新。', 'success')
    } else {
      await storageTargetApi.create(payload)
      setFeedback('存储设备已新增。', 'success')
    }

    storageDialog.open = false
    await Promise.all([
      loadStorageOptions(true),
      loadStorageTargets(true),
    ])
  } catch (error) {
    storageDialog.errorMessage = error.message
  } finally {
    storageDialog.submitting = false
  }
}

async function toggleStorageStatus(item) {
  pendingAction.value = buildActionKey(item.type, item.id, 'toggle')

  try {
    const result = await storageTargetApi.toggleStatus(item.type, item.id)
    item.status = result.status
    item.enabled = result.enabled
    setFeedback(`存储设备“${item.title}”状态已更新。`, 'success')
    await loadStorageOptions(true)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function testStorageTarget(item) {
  pendingAction.value = buildActionKey(item.type, item.id, 'test')

  try {
    const result = await storageTargetApi.test(item.type, item.id)
    setFeedback(translateBackendMessage(result.message), result.reachable ? 'success' : 'warning')
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}

async function deleteStorageTarget(item) {
  if (!window.confirm(`确认删除存储设备“${item.title}”？`)) {
    return
  }

  pendingAction.value = buildActionKey(item.type, item.id, 'delete')

  try {
    await storageTargetApi.remove(item.type, item.id)
    setFeedback(`存储设备“${item.title}”已删除。`, 'success')
    await Promise.all([
      loadStorageOptions(true),
      loadStorageTargets(true),
    ])
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    pendingAction.value = ''
  }
}
</script>

<template>
  <section class="content-grid">
    <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`" style="margin-bottom: 1.5rem;">
      {{ feedback.message }}
    </div>

    <template v-if="activeTab === 'platforms'">
      <article class="panel">
        <div class="panel__toolbar panel__toolbar--stack">
          <div>
            <p class="eyebrow">查询条件</p>
            <h2>视频平台管理</h2>
            <p class="subtle-text" style="margin-top: 0.5rem; display: flex; gap: 1.5rem;">
              <span>资源总数：<strong style="color: var(--text);">{{ formatCount(totalResources) }}</strong></span>
            </p>
            <div class="tab-strip" style="margin-top: 1rem;">
              <button
                v-for="item in tabItems"
                :key="item.value"
                type="button"
                class="tab-chip"
                :class="{ 'tab-chip--active': activeTab === item.value }"
                @click="navigateToTab(item.value)"
              >
                <span>{{ item.label }}</span>
                <strong>{{ formatCount(item.count) }}</strong>
              </button>
            </div>
          </div>

          <div class="inline-actions">
            <button type="button" @click="openCreatePlatformDialog">新增平台</button>
          </div>
        </div>

        <form class="toolbar-grid toolbar-grid--wide" @submit.prevent="submitPlatformSearch">
          <label class="field">
            <span class="field__label">关键字</span>
            <input v-model.trim="platformFilters.keyword" type="text" placeholder="平台名称、IP 或用户名" />
          </label>

          <label class="field">
            <span class="field__label">平台类型</span>
            <select v-model="platformFilters.type" class="select-field">
              <option value="">全部类型</option>
              <option v-for="item in platformOptions.types" :key="item.value" :value="item.value">
                {{ formatPlatformTypeLabel(item.value, item.label) }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">状态</span>
            <select v-model="platformFilters.status" class="select-field">
              <option value="">全部状态</option>
              <option value="1">启用</option>
              <option value="0">停用</option>
            </select>
          </label>

          <div class="inline-actions">
            <button type="submit" :disabled="platformLoading">查询</button>
            <button type="button" class="ghost" :disabled="platformLoading" @click="resetPlatformSearch">
              重置
            </button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="panel__toolbar">
          <div>
            <p class="eyebrow">平台列表</p>
            <h2>共 {{ formatCount(platformPagination.total) }} 个视频平台</h2>
          </div>
        </div>

        <div class="account-table-wrap">
          <table class="account-table resource-table">
            <thead>
              <tr>
                <th>平台</th>
                <th>接入地址</th>
                <th>端口</th>
                <th>账号信息</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>最后登录</th>
                <th>最后同步信息</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="platformLoading">
                <td colspan="9" class="empty-cell">视频平台加载中...</td>
              </tr>
              <tr v-else-if="!platforms.length">
                <td colspan="9" class="empty-cell">未找到视频平台。</td>
              </tr>
              <tr v-for="item in platforms" :key="item.id">
                <td>
                  <strong>{{ item.title }}</strong>
                  <div class="subtle-text">{{ formatPlatformTypeLabel(item.type, item.typeLabel) }}</div>
                </td>
                <td>{{ item.serverIp }}</td>
                <td>
                  <div>登录：{{ formatValue(item.port) }}</div>
                  <div class="subtle-text">预览：{{ formatValue(item.playPort) }}</div>
                </td>
                <td>{{ item.username }}</td>
                <td>
                  <span class="status-pill" :class="formatStatusClass(item.status)">
                    {{ formatStatusLabel(item.status) }}
                  </span>
                </td>
                <td>{{ formatValue(item.createdAt) }}</td>
                <td>{{ formatValue(item.loginAt) }}</td>
                <td>{{ formatMessageValue(item.lastInfo) }}</td>
                <td>
                  <div class="action-group">
                    <button type="button" class="ghost" @click="focusPlatformCameras(item)">查看摄像头</button>
                    <button type="button" class="ghost" @click="openEditPlatformDialog(item)">编辑</button>
                    <button
                      type="button"
                      class="ghost"
                      :disabled="isBusy('platform', item.id, 'toggle')"
                      @click="togglePlatformStatus(item)"
                    >
                      {{
                        isBusy('platform', item.id, 'toggle')
                          ? '处理中...'
                          : Number(item.status) === 1
                            ? '停用'
                            : '启用'
                      }}
                    </button>
                    <button
                      type="button"
                      class="ghost"
                      :disabled="isBusy('platform', item.id, 'test')"
                      @click="testPlatform(item)"
                    >
                      {{ isBusy('platform', item.id, 'test') ? '测试中...' : '测试' }}
                    </button>
                    <button
                      type="button"
                      class="ghost"
                      :disabled="isBusy('platform', item.id, 'sync')"
                      @click="syncPlatformCameras(item)"
                    >
                      {{ isBusy('platform', item.id, 'sync') ? '同步中...' : '同步摄像头' }}
                    </button>
                    <button
                      type="button"
                      class="danger"
                      :disabled="isBusy('platform', item.id, 'delete')"
                      @click="deletePlatform(item)"
                    >
                      {{ isBusy('platform', item.id, 'delete') ? '删除中...' : '删除' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="panel__footer" style="display: flex; justify-content: flex-end; margin-top: 1rem;">
          <div class="page-nav">
            <select
              class="input-field"
              style="width: 8rem; padding: 0.1rem;"
              :value="platformPagination.pageSize"
              @change="changePlatformPageSize"
            >
              <option :value="10">10 条/页</option>
              <option :value="20">20 条/页</option>
              <option :value="50">50 条/页</option>
              <option :value="100">100 条/页</option>
            </select>

            <button type="button" class="ghost" :disabled="platformLoading || platformPagination.page <= 1" @click="previousPlatformPage">
              上一页
            </button>
            <span>第 {{ platformPagination.page }} 页 / {{ platformTotalPages }}</span>
            <button
              type="button"
              class="ghost"
              :disabled="platformLoading || platformPagination.page >= platformTotalPages"
              @click="nextPlatformPage"
            >
              下一页
            </button>
          </div>
        </div>
      </article>
    </template>

    <template v-else-if="activeTab === 'cameras'">
      <article class="panel">
        <div class="panel__toolbar panel__toolbar--stack">
          <div>
            <p class="eyebrow">查询条件</p>
            <h2>摄像头管理</h2>
            <p class="subtle-text" style="margin-top: 0.5rem; display: flex; gap: 1.5rem;">
              <span>资源总数：<strong style="color: var(--text);">{{ formatCount(totalResources) }}</strong></span>
            </p>
            <div class="tab-strip" style="margin-top: 1rem;">
              <button
                v-for="item in tabItems"
                :key="item.value"
                type="button"
                class="tab-chip"
                :class="{ 'tab-chip--active': activeTab === item.value }"
                @click="navigateToTab(item.value)"
              >
                <span>{{ item.label }}</span>
                <strong>{{ formatCount(item.count) }}</strong>
              </button>
            </div>
          </div>

          <div class="inline-actions">
            <span v-if="cameraFilters.platformId" class="pill">已按平台筛选</span>
            <button v-if="cameraFilters.platformId" type="button" class="ghost" @click="resetCameraSearch">清除筛选</button>
            <button type="button" @click="openCreateCameraDialog">新增摄像头</button>
            <button type="button" class="ghost" :disabled="syncingCameras" @click="syncCameras">
              {{ syncingCameras ? '同步中...' : '同步摄像头' }}
            </button>
          </div>
        </div>

        <form class="toolbar-grid toolbar-grid--wide" @submit.prevent="submitCameraSearch">
          <label class="field">
            <span class="field__label">视频平台</span>
            <select v-model="cameraFilters.platformId" class="select-field">
              <option value="">全部平台</option>
              <option v-for="item in cameraOptions.platforms" :key="item.id" :value="String(item.id)">
                {{ item.title }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">平台名称</span>
            <input v-model.trim="cameraFilters.platformTitle" type="text" placeholder="请输入平台名称" />
          </label>

          <label class="field">
            <span class="field__label">摄像头名称</span>
            <input v-model.trim="cameraFilters.name" type="text" placeholder="请输入摄像头名称" />
          </label>

          <label class="field">
            <span class="field__label">IP</span>
            <input v-model.trim="cameraFilters.ip" type="text" placeholder="请输入摄像头 IP" />
          </label>

          <label class="field">
            <span class="field__label">位置</span>
            <input v-model.trim="cameraFilters.roomName" type="text" placeholder="请输入位置或区域" />
          </label>

          <div class="inline-actions">
            <button type="submit" :disabled="cameraLoading">查询</button>
            <button type="button" class="ghost" :disabled="cameraLoading" @click="resetCameraSearch">重置</button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="panel__toolbar">
          <div>
            <p class="eyebrow">摄像头列表</p>
            <h2>共 {{ formatCount(cameraPagination.total) }} 个摄像头</h2>
          </div>
        </div>

        <div class="account-table-wrap">
          <table class="account-table resource-table">
            <thead>
              <tr>
                <th>平台</th>
                <th>摄像头名称</th>
                <th>IP</th>
                <th>通道号</th>
                <th>位置</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="cameraLoading">
                <td colspan="9" class="empty-cell">摄像头加载中...</td>
              </tr>
              <tr v-else-if="!cameras.length">
                <td colspan="9" class="empty-cell">未找到摄像头。</td>
              </tr>
              <tr v-for="item in cameras" :key="item.id">
                <td>
                  <strong>{{ item.platformTitle }}</strong>
                  <div class="subtle-text">{{ formatPlatformTypeLabel(item.platformType, item.platformType) }}</div>
                </td>
                <td>{{ item.title }}</td>
                <td>{{ formatValue(item.ip) }}</td>
                <td>{{ formatValue(item.channelNum) }}</td>
                <td>{{ formatValue(item.roomName) }}</td>
                <td>{{ formatCameraStatus(item.status) }}</td>
                <td>{{ formatValue(item.createdAt) }}</td>
                <td>{{ formatValue(item.updatedAt) }}</td>
                <td>
                  <div class="action-group">
                    <button type="button" class="ghost" @click="openEditCameraDialog(item)">编辑</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="panel__footer" style="display: flex; justify-content: flex-end; margin-top: 1rem;">
          <div class="page-nav">
            <select
              class="input-field"
              style="width: 8rem; padding: 0.1rem;"
              :value="cameraPagination.pageSize"
              @change="changeCameraPageSize"
            >
              <option :value="10">10 条/页</option>
              <option :value="20">20 条/页</option>
              <option :value="50">50 条/页</option>
              <option :value="100">100 条/页</option>
            </select>

            <button type="button" class="ghost" :disabled="cameraLoading || cameraPagination.page <= 1" @click="previousCameraPage">
              上一页
            </button>
            <span>第 {{ cameraPagination.page }} 页 / {{ cameraTotalPages }}</span>
            <button
              type="button"
              class="ghost"
              :disabled="cameraLoading || cameraPagination.page >= cameraTotalPages"
              @click="nextCameraPage"
            >
              下一页
            </button>
          </div>
        </div>
      </article>
    </template>

    <template v-else>
      <article class="panel storage-toolbar-panel">
        <div class="panel__toolbar panel__toolbar--stack">
          <div>
            <p class="eyebrow">查询条件</p>
            <h2>存储设备管理</h2>
            <p class="subtle-text" style="margin-top: 0.5rem; display: flex; gap: 1.5rem;">
              <span>资源总数：<strong style="color: var(--text);">{{ formatCount(totalResources) }}</strong></span>
            </p>
            <div class="tab-strip" style="margin-top: 1rem;">
              <button
                v-for="item in tabItems"
                :key="item.value"
                type="button"
                class="tab-chip"
                :class="{ 'tab-chip--active': activeTab === item.value }"
                @click="navigateToTab(item.value)"
              >
                <span>{{ item.label }}</span>
                <strong>{{ formatCount(item.count) }}</strong>
              </button>
            </div>
          </div>

          <div class="inline-actions inline-actions--wrap">
            <button type="button" @click="openStorageTypePicker">新增存储设备</button>
          </div>
        </div>

        <form class="toolbar-grid toolbar-grid--wide" @submit.prevent="submitStorageSearch">
          <label class="field">
            <span class="field__label">关键字</span>
            <input v-model.trim="storageFilters.keyword" type="text" placeholder="存储设备名称" />
          </label>

          <label class="field">
            <span class="field__label">服务器 IP</span>
            <input v-model.trim="storageFilters.serverIp" type="text" placeholder="选填" />
          </label>

          <div class="inline-actions">
            <button type="submit" :disabled="storageLoading">查询</button>
            <button type="button" class="ghost" :disabled="storageLoading" @click="resetStorageSearch">重置</button>
          </div>
        </form>
      </article>

      <article v-if="storageLoading" class="panel">
        <p class="eyebrow">加载中</p>
        <h2>正在获取存储设备</h2>
        <div class="shell__menu shell__menu--loading">
          <div v-for="index in 5" :key="index" class="skeleton-line"></div>
        </div>
      </article>

      <article v-else class="panel account-panel">
        <div class="panel__toolbar">
          <div>
            <p class="eyebrow">存储设备</p>
            <h2>共 {{ formatCount(storageItemCount) }} 台存储设备</h2>
          </div>
        </div>

        <div class="account-table-wrap">
          <table class="account-table resource-table storage-device-table">
            <thead>
              <tr>
                <th>设备</th>
                <th>接入信息</th>
                <th>设备概况</th>
                <th>状态</th>
                <th>最近信息</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!storageDevices.length">
                <td colspan="6" class="empty-cell">未找到存储设备。</td>
              </tr>

              <tr v-for="item in storageDevices" :key="`${item.type}:${item.id}`">
                <td>
                  <strong>{{ item.title }}</strong>
                  <div class="subtle-text">{{ formatStorageTypeLabel(item.type, item.sectionTitle) }}</div>
                </td>

                <td>
                  <template v-if="item.type === 'disc-group'">
                    <div>RAID：{{ formatValue(item.raidLevelLabel) }}</div>
                    <div class="subtle-text">自动追加：{{ item.autoAppend ? '启用' : '关闭' }}</div>
                  </template>

                  <template v-else>
                    <div>{{ formatValue(item.serverIp) }}</div>
                    <div class="subtle-text">{{ formatValue(item.path) }}</div>
                  </template>
                </td>

                <td>
                  <template v-if="item.type === 'disc-group'">
                    <div>盘匣数量：{{ formatCount(item.discCount) }}</div>
                    <div class="subtle-text">可用容量：{{ formatValue(item.availableCapacityLabel) }}</div>
                  </template>

                  <template v-else>
                    <div class="usage-meter">
                      <div class="usage-meter__bar">
                        <span :style="{ width: `${storageUsedPercent(item)}%` }"></span>
                      </div>
                      <div class="subtle-text">
                        {{ formatCount(item.currentSize) }} / {{ formatCount(item.maxSize) }}
                      </div>
                    </div>

                    <div class="subtle-text">
                      {{ item.type === 'nas' ? `备份方式：${formatValue(item.backupTypeLabel)}` : `初始容量：${formatCount(item.startSize)}` }}
                    </div>
                  </template>
                </td>

                <td>
                  <span class="status-pill" :class="formatStatusClass(item.status)">
                    {{ formatStatusLabel(item.status) }}
                  </span>

                  <div class="subtle-text">
                    {{ item.type === 'disc-group' ? (item.autoAppend ? '自动追加已开启' : '自动追加已关闭') : formatWorkStatus(item.workStatus) }}
                  </div>
                </td>

                <td>
                  <template v-if="item.type === 'disc-group'">
                    <div>更新时间：{{ formatValue(item.updatedAt) }}</div>
                    <div class="subtle-text">{{ formatValue(item.remark) }}</div>
                  </template>

                  <template v-else-if="item.type === 'nas'">
                    <div>创建时间：{{ formatValue(item.createdAt) }}</div>
                    <div class="subtle-text">最近备份：{{ formatValue(item.lastBackupAt) }}</div>
                    <div class="subtle-text">{{ formatMessageValue(item.lastBackupInfo || item.lastError) }}</div>
                  </template>

                  <template v-else>
                    <div>创建时间：{{ formatValue(item.createdAt) }}</div>
                    <div class="subtle-text">{{ formatMessageValue(item.lastError) }}</div>
                  </template>
                </td>

                <td>
                  <div class="action-group">
                    <button type="button" class="ghost" @click="openEditStorageDialog(item)">编辑</button>
                    <button
                      type="button"
                      class="ghost"
                      :disabled="isBusy(item.type, item.id, 'toggle')"
                      @click="toggleStorageStatus(item)"
                    >
                      {{
                        isBusy(item.type, item.id, 'toggle')
                          ? '处理中...'
                          : Number(item.status) === 1
                            ? '停用'
                          : '启用'
                      }}
                    </button>
                    <button
                      v-if="item.type !== 'disc-group'"
                      type="button"
                      class="ghost"
                      :disabled="isBusy(item.type, item.id, 'test')"
                      @click="testStorageTarget(item)"
                    >
                      {{ isBusy(item.type, item.id, 'test') ? '测试中...' : '测试' }}
                    </button>
                    <button
                      type="button"
                      class="danger"
                      :disabled="isBusy(item.type, item.id, 'delete')"
                      @click="deleteStorageTarget(item)"
                    >
                      {{ isBusy(item.type, item.id, 'delete') ? '删除中...' : '删除' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </template>

    <PlatformDialog
      :error-message="platformDialog.errorMessage"
      :initial-value="platformDialogValue"
      :mode="platformDialog.mode"
      :open="platformDialog.open"
      :submitting="platformDialog.submitting"
      :type-options="platformOptions.types"
      @close="closePlatformDialog"
      @submit="submitPlatformDialog"
    />

    <CameraDialog
      :error-message="cameraDialog.errorMessage"
      :initial-value="cameraDialogValue"
      :open="cameraDialog.open"
      :submitting="cameraDialog.submitting"
      @close="closeCameraDialog"
      @submit="submitCameraDialog"
    />

    <StorageTargetDialog
      :error-message="storageDialog.errorMessage"
      :initial-value="storageDialogValue"
      :mode="storageDialog.mode"
      :open="storageDialog.open"
      :raid-level-options="storageOptions.discGroupRaidLevels"
      :submitting="storageDialog.submitting"
      :type-options="storageOptions.types"
      @close="closeStorageDialog"
      @submit="submitStorageDialog"
    />

    <div v-if="storageTypePickerOpen" class="dialog-backdrop" @click.self="closeStorageTypePicker">
      <section class="dialog storage-type-picker">
        <header class="dialog__header">
          <div>
            <p class="eyebrow">新增存储设备</p>
            <h3>选择设备类型</h3>
          </div>
          <button type="button" class="ghost" @click="closeStorageTypePicker">关闭</button>
        </header>

        <div class="storage-type-picker__body">
          <button
            v-for="item in writableStorageTypes"
            :key="item.value"
            type="button"
            class="storage-type-card"
            @click="openCreateStorageDialog(item.value)"
          >
            <div class="storage-type-card__badge">设备类型</div>
            <strong>{{ formatStorageTypeLabel(item.value, item.label) }}</strong>
            <p>{{ formatStorageTypeDescription(item.value) }}</p>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.inline-actions--wrap {
  flex-wrap: wrap;
}

.storage-toolbar-panel {
  position: relative;
}

.storage-device-table td {
  vertical-align: top;
}

.storage-type-picker {
  width: min(780px, calc(100vw - 2rem));
}

.storage-type-picker__body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.storage-type-card {
  position: relative;
  min-height: 10.5rem;
  padding: 1.2rem;
  border-radius: 1.15rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background:
    radial-gradient(circle at top right, rgba(45, 104, 93, 0.12), transparent 40%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(245, 248, 247, 0.94));
  text-align: left;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.storage-type-card:hover {
  transform: translateY(-2px);
  border-color: rgba(45, 104, 93, 0.26);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
}

.storage-type-card p {
  margin: 0;
  font-size: 0.92rem;
  color: rgba(71, 85, 105, 0.88);
  line-height: 1.6;
}

.storage-type-card__badge {
  width: fit-content;
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  background: rgba(22, 59, 54, 0.08);
  color: rgba(22, 59, 54, 0.78);
  font-size: 0.78rem;
  font-weight: 700;
}

@media (max-width: 900px) {
  .storage-type-picker__body {
    grid-template-columns: 1fr;
  }
}
</style>
