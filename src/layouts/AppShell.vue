<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { authApi } from '../api/auth'
import { menuApi } from '../api/menu'
import MenuTree from '../components/MenuTree.vue'
import PasswordDialog from '../components/PasswordDialog.vue'
import { appTitle, legacyBaseUrl } from '../lib/config'
import { clearSession, sessionState, setUser } from '../lib/session'

const route = useRoute()
const router = useRouter()

const banner = ref(null)
const booting = ref(true)
const clock = ref(formatClock(new Date()))
const menus = ref([])
const passwordDialogOpen = ref(false)
const passwordError = ref('')
const passwordSubmitting = ref(false)
const refreshingMenus = ref(false)

let clockTimer = 0

const systemManagementRoutePaths = new Set([
  '/system-management',
  '/users',
  '/roles',
  '/operation-logs',
  '/login-logs',
])

const currentLegacyPath = computed(() =>
  typeof route.query.path === 'string' ? route.query.path : '',
)

const isSystemManagementWorkspace = computed(() =>
  systemManagementRoutePaths.has(route.path),
)

const sidebarMenus = computed(() =>
  isSystemManagementWorkspace.value ? createSystemManagementMenus() : menus.value,
)

const currentUserCode = computed(() => sessionState.user?.userCode || '--')
const currentUserName = computed(
  () => sessionState.user?.userName || sessionState.user?.userCode || '操作员',
)

const pageTitle = computed(() => {
  if (route.name === 'legacy') {
    return typeof route.query.title === 'string' && route.query.title
      ? route.query.title
      : '旧版模块'
  }

  return typeof route.meta.title === 'string' ? route.meta.title : '工作台'
})

onMounted(async () => {
  clockTimer = window.setInterval(() => {
    clock.value = formatClock(new Date())
  }, 1000)

  await bootstrap()
})

onBeforeUnmount(() => {
  window.clearInterval(clockTimer)
})

async function bootstrap() {
  booting.value = true

  try {
    const [user, menuTree] = await Promise.all([authApi.me(), menuApi.list()])
    setUser(user)
    menus.value = mergeBuiltinMenus(filterMenus(normalizeMenus(menuTree)))
  } catch (error) {
    setBanner(error.message, 'danger')
  } finally {
    booting.value = false
  }
}

async function logout() {
  try {
    await authApi.logout()
  } catch (error) {
    // Ignore logout network failures and clear the client session anyway.
  }

  clearSession()
  router.replace({ name: 'login' })
}

async function refreshMenus() {
  refreshingMenus.value = true

  try {
    menus.value = mergeBuiltinMenus(filterMenus(normalizeMenus(await menuApi.list())))
    setBanner('菜单已刷新。', 'success')
  } catch (error) {
    setBanner(error.message, 'danger')
  } finally {
    refreshingMenus.value = false
  }
}

function goToSystemManagement() {
  const systemManagementUrl = router.resolve({ name: 'system-management' }).href
  window.open(systemManagementUrl, '_blank', 'noopener')
}

function openPasswordDialog() {
  passwordError.value = ''
  passwordDialogOpen.value = true
}

async function submitPassword(payload) {
  passwordSubmitting.value = true
  passwordError.value = ''

  try {
    await authApi.changePassword(payload)
    passwordDialogOpen.value = false
    setBanner('密码修改成功。', 'success')
  } catch (error) {
    passwordError.value = error.message
  } finally {
    passwordSubmitting.value = false
  }
}

function navigateNode(node) {
  if (node.target === 'new_window' && node.legacyPath) {
    const externalUrl = buildLegacyUrl(node.legacyPath)
    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener')
      return
    }
  }

  if (node.routePath === '/legacy') {
    router.push({
      name: 'legacy',
      query: {
        title: node.title,
        path: node.legacyPath,
      },
    })
    return
  }

  if (node.routePath) {
    router.push(node.routePath)
  }
}

