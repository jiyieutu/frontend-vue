<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  accounts: {
    type: Array,
    default: () => [],
  },
  cameras: {
    type: Array,
    default: () => [],
  },
  errorMessage: {
    type: String,
    default: '',
  },
  initialValue: {
    type: Object,
    default: () => ({}),
  },
  mode: {
    type: String,
    default: 'create',
  },
  open: {
    type: Boolean,
    default: false,
  },
  storageGroups: {
    type: Array,
    default: () => [],
  },
  submitting: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['account-change', 'close', 'submit'])

const form = reactive(createDefaultForm())

const STORAGE_TYPE_LABELS = {
  0: '对象存储',
  2: 'NAS 存储',
  4: '光盘组',
}

const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))

const selectedStorageItems = computed(() => {
  const group = props.storageGroups.find((item) => Number(item.type) === Number(form.storageType))
  return group ? group.items : []
})

const localError = computed(() => {
  if (!form.accountId) {
    return '请选择视频平台。'
  }

  if (!form.title.trim()) {
    return '请输入任务名称。'
  }

  if (!form.startDate || !form.endDate) {
    return '请选择采集日期范围。'
  }

  if (!form.cameraIds.length) {
    return '请至少选择一个摄像头。'
  }

  if (!form.storageType || !form.storageId) {
    return '请选择存储设备。'
  }

  const start = `${form.startHour}${form.startMinute}`
  const end = `${form.endHour}${form.endMinute}`
  if (form.startDate === form.endDate && start >= end) {
    return '采集开始时间必须早于结束时间。'
  }

  return ''
})

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    resetForm()
  },
)

watch(
  () => props.storageGroups,
  () => {
    syncStorageSelection()
  },
)

function createDefaultForm() {
  return {
    accountId: '',
    cameraIds: [],
    endDate: '',
    endHour: '23',
    endMinute: '59',
    noteInfo: '',
    runType: 0,
    startDate: '',
    startHour: '00',
    startMinute: '00',
    storageId: '',
    storageType: '',
    title: '',
  }
}

function resetForm() {
  const next = {
    ...createDefaultForm(),
    ...props.initialValue,
  }

  form.accountId = normalizeScalar(next.accountId)
  form.cameraIds = normalizeArray(next.cameraIds)
  form.endDate = next.endDate || ''
  form.endHour = padPart(next.endHour, '23')
  form.endMinute = padPart(next.endMinute, '59')
  form.noteInfo = next.noteInfo || ''
  form.runType = Number(next.runType || 0)
  form.startDate = next.startDate || ''
  form.startHour = padPart(next.startHour, '00')
  form.startMinute = padPart(next.startMinute, '00')
  form.storageType = normalizeScalar(next.storageType)
  form.storageId = normalizeScalar(next.storageId)
  form.title = next.title || ''

  syncStorageSelection()
}

function normalizeScalar(value) {
  return value === null || value === undefined || value === '' ? '' : String(value)
}

function normalizeArray(values) {
  if (!Array.isArray(values)) {
    return []
  }

  return values.map((item) => String(item))
}

function padPart(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  return String(value).padStart(2, '0')
}

function syncStorageSelection() {
  if (!props.storageGroups.length) {
    form.storageType = ''
    form.storageId = ''
    return
  }

  const currentGroup = props.storageGroups.find((item) => Number(item.type) === Number(form.storageType))
  if (!currentGroup) {
    form.storageType = String(props.storageGroups[0].type)
    form.storageId = props.storageGroups[0].items[0] ? String(props.storageGroups[0].items[0].id) : ''
    return
  }

  const hasStorage = currentGroup.items.some((item) => String(item.id) === String(form.storageId))
  if (!hasStorage) {
    form.storageId = currentGroup.items[0] ? String(currentGroup.items[0].id) : ''
  }
}

function handleAccountChange() {
  form.cameraIds = []
  emit('account-change', Number(form.accountId))
}

function handleStorageTypeChange() {
  syncStorageSelection()
}

function toggleAllCameras() {
  if (form.cameraIds.length === props.cameras.length) {
    form.cameraIds = []
    return
  }

  form.cameraIds = props.cameras.map((item) => String(item.id))
}

function formatStorageGroupLabel(item) {
  if (!item) {
    return ''
  }

  return STORAGE_TYPE_LABELS[item.type] || item.label
}

