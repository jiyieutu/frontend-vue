<script setup>
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { backupAccountApi } from '../api/backup-accounts'
import { cameraApi } from '../api/cameras'
import { healthApi } from '../api/health'
import { planApi } from '../api/plans'
import { storageTargetApi } from '../api/storage-targets'
import { systemLogApi } from '../api/system-logs'
import { videoPlatformApi } from '../api/video-platforms'
import { sessionState } from '../lib/session'

const router = useRouter()

const REFRESH_INTERVAL_MS = 20000
const ISSUE_KEYWORDS = [
  'error',
  'failed',
  'failure',
  'exception',
  'timeout',
  'unreachable',
  'not reachable',
  'denied',
  'refused',
  'invalid',
  'missing',
  'abort',
  '错误',
  '失败',
  '异常',
  '超时',
  '不可达',
  '拒绝',
  '无效',
  '中断',
  '不存在',
]
const WARNING_KEYWORDS = [
  'warn',
  'warning',
  'stopped',
  'pending',
  'waiting',
  'warning',
  '告警',
  '提醒',
  '待执行',
  '等待',
  '停止',
]
const ALERT_CATEGORY_ORDER = ['采集', '备份', '上传', '存储', '平台', '日志']

const dashboardState = reactive({
  backupItems: [],
  backupTotal: 0,
  cameraItems: [],
  cameraTotal: 0,
  errorMessage: '',
  healthStatus: 'UNKNOWN',
  lastUpdatedAt: '',
  loading: true,
  operationLogs: [],
  planItems: [],
  planTotal: 0,
  platformItems: [],
  platformTotal: 0,
  refreshing: false,
  storageSections: [],
})

const alertFilters = reactive({
  category: 'all',
  severity: 'all',
})

let refreshTimer = 0
let dashboardRequesting = false

const operatorName = computed(
  () => sessionState.user?.userName || sessionState.user?.userCode || '操作员',
)

const isInitialLoading = computed(() => dashboardState.loading && !dashboardState.lastUpdatedAt)

const storageDevices = computed(() =>
  dashboardState.storageSections.reduce((items, section) => {
    const nextItems = (section.items || []).map((item) => ({
      ...item,
      sectionTitle: section.title,
    }))
    return items.concat(nextItems)
  }, []),
)

const storageDeviceTotal = computed(() =>
  dashboardState.storageSections.reduce(
    (sum, section) => sum + Number(section.total || (section.items || []).length || 0),
    0,
  ),
)

const enabledPlatformCount = computed(() =>
  dashboardState.platformItems.filter((item) => Number(item.status) === 1).length,
)

const runningPlanCount = computed(() =>
  dashboardState.planItems.filter((item) => isPlanRunning(item)).length,
)

const pendingPlanCount = computed(() =>
  dashboardState.planItems.filter((item) => isPlanPending(item)).length,
)

const failedPlanCount = computed(() =>
  dashboardState.planItems.filter((item) => isPlanFailed(item)).length,
)

const completedPlanCount = computed(() =>
  dashboardState.planItems.filter((item) => isPlanCompleted(item)).length,
)

const enabledBackupCount = computed(() =>
  dashboardState.backupItems.filter((item) => Number(item.status) === 1).length,
)

const scheduledUploadCount = computed(() =>
  dashboardState.backupItems.filter(
    (item) => Number(item.status) === 1 && Boolean(item.uploadScheduleEnabled),
  ).length,
)

const backupIssueAccounts = computed(() =>
  dashboardState.backupItems.filter(
    (item) => Number(item.status) === 1 && containsIssueText(item.lastBackupInfo),
  ),
)

const uploadIssueAccounts = computed(() =>
  dashboardState.backupItems.filter(
    (item) => Number(item.status) === 1 && containsIssueText(item.lastUploadInfo),
  ),
)

const storageIssueDevices = computed(() =>
  storageDevices.value.filter(
    (item) => Number(item.status) === 1 && containsIssueText(item.lastError),
  ),
)

const platformIssueItems = computed(() =>
  dashboardState.platformItems.filter(
    (item) => Number(item.status) === 1 && containsIssueText(item.lastInfo),
  ),
)

const recentLogIssues = computed(() =>
  dashboardState.operationLogs.filter((item) => isLogDanger(item) || isLogWarning(item)),
)