function buildLegacyUrl(path) {
  if (!path || !legacyBaseUrl) {
    return ''
  }

  if (/^https?:\/\//.test(path)) {
    return path
  }

  return `${legacyBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function normalizeMenus(nodes, depth = 0) {
  return (nodes || []).map((node) => ({
    ...node,
    expanded: depth < 1,
    children: normalizeMenus(node.children || [], depth + 1),
  }))
}

function filterMenus(nodes) {
  return (nodes || [])
    .map((node) => ({
      ...node,
      children: filterMenus(node.children || []),
    }))
    .filter((node) => {
      if (isScreenNode(node) || isVideoReprintNode(node) || isSystemManagementNode(node)) {
        return false
      }

      return node.children.length > 0 || Boolean(node.legacyPath || node.routePath)
    })
}

function mergeBuiltinMenus(nodes) {
  const result = [...(nodes || [])]
  const builtins = [
    createBuiltinNode('builtin-platforms', '视频平台管理', '/accounts'),
    createBuiltinNode('builtin-cameras', '摄像头管理', '/cameras'),
    createBuiltinNode('builtin-backup-files', '备份文件管理', '/backup-files'),
    createBuiltinNode('builtin-archive-files', '归档文件管理', '/archive-files'),
    createBuiltinNode('builtin-nas-targets', 'NAS 管理', '/nas-targets'),
    createBuiltinNode('builtin-disc-magazines', '光盘匣管理', '/disc-magazines'),
    createBuiltinNode('builtin-storage-targets', '存储设备管理', '/storage-targets'),
    createBuiltinNode('builtin-video-reback-tasks', '视频回迁任务', '/video-reback-tasks'),
  ]

  builtins.forEach((node) => {
    if (!hasRoute(result, node.routePath)) {
      result.push(node)
    }
  })

  return result
}

function hasRoute(nodes, routePath) {
  return (nodes || []).some((node) => {
    if (node.routePath === routePath) {
      return true
    }

    return hasRoute(node.children || [], routePath)
  })
}

function createBuiltinNode(id, title, routePath) {
  return {
    children: [],
    expanded: false,
    icon: '&#xe695;',
    id,
    legacyPath: '',
    migrated: true,
    routePath,
    target: 'navtab',
    title,
  }
}

function createSystemManagementMenus() {
  return [
    {
      children: [
        createBuiltinNode('builtin-system-home', '系统参数', '/system-management'),
        createBuiltinNode('builtin-users', '用户管理', '/users'),
        createBuiltinNode('builtin-roles', '角色管理', '/roles'),
        createBuiltinNode('builtin-operation-logs', '操作日志', '/operation-logs'),
        createBuiltinNode('builtin-login-logs', '登录日志', '/login-logs'),
      ],
      expanded: true,
      icon: '&#xe695;',
      id: 'builtin-system-root',
      legacyPath: '',
      migrated: true,
      routePath: '',
      target: 'navtab',
      title: '系统管理',
    },
  ]
}

function isScreenNode(node) {
  const legacyPath = normalizeMenuValue(node.legacyPath)
  const routePath = normalizeMenuValue(node.routePath)
  const title = normalizeMenuValue(node.title)

  return (
    legacyPath.startsWith('/screen') ||
    legacyPath.startsWith('screen/') ||
    legacyPath.startsWith('/vtsd/screen') ||
    routePath.startsWith('/screen') ||
    title.includes('录屏') ||
    title.includes('screen')
  )
}

function isVideoReprintNode(node) {
  const legacyPath = normalizeMenuValue(node.legacyPath)
  const routePath = normalizeMenuValue(node.routePath)
  const title = normalizeMenuValue(node.title)

  return (
    legacyPath.includes('/vtsd/appreprinttask') ||
    routePath.includes('/video-reprint') ||
    title.includes('视频转载')
  )
}

function isSystemManagementNode(node) {
  const legacyPath = normalizeMenuValue(node.legacyPath)
  const routePath = normalizeMenuValue(node.routePath)
  const title = normalizeMenuValue(node.title)

  return (
    legacyPath.startsWith('/admin/user') ||
    legacyPath.startsWith('/admin/role') ||
    legacyPath.startsWith('/admin/operlogs') ||
    legacyPath.startsWith('/admin/loginlog') ||
    legacyPath.startsWith('/admin/params') ||
    legacyPath.startsWith('/admin/setting') ||
    routePath === '/settings' ||
    routePath === '/system-management' ||
    routePath === '/users' ||
    routePath === '/roles' ||
    routePath === '/operation-logs' ||
    routePath === '/login-logs' ||
    title.includes('系统管理') ||
    title.includes('系统设置') ||
    title.includes('用户管理') ||
    title.includes('角色管理') ||
    title.includes('操作日志') ||
    title.includes('登录日志')
  )
}

function normalizeMenuValue(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function setBanner(message, tone = 'info') {
  banner.value = message
    ? {
        message,
        tone,
      }
    : null
}

function formatClock(date) {
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
  <div class="shell">
    <aside class="shell__sidebar">
      <div class="brand">
        <p class="brand__eyebrow">视频采集管理平台</p>
        <h1>{{ appTitle }}</h1>
        <p class="brand__copy">统一管理视频平台、摄像头、NAS、存储设备和系统配置。</p>
      </div>

      <div class="shell__sidebar-meta">
        <span class="pill">API 会话</span>
        <span class="clock">{{ clock }}</span>
      </div>

      <div v-if="booting" class="shell__menu shell__menu--loading">
        <div v-for="index in 7" :key="index" class="skeleton-line"></div>
      </div>

      <div v-else class="shell__menu">
        <MenuTree
          :nodes="sidebarMenus"
          :current-path="route.path"
          :current-legacy-path="currentLegacyPath"
          @navigate="navigateNode"
        />
      </div>
    </aside>

    <div class="shell__main">
      <header class="shell__topbar">
        <div>
          <p class="eyebrow">当前位置</p>
          <h2>{{ pageTitle }}</h2>
        </div>

        <div class="shell__topbar-actions">
          <button type="button" class="ghost" :disabled="refreshingMenus" @click="refreshMenus">
            {{ refreshingMenus ? '刷新中...' : '刷新菜单' }}
          </button>
          <button type="button" class="ghost" @click="openPasswordDialog">修改密码</button>
          <button
            v-if="!isSystemManagementWorkspace"
            type="button"
            class="ghost"
            @click="goToSystemManagement"
          >
            系统管理
          </button>
          <div class="user-chip">
            <strong>{{ currentUserName }}</strong>
            <span>{{ currentUserCode }}</span>
          </div>
          <button type="button" class="danger" @click="logout">退出登录</button>
        </div>
      </header>

      <div v-if="banner" class="banner" :class="`banner--${banner.tone}`">
        {{ banner.message }}
      </div>

      <main class="shell__content">
        <RouterView />
      </main>
    </div>

    <PasswordDialog
      :open="passwordDialogOpen"
      :submitting="passwordSubmitting"
      :error-message="passwordError"
      @close="passwordDialogOpen = false"
      @submit="submitPassword"
    />
  </div>
</template>
