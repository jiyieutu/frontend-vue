import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '../layouts/AppShell.vue'
import { hasSession } from '../lib/session'
import AccountView from '../views/AccountView.vue'
import ArchiveFileView from '../views/ArchiveFileView.vue'
import BackupFileView from '../views/BackupFileView.vue'
import DashboardView from '../views/DashboardView.vue'
import DiscMagazineView from '../views/DiscMagazineView.vue'
import FileListView from '../views/FileListView.vue'
import LegacyView from '../views/LegacyView.vue'
import LoginLogView from '../views/LoginLogView.vue'
import LoginView from '../views/LoginView.vue'
import NasTargetView from '../views/NasTargetView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import OperationLogView from '../views/OperationLogView.vue'
import PlanListView from '../views/PlanListView.vue'
import RoleManagementView from '../views/RoleManagementView.vue'
import SettingsView from '../views/SettingsView.vue'
import UserManagementView from '../views/UserManagementView.vue'
import VideoRebackTaskView from '../views/VideoRebackTaskView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: { name: 'dashboard' },
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView,
          meta: { requiresAuth: true, title: '工作台' },
        },
        {
          path: 'accounts',
          name: 'accounts',
          component: AccountView,
          meta: { requiresAuth: true, title: '视频平台管理' },
        },
        {
          path: 'cameras',
          name: 'cameras',
          component: AccountView,
          meta: { requiresAuth: true, title: '摄像头管理' },
        },
        {
          path: 'backup-files',
          name: 'backup-files',
          component: BackupFileView,
          meta: { requiresAuth: true, title: '备份文件管理' },
        },
        {
          path: 'archive-files',
          name: 'archive-files',
          component: ArchiveFileView,
          meta: { requiresAuth: true, title: '归档文件管理' },
        },
        {
          path: 'nas-targets',
          name: 'nas-targets',
          component: NasTargetView,
          meta: { requiresAuth: true, title: 'NAS 管理' },
        },
        {
          path: 'storage-targets',
          name: 'storage-targets',
          component: AccountView,
          meta: { requiresAuth: true, title: '存储设备管理' },
        },
        {
          path: 'disc-magazines',
          name: 'disc-magazines',
          component: DiscMagazineView,
          meta: { requiresAuth: true, title: '光盘匣管理' },
        },
        {
          path: 'plans',
          name: 'plans',
          component: PlanListView,
          meta: { requiresAuth: true, title: '采集计划' },
        },
        {
          path: 'files',
          name: 'files',
          component: FileListView,
          meta: { requiresAuth: true, title: '文件管理' },
        },
        {
          path: 'video-reback-tasks',
          name: 'video-reback-tasks',
          component: VideoRebackTaskView,
          meta: { requiresAuth: true, title: '视频回迁任务' },
        },
        {
          path: 'settings',
          redirect: { name: 'system-management' },
        },
        {
          path: 'system-management',
          name: 'system-management',
          component: SettingsView,
          meta: { requiresAuth: true, title: '系统参数' },
        },
        {
          path: 'users',
          name: 'users',
          component: UserManagementView,
          meta: { requiresAuth: true, title: '用户管理' },
        },
        {
          path: 'roles',
          name: 'roles',
          component: RoleManagementView,
          meta: { requiresAuth: true, title: '角色管理' },
        },
        {
          path: 'operation-logs',
          name: 'operation-logs',
          component: OperationLogView,
          meta: { requiresAuth: true, title: '操作日志' },
        },
        {
          path: 'login-logs',
          name: 'login-logs',
          component: LoginLogView,
          meta: { requiresAuth: true, title: '登录日志' },
        },
        {
          path: 'legacy',
          name: 'legacy',
          component: LegacyView,
          meta: { requiresAuth: true, title: '旧版模块' },
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { guestOnly: true, title: '登录' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
      meta: { title: '页面不存在' },
    },
  ],
})

router.beforeEach((to) => {
  const loggedIn = hasSession()

  if (to.meta.requiresAuth && !loggedIn) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.guestOnly && loggedIn) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