const alertItems = computed(() => {
  const items = []

  dashboardState.planItems.forEach((item) => {
    if (!isPlanFailed(item)) {
      return
    }

    items.push({
      category: '采集',
      id: `plan:${item.id}`,
      message: `${translateStatusLabel(item.statusLabel)} · 进度 ${Number(item.progress || 0)}%`,
      routeName: 'plans',
      severity: 'danger',
      time: item.endDateTime || item.startDateTime || item.createdAt || '',
      title: item.title || '任务计划执行异常',
    })
  })

  backupIssueAccounts.value.forEach((item) => {
    items.push({
      category: '备份',
      id: `backup:${item.id}`,
      message: formatMessage(item.lastBackupInfo),
      routeName: 'backup-accounts',
      severity: 'danger',
      time: item.lastBackupAt || '',
      title: item.title || '备份账户异常',
    })
  })

  uploadIssueAccounts.value.forEach((item) => {
    items.push({
      category: '上传',
      id: `upload:${item.id}`,
      message: formatMessage(item.lastUploadInfo),
      routeName: 'backup-accounts',
      severity: 'danger',
      time: item.lastUploadAt || '',
      title: item.title || '上传任务异常',
    })
  })

  storageIssueDevices.value.forEach((item) => {
    items.push({
      category: '存储',
      id: `storage:${item.type}:${item.id}`,
      message: formatMessage(item.lastError),
      routeName: 'storage-targets',
      severity: 'danger',
      time: item.updatedAt || item.createdAt || '',
      title: item.title || '存储设备异常',
    })
  })

  platformIssueItems.value.forEach((item) => {
    items.push({
      category: '平台',
      id: `platform:${item.id}`,
      message: formatMessage(item.lastInfo),
      routeName: 'accounts',
      severity: 'warning',
      time: item.loginAt || item.createdAt || '',
      title: item.title || '平台接入提醒',
    })
  })

  recentLogIssues.value.forEach((item) => {
    items.push({
      category: '日志',
      id: `log:${item.id}`,
      message: formatMessage(item.content),
      routeName: 'operation-logs',
      severity: isLogDanger(item) ? 'danger' : 'warning',
      time: item.operTime || '',
      title: item.userName ? `${item.userName} 的操作日志` : '操作日志提醒',
    })
  })

  return items.sort((left, right) => {
    const severityDiff = severityRank(right.severity) - severityRank(left.severity)
    if (severityDiff !== 0) {
      return severityDiff
    }
    return parseTimestamp(right.time) - parseTimestamp(left.time)
  })
})

const alertSummary = computed(() => {
  const dangerCount = alertItems.value.filter((item) => item.severity === 'danger').length
  const warningCount = alertItems.value.filter((item) => item.severity === 'warning').length

  return {
    dangerCount,
    total: alertItems.value.length,
    warningCount,
  }
})

const alertSeverityOptions = computed(() => [
  {
    count: alertSummary.value.total,
    label: '全部提醒',
    tone: 'neutral',
    value: 'all',
  },
  {
    count: alertSummary.value.dangerCount,
    label: '只看高优',
    tone: 'danger',
    value: 'danger',
  },
  {
    count: alertSummary.value.warningCount,
    label: '只看警告',
    tone: 'warning',
    value: 'warning',
  },
])

const alertCategoryOptions = computed(() => {
  const countMap = alertItems.value.reduce((map, item) => {
    const nextMap = map
    nextMap[item.category] = Number(nextMap[item.category] || 0) + 1
    return nextMap
  }, {})
  const categories = Object.keys(countMap).sort((left, right) => {
    const leftIndex = ALERT_CATEGORY_ORDER.indexOf(left)
    const rightIndex = ALERT_CATEGORY_ORDER.indexOf(right)
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex
    return normalizedLeft - normalizedRight || left.localeCompare(right, 'zh-Hans-CN')
  })

  return [
    {
      count: alertItems.value.length,
      label: '全部类型',
      value: 'all',
    },
    ...categories.map((category) => ({
      count: countMap[category],
      label: category,
      value: category,
    })),
  ]
})

const filteredAlerts = computed(() =>
  alertItems.value.filter((item) => {
    const matchesSeverity =
      alertFilters.severity === 'all' || item.severity === alertFilters.severity
    const matchesCategory =
      alertFilters.category === 'all' || item.category === alertFilters.category

    return matchesSeverity && matchesCategory
  }),
)

const filteredAlertSummary = computed(() => {
  const dangerCount = filteredAlerts.value.filter((item) => item.severity === 'danger').length
  const warningCount = filteredAlerts.value.filter((item) => item.severity === 'warning').length

  return {
    dangerCount,
    total: filteredAlerts.value.length,
    warningCount,
  }
})

const isAlertFilterActive = computed(
  () => alertFilters.severity !== 'all' || alertFilters.category !== 'all',
)

const visibleAlerts = computed(() => filteredAlerts.value.slice(0, 8))

const alertEmptyMessage = computed(() =>
  isAlertFilterActive.value
    ? '当前筛选条件下没有匹配的异常提醒，可以切回“全部提醒”继续查看。'
    : '当前没有检测到需要处理的明显异常，系统处于可运行状态。',
)

const systemHealth = computed(() => {
  if (dashboardState.healthStatus !== 'UP') {
    return {
      description: '后端健康检查未通过，建议先检查服务和数据库连接。',
      label: '服务异常',
      tone: 'danger',
    }
  }

  if (alertSummary.value.dangerCount > 0) {
    return {
      description: '系统服务仍在线，但已经检测到需要立即处理的高优异常。',
      label: '需要处理',
      tone: 'danger',
    }
  }

  if (alertSummary.value.warningCount > 0) {
    return {
      description: '暂无致命故障，但存在待处理提醒，建议尽快查看异常清单。',
      label: '存在提醒',
      tone: 'warning',
    }
  }

  return {
    description: '采集、备份、上传和存储链路当前未发现明显异常。',
    label: '运行稳定',
    tone: 'success',
  }
})

const refreshLabel = computed(() => {
  if (!dashboardState.lastUpdatedAt) {
    return dashboardState.loading ? '正在拉取实时状态...' : '等待首次刷新'
  }

  return `最近更新 ${dashboardState.lastUpdatedAt}`
})

