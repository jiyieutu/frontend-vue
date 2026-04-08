<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { userApi } from '../api/users'

const feedback = ref(null)
const loading = ref(false)
const pendingAction = ref('')
const users = ref([])

const filters = reactive({
  keyword: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const userDialog = reactive({
  errorMessage: '',
  mode: 'create',
  open: false,
  submitting: false,
})

const passwordDialog = reactive({
  errorMessage: '',
  open: false,
  submitting: false,
  user: null,
})

const roleDialog = reactive({
  errorMessage: '',
  open: false,
  roles: [],
  submitting: false,
  user: null,
})

const editingUserId = ref(null)

const userForm = reactive(createEmptyUserForm())
const passwordForm = reactive(createEmptyPasswordForm())

const totalPages = computed(() =>
  Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 1))),
)

const userDialogError = computed(() => {
  if (!userForm.userName.trim()) {
    return '请输入用户姓名。'
  }

  if (userDialog.mode === 'create') {
    if (!userForm.userCode.trim()) {
      return '请输入用户账号。'
    }
    if (!userForm.password.trim()) {
      return '请输入用户密码。'
    }
    if (userForm.password !== userForm.confirmPassword) {
      return '两次输入的密码不一致。'
    }
  }

  return ''
})

const passwordDialogError = computed(() => {
  if (!passwordForm.password.trim()) {
    return '请输入新密码。'
  }
  if (passwordForm.password !== passwordForm.confirmPassword) {
    return '两次输入的密码不一致。'
  }
  return ''
})

const selectedRoleCount = computed(() =>
  roleDialog.roles.filter((item) => item.checked).length,
)

onMounted(() => {
  loadUsers(1, true)
})

function createEmptyUserForm() {
  return {
    confirmPassword: '',
    password: '',
    userCode: '',
    userName: '',
  }
}

function createEmptyPasswordForm() {
  return {
    confirmPassword: '',
    password: '',
  }
}

function applyUserForm(value = {}) {
  Object.assign(userForm, createEmptyUserForm(), value)
}

function applyPasswordForm(value = {}) {
  Object.assign(passwordForm, createEmptyPasswordForm(), value)
}

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
    keyword: filters.keyword,
    page,
    pageSize: pagination.pageSize,
  }
}

function buildActionKey(userId, action) {
  return `${userId}:${action}`
}

function isBusy(userId, action) {
  return pendingAction.value === buildActionKey(userId, action)
}

