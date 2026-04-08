<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { discMagazineApi } from '../api/disc-magazines'
import DiscMagazinePartsDialog from '../components/DiscMagazinePartsDialog.vue'

const feedback = ref(null)
const loading = ref(false)
const partsLoading = ref(false)
const recoveringPartKey = ref('')
const magazines = ref([])

const filters = reactive({
  barcode: '',
  rfid: '',
  status: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const dialog = reactive({
  errorMessage: '',
  magazine: null,
  open: false,
  parts: [],
})

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '已格式化', value: 'formatted' },
  { label: '刻录完成', value: 'burn-complete' },
  { label: '未格式化', value: 'unformatted' },
  { label: '部分异常', value: 'partial-error' },
  { label: '整体异常', value: 'error' },
  { label: '外来盘', value: 'foreign' },
  { label: '离线', value: 'offline' },
]

const totalPages = computed(() =>
  Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 1))),
)

onMounted(() => {
  loadMagazines(1, true)
})

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  return value
}

function formatCount(value) {
  return Number(value || 0).toLocaleString()
}

function statusClass(statusKey) {
  if (statusKey === 'formatted' || statusKey === 'burn-complete') {
    return 'status-pill--active'
  }
  if (statusKey === 'unformatted') {
    return 'status-pill--muted'
  }
  if (statusKey === 'partial-error') {
    return 'status-pill--warning'
  }
  if (statusKey === 'foreign') {
    return 'status-pill--info'
  }

  return 'status-pill--danger'
}

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
}

function buildParams(page = pagination.page) {
  return {
    barcode: filters.barcode,
    page,
    pageSize: pagination.pageSize,
    rfid: filters.rfid,
    status: filters.status,
  }
}

async function loadMagazines(page = 1, silent = false) {
  loading.value = true

  try {
    const data = await discMagazineApi.list(buildParams(page))
    magazines.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!magazines.value.length && !silent) {
      setFeedback('当前筛选条件下没有匹配的光盘匣。', 'warning')
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
  await loadMagazines(1)
}

async function resetSearch() {
  filters.barcode = ''
  filters.rfid = ''
  filters.status = ''
  pagination.page = 1
  await loadMagazines(1)
}

async function previousPage() {
  if (pagination.page > 1) {
    await loadMagazines(pagination.page - 1)
  }
}

async function nextPage() {
  if (pagination.page < totalPages.value) {
    await loadMagazines(pagination.page + 1)
  }
}

async function openPartsDialog(item) {
  dialog.open = true
  dialog.errorMessage = ''
  dialog.magazine = item
  dialog.parts = []
  partsLoading.value = true

  try {
    const [magazine, parts] = await Promise.all([
      discMagazineApi.get(item.rfid),
      discMagazineApi.listParts(item.rfid),
    ])
    dialog.magazine = magazine
    dialog.parts = parts
    replaceMagazine(magazine)
  } catch (error) {
    dialog.errorMessage = error.message
  } finally {
    partsLoading.value = false
  }
}

function closeDialog() {
  dialog.errorMessage = ''
  dialog.open = false
  dialog.parts = []
  dialog.magazine = null
  recoveringPartKey.value = ''
}

async function recoverPart(part) {
  if (!dialog.magazine?.rfid) {
    return
  }

  if (!window.confirm(`确认恢复光盘匣 ${dialog.magazine.rfid} 的 Part ${part.partNo} 吗？`)) {
    return
  }

  recoveringPartKey.value = String(part.partNo)
  dialog.errorMessage = ''

  try {
    const result = await discMagazineApi.recoverPart(dialog.magazine.rfid, part.partNo)
    dialog.magazine = result.magazine
    replaceMagazine(result.magazine)
    dialog.parts = await discMagazineApi.listParts(dialog.magazine.rfid)
    setFeedback(`Part ${part.partNo} 已恢复。`, 'success')
    await loadMagazines(pagination.page, true)
  } catch (error) {
    dialog.errorMessage = error.message
  } finally {
    recoveringPartKey.value = ''
  }
}

function replaceMagazine(nextMagazine) {
  if (!nextMagazine?.rfid) {
    return
  }

  const nextItems = magazines.value.slice()
  const index = nextItems.findIndex((item) => item.rfid === nextMagazine.rfid)
  if (index >= 0) {
    nextItems[index] = nextMagazine
    magazines.value = nextItems
  }
}
</script>

<template>
  <section class="content-grid">
    <article class="account-toolbar">
      <div>
        <p class="eyebrow">光盘匣管理</p>
        <h1>光盘匣列表</h1>
        <p>查看光盘匣状态、容量和 Part 明细，并支持对异常 Part 执行恢复。</p>
      </div>

      <div class="account-toolbar__summary">
        <span class="eyebrow">当前总数</span>
        <strong>{{ formatCount(pagination.total) }}</strong>
        <span>个光盘匣</span>
      </div>
    </article>

    <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`">
      {{ feedback.message }}
    </div>

    <article class="panel">
      <div class="panel__toolbar panel__toolbar--stack">
        <div>
          <p class="eyebrow">筛选条件</p>
          <h2>按 RFID、条形码和状态查询</h2>
        </div>
      </div>

      <form class="toolbar-grid toolbar-grid--wide" @submit.prevent="submitSearch">
        <label class="field">
          <span class="field__label">RFID</span>
          <input v-model.trim="filters.rfid" type="text" placeholder="请输入 RFID" />
        </label>

        <label class="field">
          <span class="field__label">条形码</span>
          <input v-model.trim="filters.barcode" type="text" placeholder="请输入条形码" />
        </label>

        <label class="field">
          <span class="field__label">状态</span>
          <select v-model="filters.status" class="select-field">
            <option v-for="item in statusOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
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
          <p class="eyebrow">光盘匣列表</p>
          <h2>共 {{ formatCount(pagination.total) }} 个光盘匣</h2>
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
              <th>RFID</th>
              <th>条形码</th>
              <th>总容量</th>
              <th>Part 数量</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="empty-cell">正在加载光盘匣列表...</td>
            </tr>
            <tr v-else-if="!magazines.length">
              <td colspan="7" class="empty-cell">未找到光盘匣数据。</td>
            </tr>
            <tr v-for="item in magazines" :key="item.rfid">
              <td>
                <strong>{{ item.rfid }}</strong>
              </td>
              <td>{{ formatValue(item.barcode) }}</td>
              <td>{{ formatValue(item.totalCapacityLabel) }}</td>
              <td>{{ formatValue(item.partCount) }}</td>
              <td>
                <span class="status-pill" :class="statusClass(item.statusKey)">
                  {{ item.statusLabel }}
                </span>
              </td>
              <td>{{ formatValue(item.updatedAt) }}</td>
              <td>
                <div class="action-group">
                  <button type="button" class="ghost" @click="openPartsDialog(item)">查看详情</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <DiscMagazinePartsDialog
      :error-message="dialog.errorMessage"
      :loading="partsLoading"
      :magazine="dialog.magazine"
      :open="dialog.open"
      :parts="dialog.parts"
      :recovering-part-key="recoveringPartKey"
      @close="closeDialog"
      @recover="recoverPart"
    />
  </section>
</template>