const statusCards = computed(() => [
  {
    action: '查看任务计划',
    label: '采集状态',
    meta: `待执行 ${formatCount(pendingPlanCount.value)} · 失败 ${formatCount(failedPlanCount.value)}`,
    routeName: 'plans',
    tone: failedPlanCount.value > 0 ? 'danger' : runningPlanCount.value > 0 ? 'info' : 'success',
    value: `${formatCount(runningPlanCount.value)} 个执行中`,
  },
  {
    action: '查看备份账户',
    label: '备份状态',
    meta: `已启用 ${formatCount(enabledBackupCount.value)} · 异常 ${formatCount(backupIssueAccounts.value.length)}`,
    routeName: 'backup-accounts',
    tone: backupIssueAccounts.value.length > 0 ? 'danger' : enabledBackupCount.value > 0 ? 'success' : 'muted',
    value: `${formatCount(Math.max(enabledBackupCount.value - backupIssueAccounts.value.length, 0))} 个正常`,
  },
  {
    action: '查看上传任务',
    label: '上传状态',
    meta: `已启用 ${formatCount(scheduledUploadCount.value)} · 异常 ${formatCount(uploadIssueAccounts.value.length)}`,
    routeName: 'backup-accounts',
    tone: uploadIssueAccounts.value.length > 0 ? 'danger' : scheduledUploadCount.value > 0 ? 'info' : 'muted',
    value: `${formatCount(Math.max(scheduledUploadCount.value - uploadIssueAccounts.value.length, 0))} 个正常`,
  },
  {
    action: '查看异常清单',
    label: '实时检测',
    meta: `高优 ${formatCount(alertSummary.value.dangerCount)} · 警告 ${formatCount(alertSummary.value.warningCount)}`,
    routeName: 'operation-logs',
    tone: systemHealth.value.tone,
    value: `${formatCount(alertSummary.value.total)} 条提醒`,
  },
])

const resourceCards = computed(() => [
  {
    detail: `启用 ${formatCount(enabledPlatformCount.value)}`,
    label: '视频平台',
    routeName: 'accounts',
    value: formatCount(dashboardState.platformTotal),
  },
  {
    detail: '采集通道总量',
    label: '摄像头',
    routeName: 'cameras',
    value: formatCount(dashboardState.cameraTotal),
  },
  {
    detail: `异常 ${formatCount(storageIssueDevices.value.length)}`,
    label: '存储设备',
    routeName: 'storage-targets',
    value: formatCount(storageDeviceTotal.value),
  },
  {
    detail: `启用 ${formatCount(enabledBackupCount.value)}`,
    label: '备份账户',
    routeName: 'backup-accounts',
    value: formatCount(dashboardState.backupTotal),
  },
  {
    detail: `已完成 ${formatCount(completedPlanCount.value)}`,
    label: '任务计划',
    routeName: 'plans',
    value: formatCount(dashboardState.planTotal),
  },
])

const signalRows = computed(() => [
  {
    label: '服务健康',
    tone: systemHealth.value.tone,
    value: dashboardState.healthStatus === 'UP' ? '正常' : '异常',
  },
  {
    label: '自动刷新',
    tone: 'info',
    value: `${Math.floor(REFRESH_INTERVAL_MS / 1000)} 秒`,
  },
  {
    label: '最近日志提醒',
    tone: recentLogIssues.value.length > 0 ? 'warning' : 'success',
    value: `${formatCount(recentLogIssues.value.length)} 条`,
  },
  {
    label: '轮询覆盖',
    tone: 'info',
    value: '平台 / 采集 / 备份 / 上传 / 存储',
  },
])

const captureFocusItems = computed(() =>
  [...dashboardState.planItems]
    .sort((left, right) => {
      const priorityDiff = planPriority(left) - planPriority(right)
      if (priorityDiff !== 0) {
        return priorityDiff
      }
      return parseTimestamp(right.startDateTime) - parseTimestamp(left.startDateTime)
    })
    .slice(0, 4)
    .map((item) => ({
      detail: `${formatDisplayValue(item.startDateTime)} 至 ${formatDisplayValue(item.endDateTime)} · 进度 ${Number(item.progress || 0)}%`,
      id: `capture:${item.id}`,
      routeName: 'plans',
      subtitle: `${formatDisplayValue(item.accountTitle)} · ${translateStatusLabel(item.statusLabel)}`,
      title: item.title || '未命名计划',
      tone: isPlanFailed(item)
        ? 'danger'
        : isPlanRunning(item)
          ? 'info'
          : isPlanPending(item)
            ? 'warning'
            : 'success',
    })),
)

const backupFocusItems = computed(() =>
  [...dashboardState.backupItems]
    .sort((left, right) => backupPriority(left) - backupPriority(right))
    .slice(0, 4)
    .map((item) => {
      const hasBackupIssue = containsIssueText(item.lastBackupInfo)
      const hasUploadIssue = containsIssueText(item.lastUploadInfo)
      const tone = hasUploadIssue || hasBackupIssue
        ? 'danger'
        : Number(item.status) === 1
          ? 'success'
          : 'muted'

      return {
        detail: hasUploadIssue
          ? `上传：${formatMessage(item.lastUploadInfo)}`
          : hasBackupIssue
            ? `备份：${formatMessage(item.lastBackupInfo)}`
            : `最近上传 ${formatDisplayValue(item.lastUploadAt)} · 最近备份 ${formatDisplayValue(item.lastBackupAt)}`,
        id: `backup:${item.id}`,
        routeName: 'backup-accounts',
        subtitle: `${formatDisplayValue(item.serverIp)} · ${formatDisplayValue(item.storageTargetTitle)}`,
        title: item.title || '未命名备份账户',
        tone,
      }
    }),
)

