<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { planApi } from '../api/plans'
import PlanDialog from '../components/PlanDialog.vue'

const router = useRouter()

const feedback = ref(null)
const loading = ref(false)
const detailLoading = ref(false)
const selectedPlan = ref(null)
const pendingSelectionId = ref(null)
const plans = ref([])
const planDetails = ref([])
const availableCameras = ref([])

const formOptions = reactive({
  accounts: [],
  storageGroups: [],
})

const dialogState = reactive({
  errorMessage: '',
  mode: 'create',
  open: false,
  submitting: false,
})

const dialogValue = ref(buildEmptyPlanValue())

const filters = reactive({
  accountTitle: '',
  endDateTo: '',
  onlyUnfinished: true,
  startDateFrom: '',
  title: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 12,
  total: 0,
})

const detailPagination = reactive({
  page: 1,
  pageSize: 8,
  total: 0,
})

const totalPages = computed(() => Math.max(1, Math.ceil(pagination.total / pagination.pageSize)))
const detailTotalPages = computed(() => Math.max(1, Math.ceil(detailPagination.total / detailPagination.pageSize)))

loadPlanOptions()
loadPlans()

function buildEmptyPlanValue() {
  const today = formatToday()
  const firstStorageGroup = formOptions.storageGroups[0]

  return {
    accountId: formOptions.accounts[0] ? String(formOptions.accounts[0].id) : '',
    cameraIds: [],
    endDate: today,
    endHour: '23',
    endMinute: '59',
    noteInfo: '',
    runType: 0,
    startDate: today,
    startHour: '00',
    startMinute: '00',
    storageId: firstStorageGroup?.items?.[0] ? String(firstStorageGroup.items[0].id) : '',
    storageType: firstStorageGroup ? String(firstStorageGroup.type) : '',
    title: '',
  }
}

function buildPlanParams(page = pagination.page) {
  return {
    accountTitle: filters.accountTitle,
    endDateTo: filters.endDateTo,
    onlyUnfinished: filters.onlyUnfinished,
    page,
    pageSize: pagination.pageSize,
    startDateFrom: filters.startDateFrom,
    title: filters.title,
  }
}

function formatToday() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
}

function translateRunTypeLabel(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'one-time') {
    return '单次'
  }
  if (normalized === 'cycle') {
    return '循环'
  }

  return value || '--'
}

function translateStatusLabel(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  const normalized = String(value).trim().toLowerCase()
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

  return labelMap[normalized] || String(value)
}

async function ensurePlanOptions() {
  if (formOptions.accounts.length || formOptions.storageGroups.length) {
    return
  }

  await loadPlanOptions()
}