async function loadUsers(page = 1, silent = false) {
  loading.value = true

  try {
    const data = await userApi.list(buildParams(page))
    users.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!users.value.length && !silent) {
      setFeedback('当前筛选条件下没有匹配的用户。', 'warning')
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
  await loadUsers(1)
}

async function resetSearch() {
  filters.keyword = ''
  pagination.page = 1
  await loadUsers(1)
}

async function previousPage() {
  if (pagination.page > 1) {
    await loadUsers(pagination.page - 1)
  }
}

async function nextPage() {
  if (pagination.page < totalPages.value) {
    await loadUsers(pagination.page + 1)
  }
}

function openCreateDialog() {
  editingUserId.value = null
  userDialog.errorMessage = ''
  userDialog.mode = 'create'
  applyUserForm()
  userDialog.open = true
}

async function openEditDialog(item) {
  userDialog.errorMessage = ''
  userDialog.mode = 'edit'

  try {
    const user = await userApi.get(item.id)
    editingUserId.value = item.id
    applyUserForm({
      userCode: user.userCode,
      userName: user.userName,
    })
    userDialog.open = true
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

function closeUserDialog() {
  userDialog.open = false
  userDialog.errorMessage = ''
}

async function submitUserDialog() {
  if (userDialogError.value) {
    return
  }

  userDialog.submitting = true
  userDialog.errorMessage = ''

  try {
    if (userDialog.mode === 'create') {
      await userApi.create({
        confirmPassword: userForm.confirmPassword.trim(),
        password: userForm.password.trim(),
        userCode: userForm.userCode.trim(),
        userName: userForm.userName.trim(),
      })
      setFeedback('用户已新增。', 'success')
    } else {
      await userApi.update(editingUserId.value, {
        userName: userForm.userName.trim(),
      })
      setFeedback('用户已更新。', 'success')
    }

    userDialog.open = false
    await loadUsers(1, true)
  } catch (error) {
    userDialog.errorMessage = error.message
  } finally {
    userDialog.submitting = false
  }
}

function openPasswordDialog(item) {
  passwordDialog.errorMessage = ''
  passwordDialog.open = true
  passwordDialog.user = item
  applyPasswordForm()
}

function closePasswordDialog() {
  passwordDialog.errorMessage = ''
  passwordDialog.open = false
  passwordDialog.user = null
}

async function submitPasswordDialog() {
  if (passwordDialogError.value || !passwordDialog.user?.id) {
    return
  }

  passwordDialog.submitting = true
  passwordDialog.errorMessage = ''

  try {
    await userApi.resetPassword(passwordDialog.user.id, {
      confirmPassword: passwordForm.confirmPassword.trim(),
      password: passwordForm.password.trim(),
    })
    passwordDialog.open = false
    setFeedback(`已重置用户“${passwordDialog.user.userName}”的密码。`, 'success')
  } catch (error) {
    passwordDialog.errorMessage = error.message
  } finally {
    passwordDialog.submitting = false
  }
}

async function openRoleDialog(item) {
  roleDialog.errorMessage = ''
  roleDialog.open = true
  roleDialog.roles = []
  roleDialog.user = null

  try {
    const data = await userApi.roles(item.id)
    roleDialog.user = data.user
    roleDialog.roles = (data.roles || []).map((role) => ({
      ...role,
      checked: Boolean(role.checked),
    }))
  } catch (error) {
    roleDialog.errorMessage = error.message
  }
}

function closeRoleDialog() {
  roleDialog.errorMessage = ''
  roleDialog.open = false
  roleDialog.roles = []
  roleDialog.user = null
}

async function submitRoleDialog() {
  if (!roleDialog.user?.id) {
    return
  }

  roleDialog.submitting = true
  roleDialog.errorMessage = ''

  try {
    await userApi.updateRoles(roleDialog.user.id, {
      roleIds: roleDialog.roles.filter((item) => item.checked).map((item) => item.id),
    })
    roleDialog.open = false
    setFeedback(`已更新用户“${roleDialog.user.userName}”的角色。`, 'success')
    await loadUsers(pagination.page, true)
  } catch (error) {
    roleDialog.errorMessage = error.message
  } finally {
    roleDialog.submitting = false
  }
}

async function deleteUser(item) {
  if (!window.confirm(`确认删除用户“${item.userName}”吗？`)) {
    return
  }

  pendingAction.value = buildActionKey(item.id, 'delete')

  try {
    await userApi.remove(item.id)
    setFeedback(`用户“${item.userName}”已删除。`, 'success')
    await loadUsers(1, true)
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
      <div class="account-toolbar">
        <div>
          <p class="eyebrow">系统管理</p>
          <h1>用户管理</h1>
          <p>参考旧版用户管理页面，支持用户新增、编辑、密码重置和角色分配。</p>
        </div>

        <div class="account-toolbar__summary">
          <span class="metric-card__label">当前总数</span>
          <strong>{{ formatCount(pagination.total) }}</strong>
        </div>
      </div>

      <form class="account-search" @submit.prevent="submitSearch">
        <label class="field field--inline">
          <span class="field__label">关键字</span>
          <input
            v-model.trim="filters.keyword"
            type="text"
            placeholder="按账号或姓名搜索"
          />
        </label>

        <div class="inline-actions">
          <button type="submit" :disabled="loading">查询</button>
          <button type="button" class="ghost" :disabled="loading" @click="resetSearch">重置</button>
          <button type="button" @click="openCreateDialog">新增用户</button>
        </div>
      </form>

      <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`">
        {{ feedback.message }}
      </div>
    </article>

    <article class="panel">
      <div class="panel__toolbar">
        <div>
          <p class="eyebrow">用户列表</p>
          <h2>共 {{ formatCount(pagination.total) }} 个用户</h2>
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
              <th>姓名</th>
              <th>角色</th>
              <th>创建时间</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="empty-cell">正在加载用户列表...</td>
            </tr>
            <tr v-else-if="!users.length">
              <td colspan="6" class="empty-cell">未找到用户数据。</td>
            </tr>
            <tr v-for="item in users" :key="item.id">
              <td>
                <strong>{{ item.userCode }}</strong>
              </td>
              <td>{{ formatValue(item.userName) }}</td>
              <td>
                <div>{{ formatValue(item.roleNames) }}</div>
                <div class="subtle-text">{{ formatCount(item.roleCount) }} 个角色</div>
              </td>
              <td>{{ formatValue(item.createdAt) }}</td>
              <td>{{ formatValue(item.updatedAt) }}</td>
              <td>
                <div class="action-group">
                  <button type="button" class="ghost" @click="openEditDialog(item)">编辑</button>
                  <button type="button" class="ghost" @click="openPasswordDialog(item)">重置密码</button>
                  <button type="button" class="ghost" @click="openRoleDialog(item)">设置角色</button>
                  <button
                    type="button"
                    class="danger"
                    :disabled="isBusy(item.id, 'delete')"
                    @click="deleteUser(item)"
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

    <div v-if="userDialog.open" class="dialog-backdrop" @click.self="closeUserDialog">
      <section class="dialog">
        <header class="dialog__header">
          <div>
            <p class="eyebrow">用户管理</p>
            <h3>{{ userDialog.mode === 'create' ? '新增用户' : '编辑用户' }}</h3>
          </div>
          <button type="button" class="ghost" @click="closeUserDialog">关闭</button>
        </header>

        <div class="dialog__body">
          <label class="field">
            <span class="field__label">账号</span>
            <input
              v-model.trim="userForm.userCode"
              type="text"
              maxlength="20"
              :disabled="userDialog.mode === 'edit'"
              placeholder="请输入账号"
            />
          </label>

          <label class="field">
            <span class="field__label">姓名</span>
            <input v-model.trim="userForm.userName" type="text" maxlength="20" placeholder="请输入姓名" />
          </label>

          <template v-if="userDialog.mode === 'create'">
            <label class="field">
              <span class="field__label">密码</span>
              <input v-model.trim="userForm.password" type="password" placeholder="请输入密码" />
            </label>

            <label class="field">
              <span class="field__label">确认密码</span>
              <input v-model.trim="userForm.confirmPassword" type="password" placeholder="请再次输入密码" />
            </label>
          </template>

          <p v-if="userDialogError || userDialog.errorMessage" class="error-text">
            {{ userDialogError || userDialog.errorMessage }}
          </p>
        </div>

        <footer class="dialog__footer">
          <button type="button" class="ghost" @click="closeUserDialog">取消</button>
          <button type="button" :disabled="userDialog.submitting || !!userDialogError" @click="submitUserDialog">
            {{ userDialog.submitting ? '保存中...' : '保存' }}
          </button>
        </footer>
      </section>
    </div>

    <div v-if="passwordDialog.open" class="dialog-backdrop" @click.self="closePasswordDialog">
      <section class="dialog">
        <header class="dialog__header">
          <div>
            <p class="eyebrow">用户管理</p>
            <h3>重置密码</h3>
          </div>
          <button type="button" class="ghost" @click="closePasswordDialog">关闭</button>
        </header>

        <div class="dialog__body">
          <div class="detail-card">
            <div class="detail-card__header">
              <div>
                <span class="field__label">当前用户</span>
                <p class="subtle-text">
                  {{ passwordDialog.user?.userName || '--' }} / {{ passwordDialog.user?.userCode || '--' }}
                </p>
              </div>
            </div>
          </div>

          <label class="field">
            <span class="field__label">新密码</span>
            <input v-model.trim="passwordForm.password" type="password" placeholder="请输入新密码" />
          </label>

          <label class="field">
            <span class="field__label">确认密码</span>
            <input v-model.trim="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" />
          </label>

          <p v-if="passwordDialogError || passwordDialog.errorMessage" class="error-text">
            {{ passwordDialogError || passwordDialog.errorMessage }}
          </p>
        </div>

        <footer class="dialog__footer">
          <button type="button" class="ghost" @click="closePasswordDialog">取消</button>
          <button
            type="button"
            :disabled="passwordDialog.submitting || !!passwordDialogError"
            @click="submitPasswordDialog"
          >
            {{ passwordDialog.submitting ? '保存中...' : '确认重置' }}
          </button>
        </footer>
      </section>
    </div>

    <div v-if="roleDialog.open" class="dialog-backdrop" @click.self="closeRoleDialog">
      <section class="dialog dialog--wide">
        <header class="dialog__header">
          <div>
            <p class="eyebrow">用户管理</p>
            <h3>设置角色</h3>
          </div>
          <button type="button" class="ghost" @click="closeRoleDialog">关闭</button>
        </header>

        <div class="dialog__body dialog__body--wide">
          <div class="detail-card">
            <div class="detail-card__header">
              <div>
                <span class="field__label">当前用户</span>
                <p class="subtle-text">
                  {{ roleDialog.user?.userName || '--' }} / {{ roleDialog.user?.userCode || '--' }}
                </p>
              </div>
              <span class="pill">已选 {{ selectedRoleCount }}</span>
            </div>
          </div>

          <div class="camera-checklist">
            <label
              v-for="item in roleDialog.roles"
              :key="item.id"
              class="camera-checklist__item"
            >
              <input v-model="item.checked" type="checkbox" />
              <div>
                <strong>{{ item.name }}</strong>
                <div class="subtle-text">{{ item.code || '--' }}</div>
              </div>
            </label>
          </div>

          <p v-if="roleDialog.errorMessage" class="error-text">
            {{ roleDialog.errorMessage }}
          </p>
        </div>

        <footer class="dialog__footer">
          <button type="button" class="ghost" @click="closeRoleDialog">取消</button>
          <button type="button" :disabled="roleDialog.submitting" @click="submitRoleDialog">
            {{ roleDialog.submitting ? '保存中...' : '保存角色' }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>