const infraFocusItems = computed(() => {
  const items = []

  storageIssueDevices.value.forEach((item) => {
    items.push({
      detail: formatMessage(item.lastError),
      id: `infra:storage:${item.type}:${item.id}`,
      routeName: 'storage-targets',
      subtitle: item.type === 'nas' ? 'NAS 存储设备' : item.sectionTitle || '存储设备',
      title: item.title || '未命名存储设备',
      tone: 'danger',
    })
  })

  platformIssueItems.value.forEach((item) => {
    items.push({
      detail: formatMessage(item.lastInfo),
      id: `infra:platform:${item.id}`,
      routeName: 'accounts',
      subtitle: formatDisplayValue(item.serverIp),
      title: item.title || '未命名视频平台',
      tone: 'warning',
    })
  })

  return items.slice(0, 4)
})

onMounted(() => {
  loadDashboard()
  refreshTimer = window.setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) {
      return
    }
    loadDashboard(true)
  }, REFRESH_INTERVAL_MS)
})

onBeforeUnmount(() => {
  window.clearInterval(refreshTimer)
})

async function refreshNow() {
  await loadDashboard()
}

function clearAlertFilters() {
  alertFilters.category = 'all'
  alertFilters.severity = 'all'
}

async function loadDashboard(silent = false) {
  if (dashboardRequesting) {
    return
  }
  dashboardRequesting = true

  try {
    const initialLoading = !dashboardState.lastUpdatedAt
    if (initialLoading) {
      dashboardState.loading = true
    } else {
      dashboardState.refreshing = true
    }

    const taskEntries = [
      ['health', healthApi.get()],
      ['platforms', videoPlatformApi.list({ page: 1, pageSize: 100 })],
      ['cameras', cameraApi.list({ page: 1, pageSize: 100 })],
      ['storage', storageTargetApi.overview({})],
      ['backups', backupAccountApi.list({ page: 1, pageSize: 100 })],
      ['plans', planApi.list({ onlyUnfinished: false, page: 1, pageSize: 100 })],
      ['logs', systemLogApi.listOperationLogs({ page: 1, pageSize: 20 })],
    ]

    const results = await Promise.allSettled(taskEntries.map(([, promise]) => promise))
    const errors = []

    results.forEach((result, index) => {
      const key = taskEntries[index][0]

      if (result.status === 'rejected') {
        errors.push(resolveTaskError(key, result.reason))
        return
      }

      applyTaskResult(key, result.value)
    })

    dashboardState.lastUpdatedAt = formatNow(new Date())
    dashboardState.errorMessage = errors.length
      ? `部分状态刷新失败：${errors.join('；')}`
      : ''
  } finally {
    dashboardState.loading = false
    dashboardState.refreshing = false
    dashboardRequesting = false
  }
}

function applyTaskResult(key, payload) {
  if (key === 'health') {
    dashboardState.healthStatus = formatDisplayValue(payload?.status, 'UNKNOWN')
    return
  }

  if (key === 'platforms') {
    dashboardState.platformItems = payload?.items || []
    dashboardState.platformTotal = Number(payload?.total || 0)
    return
  }

  if (key === 'cameras') {
    dashboardState.cameraItems = payload?.items || []
    dashboardState.cameraTotal = Number(payload?.total || 0)
    return
  }

  if (key === 'storage') {
    dashboardState.storageSections = Array.isArray(payload) ? payload : []
    return
  }

  if (key === 'backups') {
    dashboardState.backupItems = payload?.items || []
    dashboardState.backupTotal = Number(payload?.total || 0)
    return
  }

  if (key === 'plans') {
    dashboardState.planItems = payload?.items || []
    dashboardState.planTotal = Number(payload?.total || 0)
    return
  }

  if (key === 'logs') {
    dashboardState.operationLogs = payload?.items || []
  }
}

function resolveTaskError(key, error) {
  const labelMap = {
    backups: '备份状态',
    cameras: '摄像头状态',
    health: '健康检查',
    logs: '日志检测',
    plans: '采集状态',
    platforms: '平台状态',
    storage: '存储状态',
  }

  return `${labelMap[key] || key}：${error?.message || '请求失败'}`
}

function goToRoute(routeName) {
  if (!routeName) {
    return
  }
  router.push({ name: routeName })
}

function formatCount(value) {
  return Number(value || 0).toLocaleString()
}

function formatDisplayValue(value, fallback = '--') {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  return String(value)
}

function normalizeText(value) {
  return formatDisplayValue(value, '').trim().toLowerCase()
}

function containsIssueText(value) {
  const text = normalizeText(value)
  if (!text) {
    return false
  }

  return ISSUE_KEYWORDS.some((keyword) => text.includes(keyword))
}

function containsWarningText(value) {
  const text = normalizeText(value)
  if (!text) {
    return false
  }

  return WARNING_KEYWORDS.some((keyword) => text.includes(keyword))
}

function isPlanRunning(item) {
  const text = normalizeText(item?.statusLabel)
  return text.includes('running') || text.includes('执行中')
}

function isPlanPending(item) {
  const text = normalizeText(item?.statusLabel)
  return ['pending', 'ready', 'waiting', '待执行', '就绪', '等待中'].some((keyword) =>
    text.includes(keyword),
  )
}

function isPlanFailed(item) {
  const text = normalizeText(item?.statusLabel)
  return ['failed', 'stopped', 'error', '失败', '已停止'].some((keyword) =>
    text.includes(keyword),
  )
}

function isPlanCompleted(item) {
  const text = normalizeText(item?.statusLabel)
  return ['completed', 'finished', 'success', '已完成', '成功'].some((keyword) =>
    text.includes(keyword),
  )
}

function isLogDanger(item) {
  const logLevel = normalizeText(item?.logLevel)
  return logLevel.includes('error') || logLevel.includes('fatal') || containsIssueText(item?.content)
}