async function loadPlanOptions() {
  try {
    const data = await planApi.options()
    formOptions.accounts = data.accounts || []
    formOptions.storageGroups = data.storageTargetGroups || []
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

async function loadPlans(page = 1) {
  loading.value = true

  try {
    const data = await planApi.list(buildPlanParams(page))
    plans.value = data.items
    pagination.page = data.page
    pagination.pageSize = data.pageSize
    pagination.total = data.total

    if (!plans.value.length) {
      selectedPlan.value = null
      planDetails.value = []
      detailPagination.page = 1
      detailPagination.total = 0
      setFeedback('当前筛选条件下没有匹配的采集计划。', 'warning')
      return
    }

    const targetId = pendingSelectionId.value || selectedPlan.value?.id
    if (targetId && plans.value.some((item) => item.id === targetId)) {
      selectedPlan.value = plans.value.find((item) => item.id === targetId)
    } else {
      selectedPlan.value = plans.value[0]
    }
    pendingSelectionId.value = null

    if (feedback.value?.tone === 'warning') {
      setFeedback('')
    }

    await loadPlanDetails(1)
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    loading.value = false
  }
}

async function loadPlanDetails(page = 1) {
  if (!selectedPlan.value) {
    planDetails.value = []
    detailPagination.page = 1
    detailPagination.total = 0
    return
  }

  detailLoading.value = true

  try {
    const data = await planApi.details(selectedPlan.value.id, {
      page,
      pageSize: detailPagination.pageSize,
    })
    planDetails.value = data.items
    detailPagination.page = data.page
    detailPagination.pageSize = data.pageSize
    detailPagination.total = data.total
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    detailLoading.value = false
  }
}

async function loadCameras(accountId) {
  if (!accountId) {
    availableCameras.value = []
    return
  }

  try {
    availableCameras.value = await planApi.cameras(accountId)
  } catch (error) {
    availableCameras.value = []
    setFeedback(error.message, 'danger')
  }
}

async function submitSearch() {
  pagination.page = 1
  await loadPlans(1)
}

async function resetSearch() {
  filters.accountTitle = ''
  filters.endDateTo = ''
  filters.onlyUnfinished = true
  filters.startDateFrom = ''
  filters.title = ''
  pagination.page = 1
  await loadPlans(1)
}

async function selectPlan(item) {
  selectedPlan.value = item
  detailPagination.page = 1
  await loadPlanDetails(1)
}

async function previousPage() {
  if (pagination.page > 1) {
    await loadPlans(pagination.page - 1)
  }
}

async function nextPage() {
  if (pagination.page < totalPages.value) {
    await loadPlans(pagination.page + 1)
  }
}

async function previousDetailPage() {
  if (detailPagination.page > 1) {
    await loadPlanDetails(detailPagination.page - 1)
  }
}

async function nextDetailPage() {
  if (detailPagination.page < detailTotalPages.value) {
    await loadPlanDetails(detailPagination.page + 1)
  }
}

async function openCreateDialog() {
  await ensurePlanOptions()
  dialogState.errorMessage = ''
  dialogState.mode = 'create'
  dialogValue.value = buildEmptyPlanValue()
  await loadCameras(dialogValue.value.accountId)
  dialogState.open = true
}

async function openEditDialog() {
  if (!selectedPlan.value) {
    return
  }

  await ensurePlanOptions()
  dialogState.errorMessage = ''

  try {
    const plan = await planApi.get(selectedPlan.value.id)
    dialogState.mode = 'edit'
    dialogValue.value = {
      accountId: String(plan.accountId),
      cameraIds: (plan.cameraIds || []).map((item) => String(item)),
      endDate: plan.endDate || '',
      endHour: plan.endHour || '23',
      endMinute: plan.endMinute || '59',
      noteInfo: plan.noteInfo || '',
      runType: Number(plan.runType || 0),
      startDate: plan.startDate || '',
      startHour: plan.startHour || '00',
      startMinute: plan.startMinute || '00',
      storageId: plan.storageId ? String(plan.storageId) : '',
      storageType: plan.storageType !== undefined && plan.storageType !== null ? String(plan.storageType) : '',
      title: plan.title || '',
    }
    await loadCameras(plan.accountId)
    dialogState.open = true
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

function closeDialog() {
  dialogState.open = false
  dialogState.errorMessage = ''
}

async function handleDialogAccountChange(accountId) {
  await loadCameras(accountId)
}

async function submitDialog(payload) {
  dialogState.submitting = true
  dialogState.errorMessage = ''

  try {
    const result = dialogState.mode === 'edit'
      ? await planApi.update(selectedPlan.value.id, payload)
      : await planApi.create(payload)

    pendingSelectionId.value = result.id
    dialogState.open = false
    setFeedback(dialogState.mode === 'edit' ? '采集计划已更新。' : '采集计划已新增。', 'success')
    await loadPlans(1)
  } catch (error) {
    dialogState.errorMessage = error.message
  } finally {
    dialogState.submitting = false
  }
}

async function deleteSelectedPlan() {
  if (!selectedPlan.value) {
    return
  }

  if (!window.confirm(`确认删除采集计划“${selectedPlan.value.title}”？`)) {
    return
  }

  try {
    await planApi.remove(selectedPlan.value.id)
    selectedPlan.value = null
    planDetails.value = []
    detailPagination.page = 1
    detailPagination.total = 0
    setFeedback('采集计划已删除。', 'success')
    await loadPlans(1)
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

function viewFiles(item) {
  router.push({
    name: 'files',
    query: {
      cameraTitle: item.cameraTitle || '',
      detailId: String(item.id),
      endDateTo: item.planDate || '',
      planId: String(item.planId),
      startDateFrom: item.planDate || '',
      title: item.planTitle || selectedPlan.value?.title || '',
    },
  })
}
</script>

<template>
  <section class="content-grid">
    <article class="panel">
      <div class="account-toolbar">
        <div>
          <p class="eyebrow">采集计划</p>
          <h1>计划列表</h1>
          <p>新增、编辑、删除采集任务，并查看每个摄像头对应的执行明细。</p>
        </div>

        <div class="account-toolbar__summary">
          <span class="metric-card__label">总数</span>
          <strong>{{ pagination.total }}</strong>
        </div>
      </div>

      <form class="toolbar-grid" @submit.prevent="submitSearch">
        <label class="field">
          <span class="field__label">视频平台</span>
          <input v-model.trim="filters.accountTitle" type="text" placeholder="请输入平台名称" />
        </label>

        <label class="field">
          <span class="field__label">计划名称</span>
          <input v-model.trim="filters.title" type="text" placeholder="请输入计划名称" />
        </label>

        <label class="field">
          <span class="field__label">开始日期</span>
          <input v-model="filters.startDateFrom" type="date" />
        </label>

        <label class="field">
          <span class="field__label">结束日期</span>
          <input v-model="filters.endDateTo" type="date" />
        </label>

        <label class="checkbox-field">
          <input v-model="filters.onlyUnfinished" type="checkbox" />
          <span>仅显示未完成计划</span>
        </label>

        <div class="inline-actions">
          <button type="submit" :disabled="loading">查询</button>
          <button type="button" class="ghost" :disabled="loading" @click="resetSearch">重置</button>
        </div>
      </form>

      <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`">
        {{ feedback.message }}
      </div>
    </article>

      <article class="panel">
        <div class="panel__toolbar panel__toolbar--stack">
          <div>
            <p class="eyebrow">计划主列表</p>
            <h2>采集计划</h2>
          </div>

          <div class="plan-toolbar-actions">
            <div class="action-group">
              <button type="button" @click="openCreateDialog">新增任务</button>
              <button type="button" class="ghost" :disabled="!selectedPlan || !selectedPlan.editable" @click="openEditDialog">
                编辑任务
              </button>
              <button type="button" class="danger" :disabled="!selectedPlan || !selectedPlan.deletable" @click="deleteSelectedPlan">
                删除任务
              </button>
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
      </div>

      <div class="account-table-wrap">
        <table class="account-table">
          <thead>
            <tr>
              <th>平台</th>
              <th>运行方式</th>
              <th>计划</th>
              <th>采集开始</th>
              <th>采集结束</th>
              <th>摄像头数</th>
              <th>创建时间</th>
              <th>状态</th>
              <th>进度</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="9" class="empty-cell">采集计划加载中...</td>
            </tr>
            <tr v-else-if="!plans.length">
              <td colspan="9" class="empty-cell">未找到采集计划。</td>
            </tr>
            <tr
              v-for="item in plans"
              :key="item.id"
              class="table-row-clickable"
              :class="{ 'selected-row': selectedPlan && selectedPlan.id === item.id }"
              @click="selectPlan(item)"
            >
              <td>{{ item.accountTitle || '--' }}</td>
              <td>{{ translateRunTypeLabel(item.runTypeLabel) }}</td>
              <td>
                <strong>{{ item.title }}</strong>
                <div class="subtle-text">{{ item.noteInfo || '--' }}</div>
              </td>
              <td>{{ item.startDateTime }}</td>
              <td>{{ item.endDateTime }}</td>
              <td>{{ item.cameraCount }}</td>
              <td>{{ item.createdAt || '--' }}</td>
              <td>{{ translateStatusLabel(item.statusLabel) }}</td>
              <td>{{ item.progress }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

      <article class="panel">
        <div class="panel__toolbar">
          <div>
            <p class="eyebrow">执行明细</p>
            <h2>{{ selectedPlan ? selectedPlan.title : '请选择一个计划' }}</h2>
          </div>
        <div class="page-nav">
          <button
            type="button"
            class="ghost"
            :disabled="detailLoading || detailPagination.page <= 1 || !selectedPlan"
            @click="previousDetailPage"
          >
            上一页
          </button>
          <span>第 {{ detailPagination.page }} 页 / {{ detailTotalPages }}</span>
          <button
            type="button"
            class="ghost"
            :disabled="detailLoading || detailPagination.page >= detailTotalPages || !selectedPlan"
            @click="nextDetailPage"
          >
            下一页
          </button>
        </div>
      </div>

      <div class="account-table-wrap">
        <table class="account-table">
          <thead>
            <tr>
              <th>摄像头</th>
              <th>IP</th>
              <th>状态</th>
              <th>计划时间窗</th>
              <th>进度</th>
              <th>最近执行</th>
              <th>运行时长</th>
              <th>文件数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="detailLoading">
              <td colspan="9" class="empty-cell">执行明细加载中...</td>
            </tr>
            <tr v-else-if="!selectedPlan">
              <td colspan="9" class="empty-cell">请选择一个计划后查看执行明细。</td>
            </tr>
            <tr v-else-if="!planDetails.length">
              <td colspan="9" class="empty-cell">未找到执行明细。</td>
            </tr>
            <tr v-for="item in planDetails" :key="item.id">
              <td>{{ item.cameraTitle }}</td>
              <td>{{ item.ip || '--' }}</td>
              <td>{{ translateStatusLabel(item.statusLabel) }}</td>
              <td>{{ item.plannedWindow }}</td>
              <td>{{ item.process }}%</td>
              <td>{{ item.runDate || '--' }}</td>
              <td>{{ item.runtime }}</td>
              <td>{{ item.fileCount }}</td>
              <td>
                <button type="button" class="ghost" :disabled="!item.fileCount" @click="viewFiles(item)">
                  查看文件
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <PlanDialog
      :accounts="formOptions.accounts"
      :cameras="availableCameras"
      :error-message="dialogState.errorMessage"
      :initial-value="dialogValue"
      :mode="dialogState.mode"
      :open="dialogState.open"
      :storage-groups="formOptions.storageGroups"
      :submitting="dialogState.submitting"
      @account-change="handleDialogAccountChange"
      @close="closeDialog"
      @submit="submitDialog"
    />
  </section>
</template>