function submit() {
  if (localError.value) {
    return
  }

  emit('submit', {
    accountId: Number(form.accountId),
    cameraIds: form.cameraIds.map((item) => Number(item)),
    endDate: form.endDate,
    endHour: form.endHour,
    endMinute: form.endMinute,
    noteInfo: form.noteInfo.trim(),
    runType: Number(form.runType),
    startDate: form.startDate,
    startHour: form.startHour,
    startMinute: form.startMinute,
    storageId: Number(form.storageId),
    storageType: Number(form.storageType),
    title: form.title.trim(),
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog dialog--wide">
      <header class="dialog__header">
        <div>
          <p class="eyebrow">采集计划</p>
          <h3>{{ mode === 'edit' ? '编辑任务' : '新增任务' }}</h3>
        </div>
        <button type="button" class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="dialog__body dialog__body--wide">
        <div class="toolbar-grid">
          <label class="field">
            <span class="field__label">视频平台</span>
            <select v-model="form.accountId" class="select-field" @change="handleAccountChange">
              <option value="">请选择视频平台</option>
              <option v-for="item in accounts" :key="item.id" :value="String(item.id)">
                {{ item.title }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">任务名称</span>
            <input v-model.trim="form.title" type="text" maxlength="128" placeholder="请输入任务名称" />
          </label>

          <label class="field">
            <span class="field__label">运行方式</span>
            <select v-model="form.runType" class="select-field">
              <option :value="0">单次</option>
              <option :value="1">循环</option>
            </select>
          </label>
        </div>

        <div class="plan-time-grid">
          <label class="field">
            <span class="field__label">开始日期</span>
            <input v-model="form.startDate" type="date" />
          </label>

          <label class="field">
            <span class="field__label">开始时间</span>
            <div class="time-picker">
              <select v-model="form.startHour" class="select-field">
                <option v-for="item in hourOptions" :key="`sh-${item}`" :value="item">{{ item }}</option>
              </select>
              <span>:</span>
              <select v-model="form.startMinute" class="select-field">
                <option v-for="item in minuteOptions" :key="`sm-${item}`" :value="item">{{ item }}</option>
              </select>
            </div>
          </label>

          <label class="field">
            <span class="field__label">结束日期</span>
            <input v-model="form.endDate" type="date" />
          </label>

          <label class="field">
            <span class="field__label">结束时间</span>
            <div class="time-picker">
              <select v-model="form.endHour" class="select-field">
                <option v-for="item in hourOptions" :key="`eh-${item}`" :value="item">{{ item }}</option>
              </select>
              <span>:</span>
              <select v-model="form.endMinute" class="select-field">
                <option v-for="item in minuteOptions" :key="`em-${item}`" :value="item">{{ item }}</option>
              </select>
            </div>
          </label>
        </div>

        <div class="toolbar-grid">
          <label class="field">
            <span class="field__label">存储类型</span>
            <select v-model="form.storageType" class="select-field" @change="handleStorageTypeChange">
              <option value="">请选择存储类型</option>
              <option v-for="item in storageGroups" :key="item.type" :value="String(item.type)">
                {{ formatStorageGroupLabel(item) }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">存储设备</span>
            <select v-model="form.storageId" class="select-field" :disabled="!selectedStorageItems.length">
              <option value="">请选择存储设备</option>
              <option v-for="item in selectedStorageItems" :key="item.id" :value="String(item.id)">
                {{ item.label }}
              </option>
            </select>
          </label>
        </div>

        <section class="camera-picker">
          <div class="camera-picker__header">
            <div>
              <span class="field__label">摄像头</span>
              <p class="subtle-text">
                {{ cameras.length ? `已选择 ${form.cameraIds.length} 个` : '请选择视频平台后加载摄像头。' }}
              </p>
            </div>

            <button type="button" class="ghost" :disabled="!cameras.length" @click="toggleAllCameras">
              {{ form.cameraIds.length === cameras.length && cameras.length ? '清空选择' : '全选' }}
            </button>
          </div>

          <div v-if="cameras.length" class="camera-checklist">
            <label v-for="item in cameras" :key="item.id" class="camera-checklist__item">
              <input v-model="form.cameraIds" type="checkbox" :value="String(item.id)" />
              <div>
                <strong>{{ item.title || '--' }}</strong>
                <div class="subtle-text">{{ item.ip || '--' }}</div>
              </div>
            </label>
          </div>
          <div v-else class="empty-state-inline">
            当前平台下没有可选摄像头。
          </div>
        </section>

        <label class="field">
          <span class="field__label">备注</span>
          <textarea v-model.trim="form.noteInfo" class="textarea-field" rows="4" maxlength="200" />
        </label>

        <p v-if="localError || errorMessage" class="error-text">
          {{ localError || errorMessage }}
        </p>
      </div>

      <footer class="dialog__footer">
        <button type="button" class="ghost" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting || !!localError" @click="submit">
          {{ submitting ? '保存中...' : mode === 'edit' ? '保存修改' : '新增任务' }}
        </button>
      </footer>
    </section>
  </div>
</template>