function isLogWarning(item) {
  if (isLogDanger(item)) {
    return false
  }

  const logLevel = normalizeText(item?.logLevel)
  return logLevel.includes('warn') || containsWarningText(item?.content)
}

function severityRank(value) {
  if (value === 'danger') {
    return 3
  }
  if (value === 'warning') {
    return 2
  }
  if (value === 'info') {
    return 1
  }
  return 0
}

function planPriority(item) {
  if (isPlanFailed(item)) {
    return 0
  }
  if (isPlanRunning(item)) {
    return 1
  }
  if (isPlanPending(item)) {
    return 2
  }
  if (isPlanCompleted(item)) {
    return 3
  }
  return 4
}

function backupPriority(item) {
  if (containsIssueText(item?.lastUploadInfo)) {
    return 0
  }
  if (containsIssueText(item?.lastBackupInfo)) {
    return 1
  }
  if (item?.lastUploadAt) {
    return 2
  }
  if (item?.lastBackupAt) {
    return 3
  }
  return 4
}

function parseTimestamp(value) {
  if (!value) {
    return 0
  }

  const normalized = String(value).replace(' ', 'T')
  const timestamp = Date.parse(normalized)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function translateStatusLabel(value) {
  const normalized = normalizeText(value)
  const labelMap = {
    completed: '已完成',
    failed: '失败',
    finished: '已完成',
    idle: '空闲',
    pending: '待执行',
    ready: '就绪',
    running: '执行中',
    stopped: '已停止',
    success: '成功',
    waiting: '等待中',
  }

  return labelMap[normalized] || formatDisplayValue(value)
}

function formatMessage(value) {
  const text = formatDisplayValue(value)
  if (text === '--') {
    return text
  }

  if (text === 'The platform endpoint is reachable.') {
    return '平台接口连通正常。'
  }
  if (text.startsWith('The platform endpoint is not reachable:')) {
    return `平台接口不可达：${text.slice('The platform endpoint is not reachable:'.length).trim()}`
  }
  if (text === 'Object storage is reachable and the bucket exists.') {
    return '对象存储连通正常，桶已存在。'
  }
  if (text === 'Object storage is reachable, but the configured bucket does not exist.') {
    return '对象存储连通正常，但配置的桶不存在。'
  }
  if (text.startsWith('Object storage is not reachable:')) {
    return `对象存储不可达：${text.slice('Object storage is not reachable:'.length).trim()}`
  }
  if (text === 'NAS path is reachable and writable.') {
    return 'NAS 路径可访问且可写。'
  }
  if (text.startsWith('NAS path is not reachable or not writable:')) {
    return `NAS 路径不可访问或不可写：${text.slice('NAS path is not reachable or not writable:'.length).trim()}`
  }

  return text
}

function formatNow(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function pad(value) {
  return String(value).padStart(2, '0')
}
</script>

<template>
  <section class="dashboard-home content-grid">
    <article class="panel panel--hero dashboard-home__hero">
      <div class="dashboard-home__hero-copy">
        <span class="pill">运行总览</span>
        <h1>{{ operatorName }}</h1>
        <p>
          首页会持续巡检采集、备份、上传、存储和近期操作日志。出现异常后，会直接在下方清单里显示，
          方便第一时间定位问题。
        </p>

        <div class="dashboard-home__hero-tags">
          <span class="dashboard-home__hero-tag">视频平台 {{ formatCount(dashboardState.platformTotal) }}</span>
          <span class="dashboard-home__hero-tag">摄像头 {{ formatCount(dashboardState.cameraTotal) }}</span>
          <span class="dashboard-home__hero-tag">备份账户 {{ formatCount(dashboardState.backupTotal) }}</span>
          <span class="dashboard-home__hero-tag">存储设备 {{ formatCount(storageDeviceTotal) }}</span>
        </div>
      </div>

      <div class="dashboard-home__hero-side">
        <div class="dashboard-home__health" :class="`dashboard-home__health--${systemHealth.tone}`">
          <span class="dashboard-home__health-label">系统状态</span>
          <strong>{{ systemHealth.label }}</strong>
          <p>{{ systemHealth.description }}</p>
        </div>

        <div class="dashboard-home__hero-actions">
          <button type="button" class="ghost" :disabled="dashboardState.refreshing" @click="refreshNow">
            {{ dashboardState.refreshing ? '刷新中...' : '立即刷新' }}
          </button>
          <span class="dashboard-home__refresh-text">{{ refreshLabel }}</span>
        </div>
      </div>
    </article>

    <div v-if="dashboardState.errorMessage" class="banner banner--warning">
      {{ dashboardState.errorMessage }}
    </div>

    <section class="dashboard-home__status-grid">
      <button
        v-for="item in statusCards"
        :key="item.label"
        type="button"
        class="dashboard-home__status-card"
        :class="`dashboard-home__status-card--${item.tone}`"
        @click="goToRoute(item.routeName)"
      >
        <span class="dashboard-home__status-label">{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <p>{{ item.meta }}</p>
        <span class="dashboard-home__status-link">{{ item.action }}</span>
      </button>
    </section>

    <section class="dashboard-home__main-grid">
      <article class="panel dashboard-home__alerts">
        <div class="dashboard-home__panel-header">
          <div>
            <p class="eyebrow">实时异常</p>
            <h2>异常清单</h2>
          </div>

          <div class="dashboard-home__panel-meta">
            <span class="dashboard-home__meta-pill dashboard-home__meta-pill--danger">
              高优 {{ formatCount(alertSummary.dangerCount) }}
            </span>
            <span class="dashboard-home__meta-pill dashboard-home__meta-pill--warning">
              警告 {{ formatCount(alertSummary.warningCount) }}
            </span>
            <span
              v-if="isAlertFilterActive"
              class="dashboard-home__meta-pill dashboard-home__meta-pill--info"
            >
              命中 {{ formatCount(filteredAlertSummary.total) }}
            </span>
          </div>
        </div>

        <div v-if="alertItems.length || isAlertFilterActive" class="dashboard-home__alert-filters">
          <div class="dashboard-home__filter-row">
            <span class="dashboard-home__filter-label">优先级</span>
            <button
              v-for="option in alertSeverityOptions"
              :key="option.value"
              type="button"
              class="dashboard-home__filter-chip"
              :aria-pressed="alertFilters.severity === option.value"
              :class="[
                `dashboard-home__filter-chip--${option.tone}`,
                { 'dashboard-home__filter-chip--active': alertFilters.severity === option.value },
              ]"
              @click="alertFilters.severity = option.value"
            >
              <span>{{ option.label }}</span>
              <small>{{ formatCount(option.count) }}</small>
            </button>
          </div>

          <div class="dashboard-home__filter-row">
            <span class="dashboard-home__filter-label">异常类型</span>
            <button
              v-for="option in alertCategoryOptions"
              :key="option.value"
              type="button"
              class="dashboard-home__filter-chip dashboard-home__filter-chip--category"
              :aria-pressed="alertFilters.category === option.value"
              :class="{ 'dashboard-home__filter-chip--active': alertFilters.category === option.value }"
              @click="alertFilters.category = option.value"
            >
              <span>{{ option.label }}</span>
              <small>{{ formatCount(option.count) }}</small>
            </button>

            <button
              v-if="isAlertFilterActive"
              type="button"
              class="ghost dashboard-home__filter-reset"
              @click="clearAlertFilters"
            >
              清空筛选
            </button>
          </div>
        </div>

        <div v-if="isInitialLoading" class="shell__menu shell__menu--loading">
          <div v-for="index in 5" :key="index" class="skeleton-line"></div>
        </div>

        <div v-else-if="!visibleAlerts.length" class="empty-state-inline dashboard-home__empty-state">
          {{ alertEmptyMessage }}
        </div>

        <div v-else class="dashboard-home__alert-list">
          <article
            v-for="item in visibleAlerts"
            :key="item.id"
            class="dashboard-home__alert-item"
            :class="`dashboard-home__alert-item--${item.severity}`"
          >
            <div class="dashboard-home__alert-mark">
              <span>{{ item.category }}</span>
            </div>

            <div class="dashboard-home__alert-body">
              <div class="dashboard-home__alert-heading">
                <strong>{{ item.title }}</strong>
                <span>{{ formatDisplayValue(item.time) }}</span>
              </div>
              <p>{{ item.message }}</p>
            </div>

            <button type="button" class="ghost" @click="goToRoute(item.routeName)">查看</button>
          </article>
        </div>
      </article>

      <div class="dashboard-home__side-stack">
        <article class="panel">
          <div class="dashboard-home__panel-header">
            <div>
              <p class="eyebrow">资源体征</p>
              <h2>基础资源</h2>
            </div>
          </div>

          <div class="dashboard-home__resource-grid">
            <button
              v-for="item in resourceCards"
              :key="item.label"
              type="button"
              class="dashboard-home__resource-card"
              @click="goToRoute(item.routeName)"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <p>{{ item.detail }}</p>
            </button>
          </div>
        </article>

        <article class="panel">
          <div class="dashboard-home__panel-header">
            <div>
              <p class="eyebrow">检测节奏</p>
              <h2>巡检信号</h2>
            </div>
          </div>

          <div class="dashboard-home__signal-list">
            <div
              v-for="item in signalRows"
              :key="item.label"
              class="dashboard-home__signal-item"
            >
              <span>{{ item.label }}</span>
              <strong :class="`dashboard-home__signal-value--${item.tone}`">{{ item.value }}</strong>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="dashboard-home__module-grid">
      <article class="panel">
        <div class="dashboard-home__panel-header">
          <div>
            <p class="eyebrow">采集态势</p>
            <h2>任务计划</h2>
          </div>

          <button type="button" class="ghost" @click="goToRoute('plans')">查看全部</button>
        </div>

        <div v-if="!captureFocusItems.length" class="empty-state-inline">
          还没有任务计划，或者当前没有可展示的计划状态。
        </div>

        <div v-else class="dashboard-home__module-list">
          <button
            v-for="item in captureFocusItems"
            :key="item.id"
            type="button"
            class="dashboard-home__module-item"
            @click="goToRoute(item.routeName)"
          >
            <span class="dashboard-home__module-tone" :class="`dashboard-home__module-tone--${item.tone}`"></span>
            <div class="dashboard-home__module-copy">
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
              <p>{{ item.detail }}</p>
            </div>
          </button>
        </div>
      </article>

      <article class="panel">
        <div class="dashboard-home__panel-header">
          <div>
            <p class="eyebrow">备份与上传</p>
            <h2>备份账户</h2>
          </div>

          <button type="button" class="ghost" @click="goToRoute('backup-accounts')">查看全部</button>
        </div>

        <div v-if="!backupFocusItems.length" class="empty-state-inline">
          还没有备份账户，或者当前没有足够的备份/上传状态数据。
        </div>

        <div v-else class="dashboard-home__module-list">
          <button
            v-for="item in backupFocusItems"
            :key="item.id"
            type="button"
            class="dashboard-home__module-item"
            @click="goToRoute(item.routeName)"
          >
            <span class="dashboard-home__module-tone" :class="`dashboard-home__module-tone--${item.tone}`"></span>
            <div class="dashboard-home__module-copy">
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
              <p>{{ item.detail }}</p>
            </div>
          </button>
        </div>
      </article>

      <article class="panel">
        <div class="dashboard-home__panel-header">
          <div>
            <p class="eyebrow">平台与存储</p>
            <h2>基础设施提醒</h2>
          </div>

          <button type="button" class="ghost" @click="goToRoute('storage-targets')">查看设备</button>
        </div>

        <div v-if="!infraFocusItems.length" class="empty-state-inline">
          当前没有明显的平台或存储异常，接入层状态相对稳定。
        </div>

        <div v-else class="dashboard-home__module-list">
          <button
            v-for="item in infraFocusItems"
            :key="item.id"
            type="button"
            class="dashboard-home__module-item"
            @click="goToRoute(item.routeName)"
          >
            <span class="dashboard-home__module-tone" :class="`dashboard-home__module-tone--${item.tone}`"></span>
            <div class="dashboard-home__module-copy">
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
              <p>{{ item.detail }}</p>
            </div>
          </button>
        </div>
      </article>
    </section>
  </section>
</template>

<style scoped>
.dashboard-home {
  gap: 1.2rem;
}

.dashboard-home__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
  gap: 1.25rem;
  align-items: stretch;
}

.dashboard-home__hero h1 {
  margin: 0.8rem 0 0;
  font-size: clamp(2.2rem, 4vw, 3.4rem);
  line-height: 0.95;
}

.dashboard-home__hero p {
  margin: 1rem 0 0;
  max-width: 44rem;
}

.dashboard-home__hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 1.2rem;
}

