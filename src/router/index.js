import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '../layouts/AppShell.vue'
import BackupAccountView from '../views/BackupAccountView.vue'
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
import ManagedStorageCenterView from '../views/ManagedStorageCenterView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import OperationLogView from '../views/OperationLogView.vue'
import PlanListView from '../views/PlanListView.vue'
import RoleManagementView from '../views/RoleManagementView.vue'
import SettingsView from '../views/SettingsView.vue'
import UserManagementView from '../views/UserManagementView.vue'
import VideoRebackTaskView from '../views/VideoRebackTaskView.vue'

import AssetCatalogView from '../views/AssetCatalogView.vue'
import RepositoryCatalogView from '../views/RepositoryCatalogView.vue'
import PolicyCatalogView from '../views/PolicyCatalogView.vue'
import PlatformBackupView from '../views/PlatformBackupView.vue'
import PlatformRestoreView from '../views/PlatformRestoreView.vue'
import PlatformJobCenterView from '../views/PlatformJobCenterView.vue'
import PlatformProgressView from '../views/PlatformProgressView.vue'
import PlatformLogsView from '../views/PlatformLogsView.vue'
import PlatformOperationsView from '../views/PlatformOperationsView.vue'
import PlatformReportTemplateView from '../views/PlatformReportTemplateView.vue'
import PlatformDeadLettersView from '../views/PlatformDeadLettersView.vue'
import PlatformEnterpriseWorkloadView from '../views/PlatformEnterpriseWorkloadView.vue'
import BackupCenterOverviewView from '../views/BackupCenterOverviewView.vue'

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
          path: 'backup-accounts',
          name: 'backup-accounts',
          component: BackupAccountView,
          meta: { requiresAuth: true, title: '存储节点配置' },
        },
        {
          path: 'backup-files',
          name: 'backup-files',
          component: BackupFileView,
          meta: { requiresAuth: true, title: '备份资产台账' },
        },
        {
          path: 'archive-files',
          name: 'archive-files',
          component: ArchiveFileView,
          meta: { requiresAuth: true, title: '档案归集管理' },
        },
        {
          path: 'nas-targets',
          redirect: { name: 'backup-accounts' },
        },
        {
          path: 'storage-center',
          name: 'storage-center',
          component: ManagedStorageCenterView,
          meta: { requiresAuth: true, title: 'JuiceFS管理页' },
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
          meta: { requiresAuth: true, title: '任务计划' },
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
          meta: { requiresAuth: true, title: '回迁任务' },
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
          path: 'backup-center',
          name: 'backup-center',
          component: BackupCenterOverviewView,
          meta: { requiresAuth: true, title: '备份中心首页' },
        },
        {
          path: 'platform/assets',
          name: 'platform-assets',
          component: AssetCatalogView,
          meta: { requiresAuth: true, title: '资产管理页' },
        },
        {
          path: 'platform/repositories',
          name: 'platform-repositories',
          component: RepositoryCatalogView,
          meta: { requiresAuth: true, title: '仓库管理页' },
        },
        {
          path: 'platform/policies',
          name: 'platform-policies',
          component: PolicyCatalogView,
          meta: { requiresAuth: true, title: '策略管理页' },
        },
        {
          path: 'platform/jobs',
          name: 'platform-jobs',
          component: PlatformJobCenterView,
          meta: { requiresAuth: true, title: '任务中心页' },
        },
        {
          path: 'platform/backup',
          name: 'platform-backup',
          component: PlatformBackupView,
          meta: { requiresAuth: true, title: '备份页' },
        },
        {
          path: 'platform/restore',
          name: 'platform-restore',
          component: PlatformRestoreView,
          meta: { requiresAuth: true, title: '恢复页' },
        },
        {
          path: 'platform/progress',
          name: 'platform-progress',
          component: PlatformProgressView,
          meta: { requiresAuth: true, title: '进度页' },
        },
        {
          path: 'platform/logs',
          name: 'platform-logs',
          component: PlatformLogsView,
          meta: { requiresAuth: true, title: '日志页' },
        },
        {
          path: 'platform/operations',
          name: 'platform-operations',
          component: PlatformOperationsView,
          meta: { requiresAuth: true, title: '平台运营大屏' },
        },
        {
          path: 'platform/report-templates',
          name: 'platform-report-templates',
          component: PlatformReportTemplateView,
          meta: { requiresAuth: true, title: '报表模板设计' },
        },
        {
          path: 'platform/dead-letters',
          name: 'platform-dead-letters',
          component: PlatformDeadLettersView,
          meta: { requiresAuth: true, title: 'Webhook死信处理台' },
        },
        {
          path: 'platform/enterprise',
          name: 'platform-enterprise',
          component: PlatformEnterpriseWorkloadView,
          meta: { requiresAuth: true, title: 'P1/P2企业级能力' },
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
