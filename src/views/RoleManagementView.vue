<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { roleApi } from '../api/roles'

const feedback = ref(null)
const loading = ref(false)
const pendingAction = ref('')
const roles = ref([])

const filters = reactive({
  keyword: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const roleDialog = reactive({
  errorMessage: '',
  mode: 'create',
  open: false,
  submitting: false,
})

const permissionDialog = reactive({
  errorMessage: '',
  items: [],
  open: false,
  role: null,
  submitting: false,
})

const editingRoleId = ref(null)

const roleForm = reactive(createEmptyRoleForm())

const totalPages = computed(() =>
  Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 1))),
)

const selectedPermissionCount = computed(() =>
  permissionDialog.items.filter((item) => item.checked).length,
)

const roleDialogError = computed(() => {
  if (roleDialog.mode === 'create') {
    if (!roleForm.roleName.trim()) {
      return '请输入角色名称。'
    }
    if (!roleForm.roleCode.trim()) {
      return '请输入角色编码。'
    }
  }

  return ''
})

onMounted(() => {
  loadRoles(1, true)
})

function createEmptyRoleForm() {
  return {
    enable: 1,
    note: '',
    roleCode: '',
    roleName: '',
  }
}

function applyRoleForm(value = {}) {
  Object.assign(roleForm, createEmptyRoleForm(), value)
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

function formatStatusLabel(enabled) {
  return Number(enabled) === 1 ? '启用' : '禁用'
}

function formatStatusClass(enabled) {
  return Number(enabled) === 1 ? 'status-pill--active' : 'status-pill--idle'
}

function buildParams(page = pagination.page) {
  return {
    keyword: filters.keyword,
    page,
    pageSize: pagination.pageSize,
  }
}

function buildActionKey(roleId, action) {
  return `${roleId}:${action}`
}

function isBusy(roleId, action) {
  return pendingAction.value === buildActionKey(roleId, action)
}

async function loadRoles(page = 1, silent = false) {
  loading.value = true

  try {
    const data = await roleApi.list(buildParams(page))
    roles.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!roles.value.length && !silent) {
      setFeedback('当前筛选条件下没有匹配的角色。', 'warning')
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
  await loadRoles(1)
}

async function resetSearch() {
  filters.keyword = ''
  pagination.page = 1
  await loadRoles(1)
}

async function previousPage() {
  if (pagination.page > 1) {
    await loadRoles(pagination.page - 1)
  }
}

async function nextPage() {
  if (pagination.page < totalPages.value) {
    await loadRoles(pagination.page + 1)
  }
}

function openCreateDialog() {
  editingRoleId.value = null
  roleDialog.errorMessage = ''
  roleDialog.mode = 'create'
  applyRoleForm()
  roleDialog.open = true
}

async function openEditDialog(item) {
  roleDialog.errorMessage = ''
  roleDialog.mode = 'edit'

  try {
    const role = await roleApi.get(item.id)
    editingRoleId.value = item.id
    applyRoleForm({
      enable: Number(role.enable ?? 1),
      note: role.note || '',
      roleCode: role.roleCode || '',
      roleName: role.roleName || '',
    })
    roleDialog.open = true
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

function closeRoleDialog() {
  roleDialog.errorMessage = ''
  roleDialog.open = false
}

async function submitRoleDialog() {
  if (roleDialogError.value) {
    return
  }

  roleDialog.submitting = true
  roleDialog.errorMessage = ''

  try {
    if (roleDialog.mode === 'create') {
      await roleApi.create({
        enable: Number(roleForm.enable),
        note: roleForm.note.trim(),
        roleCode: roleForm.roleCode.trim(),
        roleName: roleForm.roleName.trim(),
      })
      setFeedback('角色已新增。', 'success')
    } else {
      await roleApi.update(editingRoleId.value, {
        enable: Number(roleForm.enable),
        note: roleForm.note.trim(),
      })
      setFeedback('角色已更新。', 'success')
    }

    roleDialog.open = false
    await loadRoles(1, true)
  } catch (error) {
    roleDialog.errorMessage = error.message
  } finally {
    roleDialog.submitting = false
  }
}

async function openPermissionDialog(item) {
  permissionDialog.errorMessage = ''
  permissionDialog.items = []
  permissionDialog.open = true
  permissionDialog.role = null

  try {
    const data = await roleApi.permissions(item.id)
    permissionDialog.role = data.role
    permissionDialog.items = flattenPermissionNodes(data.menus || [])
  } catch (error) {
    permissionDialog.errorMessage = error.message
  }
}

function closePermissionDialog() {
  permissionDialog.errorMessage = ''
  permissionDialog.items = []
  permissionDialog.open = false
  permissionDialog.role = null
}

function flattenPermissionNodes(nodes, depth = 0, parentId = 0, result = []) {
  ;(nodes || []).forEach((node) => {
    const nextId = Number(node.id)
    result.push({
      checked: Boolean(node.checked),
      depth,
      id: nextId,
      legacyPath: node.legacyPath || '',
      parentId: Number(node.parentId ?? parentId),
      title: node.title || '--',
    })

    flattenPermissionNodes(node.children || [], depth + 1, nextId, result)
  })

  return result
}

function childrenOf(parentId) {
  return permissionDialog.items.filter((item) => item.parentId === parentId)
}

function findPermission(id) {
  return permissionDialog.items.find((item) => item.id === id)
}

function setDescendantsChecked(parentId, checked) {
  childrenOf(parentId).forEach((item) => {
    item.checked = checked
    setDescendantsChecked(item.id, checked)
  })
}

function syncParentState(parentId) {
  let currentParentId = Number(parentId || 0)

  while (currentParentId > 0) {
    const parent = findPermission(currentParentId)
    if (!parent) {
      break
    }

    const hasCheckedChild = childrenOf(currentParentId).some((item) => item.checked)
    parent.checked = hasCheckedChild
    currentParentId = Number(parent.parentId || 0)
  }
}

function togglePermission(item) {
  setDescendantsChecked(item.id, item.checked)
  syncParentState(item.parentId)

  if (item.checked) {
    let currentParentId = Number(item.parentId || 0)
    while (currentParentId > 0) {
      const parent = findPermission(currentParentId)
      if (!parent) {
        break
      }
      parent.checked = true
      currentParentId = Number(parent.parentId || 0)
    }
  }
}

async function submitPermissionDialog() {
  if (!permissionDialog.role?.id) {
    return
  }

  permissionDialog.submitting = true
  permissionDialog.errorMessage = ''

  try {
    await roleApi.updatePermissions(permissionDialog.role.id, {
      menuIds: permissionDialog.items.filter((item) => item.checked).map((item) => item.id),
    })
    permissionDialog.open = false
    setFeedback(`已更新角色“${permissionDialog.role.roleName}”的权限。`, 'success')
  } catch (error) {
    permissionDialog.errorMessage = error.message
  } finally {
    permissionDialog.submitting = false
  }
}

async function deleteRole(item) {
  if (!window.confirm(`确认删除角色“${item.roleName}”吗？`)) {
    return
  }

  pendingAction.value = buildActionKey(item.id, 'delete')

  try {
    await roleApi.remove(item.id)
    setFeedback(`角色“${item.roleName}”已删除。`, 'success')
    await loadRoles(1, true)
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
          <h1>角色管理</h1>
          <p>参考旧版角色页面，支持角色新增、启停配置和菜单权限分配。</p>
        </div>

        <div class="account-toolbar__summary">
          <span class="metric-card__label">当前总数</span>
          <strong>{{ formatCount(pagination.total) }}</strong>
        </div>
      </div>

      <form class="account-search" @submit.prevent="submitSearch">
        <label class="field field--inline">
          <span class="field__label">关键字</span>
          <input v-model.trim="filters.keyword" type="text" placeholder="按角色名称或编码搜索" />
        </label>

        <div class="inline-actions">
          <button type="submit" :disabled="loading">查询</button>
          <button type="button" class="ghost" :disabled="loading" @click="resetSearch">重置</button>
          <button type="button" @click="openCreateDialog">新增角色</button>
        </div>
      </form>

      <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`">
        {{ feedback.message }}
      </div>
    </article>

    <article class="panel">
      <div class="panel__toolbar">
        <div>
          <p class="eyebrow">角色列表</p>
          <h2>共 {{ formatCount(pagination.total) }} 个角色</h2>
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
              <th>角色名称</th>
              <th>角色编码</th>
              <th>状态</th>
              <th>说明</th>
              <th>用户数</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="empty-cell">正在加载角色列表...</td>
            </tr>
            <tr v-else-if="!roles.length">
              <td colspan="7" class="empty-cell">未找到角色数据。</td>
            </tr>
            <tr v-for="item in roles" :key="item.id">
              <td>
                <strong>{{ item.roleName }}</strong>
                <div v-if="item.systemRole" class="subtle-text">系统角色</div>
              </td>
              <td>{{ formatValue(item.roleCode) }}</td>
              <td>
                <span class="status-pill" :class="formatStatusClass(item.enable)">
                  {{ formatStatusLabel(item.enable) }}
                </span>
              </td>
              <td>{{ formatValue(item.note) }}</td>
              <td>{{ formatCount(item.userCount) }}</td>
              <td>{{ formatValue(item.updatedAt) }}</td>
              <td>
                <div class="action-group">
                  <button type="button" class="ghost" @click="openEditDialog(item)">编辑</button>
                  <button type="button" class="ghost" @click="openPermissionDialog(item)">权限</button>
                  <button
                    type="button"
                    class="danger"
                    :disabled="isBusy(item.id, 'delete')"
                    @click="deleteRole(item)"
                  >
                    {{ isBusy(item.id, 'delete') ? '删除中...' : '删除' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="panel__footer" style="display: flex; justify-content: flex-end; margin-top: 1rem;">
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
    </article>

    <div v-if="roleDialog.open" class="dialog-backdrop" @click.self="closeRoleDialog">
      <section class="dialog">
        <header class="dialog__header">
          <div>
            <p class="eyebrow">角色管理</p>
            <h3>{{ roleDialog.mode === 'create' ? '新增角色' : '编辑角色' }}</h3>
          </div>
          <button type="button" class="ghost" @click="closeRoleDialog">关闭</button>
        </header>

        <div class="dialog__body">
          <label class="field">
            <span class="field__label">角色名称</span>
            <input
              v-model.trim="roleForm.roleName"
              type="text"
              maxlength="20"
              :disabled="roleDialog.mode === 'edit'"
              placeholder="请输入角色名称"
            />
          </label>

          <label class="field">
            <span class="field__label">角色编码</span>
            <input
              v-model.trim="roleForm.roleCode"
              type="text"
              maxlength="20"
              :disabled="roleDialog.mode === 'edit'"
              placeholder="请输入角色编码"
            />
          </label>

          <label class="field">
            <span class="field__label">状态</span>
            <select v-model="roleForm.enable" class="select-field">
              <option :value="1">启用</option>
              <option :value="0">禁用</option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">说明</span>
            <input v-model.trim="roleForm.note" type="text" placeholder="选填" />
          </label>

          <p v-if="roleDialogError || roleDialog.errorMessage" class="error-text">
            {{ roleDialogError || roleDialog.errorMessage }}
          </p>
        </div>

        <footer class="dialog__footer">
          <button type="button" class="ghost" @click="closeRoleDialog">取消</button>
          <button type="button" :disabled="roleDialog.submitting || !!roleDialogError" @click="submitRoleDialog">
            {{ roleDialog.submitting ? '保存中...' : '保存' }}
          </button>
        </footer>
      </section>
    </div>

    <div v-if="permissionDialog.open" class="dialog-backdrop" @click.self="closePermissionDialog">
      <section class="dialog dialog--wide">
        <header class="dialog__header">
          <div>
            <p class="eyebrow">角色管理</p>
            <h3>权限配置</h3>
          </div>
          <button type="button" class="ghost" @click="closePermissionDialog">关闭</button>
        </header>

        <div class="dialog__body dialog__body--wide">
          <div class="detail-card">
            <div class="detail-card__header">
              <div>
                <span class="field__label">当前角色</span>
                <p class="subtle-text">
                  {{ permissionDialog.role?.roleName || '--' }} / {{ permissionDialog.role?.roleCode || '--' }}
                </p>
              </div>
              <span class="pill">已选 {{ selectedPermissionCount }}</span>
            </div>
          </div>

          <div class="permission-list">
            <label
              v-for="item in permissionDialog.items"
              :key="item.id"
              class="permission-list__item"
              :style="{ paddingLeft: `${16 + item.depth * 24}px` }"
            >
              <input v-model="item.checked" type="checkbox" @change="togglePermission(item)" />
              <div>
                <strong>{{ item.title }}</strong>
                <div v-if="item.legacyPath" class="subtle-text">{{ item.legacyPath }}</div>
              </div>
            </label>
          </div>

          <p v-if="permissionDialog.errorMessage" class="error-text">
            {{ permissionDialog.errorMessage }}
          </p>
        </div>

        <footer class="dialog__footer">
          <button type="button" class="ghost" @click="closePermissionDialog">取消</button>
          <button type="button" :disabled="permissionDialog.submitting" @click="submitPermissionDialog">
            {{ permissionDialog.submitting ? '保存中...' : '保存权限' }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>