.dashboard-home__hero-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.42rem 0.8rem;
  border-radius: 999px;
  background: rgba(22, 59, 54, 0.08);
  border: 1px solid rgba(22, 59, 54, 0.08);
  color: var(--text-main);
  font-size: 0.84rem;
  font-weight: 700;
}

.dashboard-home__hero-side {
  display: grid;
  gap: 1rem;
}

.dashboard-home__health {
  display: grid;
  gap: 0.45rem;
  padding: 1.25rem;
  border-radius: 24px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.68);
}

.dashboard-home__health-label {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.dashboard-home__health strong {
  font-size: 1.55rem;
}

.dashboard-home__health p {
  margin: 0;
}

.dashboard-home__health--success {
  background: linear-gradient(180deg, rgba(31, 96, 88, 0.12), rgba(255, 255, 255, 0.7));
}

.dashboard-home__health--warning {
  background: linear-gradient(180deg, rgba(208, 122, 76, 0.16), rgba(255, 255, 255, 0.72));
}

.dashboard-home__health--danger {
  background: linear-gradient(180deg, rgba(155, 59, 42, 0.16), rgba(255, 255, 255, 0.72));
}

.dashboard-home__hero-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.dashboard-home__refresh-text {
  color: var(--text-muted);
  font-size: 0.88rem;
}

.dashboard-home__status-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.dashboard-home__status-card,
.dashboard-home__resource-card,
.dashboard-home__module-item {
  box-shadow: none;
  background: rgba(255, 255, 255, 0.74);
  color: var(--text-main);
  border: 1px solid var(--border-soft);
}

.dashboard-home__status-card {
  display: grid;
  gap: 0.45rem;
  padding: 1.15rem;
  border-radius: 22px;
  text-align: left;
}

.dashboard-home__status-card strong {
  font-size: 1.48rem;
  line-height: 1.1;
}

.dashboard-home__status-card p {
  margin: 0;
  color: var(--text-muted);
}

.dashboard-home__status-label,
.dashboard-home__status-link {
  font-size: 0.82rem;
  font-weight: 700;
}

.dashboard-home__status-link {
  color: var(--accent);
}

.dashboard-home__status-card--danger {
  background: linear-gradient(180deg, rgba(155, 59, 42, 0.12), rgba(255, 255, 255, 0.78));
}

.dashboard-home__status-card--warning {
  background: linear-gradient(180deg, rgba(208, 122, 76, 0.14), rgba(255, 255, 255, 0.78));
}

.dashboard-home__status-card--success {
  background: linear-gradient(180deg, rgba(31, 96, 88, 0.12), rgba(255, 255, 255, 0.78));
}

.dashboard-home__status-card--info {
  background: linear-gradient(180deg, rgba(32, 101, 157, 0.12), rgba(255, 255, 255, 0.78));
}

.dashboard-home__status-card--muted {
  background: rgba(255, 255, 255, 0.74);
}

.dashboard-home__main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.8fr);
  gap: 1rem;
}

.dashboard-home__side-stack,
.dashboard-home__resource-grid,
.dashboard-home__signal-list,
.dashboard-home__module-grid,
.dashboard-home__module-list {
  display: grid;
  gap: 1rem;
}

.dashboard-home__panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.dashboard-home__panel-header h2 {
  margin: 0.1rem 0 0;
}

.dashboard-home__panel-meta {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.dashboard-home__meta-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.36rem 0.68rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
}

.dashboard-home__meta-pill--danger {
  background: rgba(155, 59, 42, 0.12);
  color: #8d3325;
}

.dashboard-home__meta-pill--warning {
  background: rgba(208, 122, 76, 0.14);
  color: #a95c23;
}

.dashboard-home__meta-pill--info {
  background: rgba(32, 101, 157, 0.12);
  color: #1f5e91;
}

.dashboard-home__alerts,
.dashboard-home__empty-state {
  min-height: 100%;
}

.dashboard-home__alert-filters {
  display: grid;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.dashboard-home__filter-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.dashboard-home__filter-label {
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  min-width: 4.6rem;
  text-transform: uppercase;
}

.dashboard-home__filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.82rem;
  border-radius: 999px;
  border: 1px solid rgba(22, 59, 54, 0.1);
  background: rgba(255, 255, 255, 0.74);
  color: var(--text-main);
  font-size: 0.84rem;
  font-weight: 700;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.dashboard-home__filter-chip:hover {
  transform: translateY(-1px);
}

.dashboard-home__filter-chip small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  padding: 0.08rem 0.34rem;
  border-radius: 999px;
  background: rgba(22, 59, 54, 0.08);
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
}

.dashboard-home__filter-chip--neutral {
  border-color: rgba(22, 59, 54, 0.12);
}

.dashboard-home__filter-chip--danger {
  border-color: rgba(155, 59, 42, 0.12);
}

.dashboard-home__filter-chip--warning {
  border-color: rgba(208, 122, 76, 0.12);
}

.dashboard-home__filter-chip--category {
  background: rgba(22, 59, 54, 0.04);
}

.dashboard-home__filter-chip--active {
  border-color: rgba(22, 59, 54, 0.3);
  background: rgba(22, 59, 54, 0.1);
}

.dashboard-home__filter-chip--danger.dashboard-home__filter-chip--active {
  border-color: rgba(155, 59, 42, 0.34);
  background: rgba(155, 59, 42, 0.12);
}

.dashboard-home__filter-chip--warning.dashboard-home__filter-chip--active {
  border-color: rgba(208, 122, 76, 0.34);
  background: rgba(208, 122, 76, 0.12);
}

.dashboard-home__filter-reset {
  padding-inline: 0.85rem;
}

.dashboard-home__alert-list {
  display: grid;
  gap: 0.8rem;
}

.dashboard-home__alert-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: center;
  padding: 0.95rem 1rem;
  border-radius: 22px;
  border: 1px solid var(--border-soft);
  background: rgba(22, 59, 54, 0.04);
}

.dashboard-home__alert-item--danger {
  background: rgba(155, 59, 42, 0.06);
  border-color: rgba(155, 59, 42, 0.12);
}

.dashboard-home__alert-item--warning {
  background: rgba(208, 122, 76, 0.08);
  border-color: rgba(208, 122, 76, 0.12);
}

.dashboard-home__alert-mark {
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 59, 54, 0.08);
  color: var(--text-main);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.dashboard-home__alert-body {
  min-width: 0;
}

.dashboard-home__alert-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.dashboard-home__alert-heading strong,
.dashboard-home__module-copy strong {
  display: block;
}

.dashboard-home__alert-heading span,
.dashboard-home__module-copy span,
.dashboard-home__resource-card p {
  color: var(--text-muted);
  font-size: 0.84rem;
}

.dashboard-home__alert-body p,
.dashboard-home__module-copy p {
  margin: 0.32rem 0 0;
  color: var(--text-main);
  word-break: break-word;
}

.dashboard-home__resource-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dashboard-home__resource-card {
  display: grid;
  gap: 0.3rem;
  padding: 1rem;
  border-radius: 20px;
  text-align: left;
}

.dashboard-home__resource-card strong {
  font-size: 1.35rem;
}

.dashboard-home__resource-card p {
  margin: 0;
}

.dashboard-home__signal-list {
  gap: 0.65rem;
}

.dashboard-home__signal-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 18px;
  background: rgba(22, 59, 54, 0.05);
  border: 1px solid var(--border-soft);
}

.dashboard-home__signal-value--success {
  color: var(--accent);
}

.dashboard-home__signal-value--warning {
  color: #a95c23;
}

.dashboard-home__signal-value--danger {
  color: var(--accent-danger);
}

.dashboard-home__signal-value--info {
  color: #1f5e91;
}

.dashboard-home__module-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dashboard-home__module-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.8rem;
  align-items: flex-start;
  padding: 0.95rem 1rem;
  border-radius: 20px;
  text-align: left;
}

.dashboard-home__module-tone {
  width: 0.7rem;
  min-height: 100%;
  border-radius: 999px;
  background: rgba(22, 59, 54, 0.08);
}

.dashboard-home__module-tone--danger {
  background: linear-gradient(180deg, #b04a36, #8d3325);
}

.dashboard-home__module-tone--warning {
  background: linear-gradient(180deg, #d07a4c, #aa5822);
}

.dashboard-home__module-tone--info {
  background: linear-gradient(180deg, #3976a9, #1f5e91);
}

.dashboard-home__module-tone--success {
  background: linear-gradient(180deg, #2f8f84, #1f6058);
}

.dashboard-home__module-tone--muted {
  background: rgba(22, 59, 54, 0.12);
}

.dashboard-home__module-copy {
  min-width: 0;
}

@media (max-width: 1200px) {
  .dashboard-home__status-grid,
  .dashboard-home__module-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .dashboard-home__hero,
  .dashboard-home__main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .dashboard-home__status-grid,
  .dashboard-home__module-grid,
  .dashboard-home__resource-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-home__hero-actions,
  .dashboard-home__panel-header,
  .dashboard-home__alert-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .dashboard-home__filter-label {
    min-width: auto;
  }

  .dashboard-home__alert-item {
    grid-template-columns: 1fr;
  }
}
</style>
