<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  backupTypes: {
    type: Array,
    default: () => [],
  },
  cachePathPattern: {
    type: String,
    default: '/home/screen/nasbackup/{accountId}',
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

const emit = defineEmits(['close', 'submit'])

const form = reactive(createDefaultForm())

const backupTypeOptions = computed(() => {
  const source = props.backupTypes?.length
    ? props.backupTypes
    : [
        { value: 0, label: '全量备份' },
        { value: 1, label: '增量备份' },
      ]

  return source.map((item) => ({
    label: item.label || (Number(item.value) === 1 ? '增量备份' : '全量备份'),
    value: Number(item.value),
  }))
})

const storageOptions = computed(() =>
  (props.storageGroups || []).flatMap((group) =>
    (group.items || []).map((item) => ({
      id: Number(item.id),
      key: `${group.type}:${item.id}`,
      label: `${group.label} / ${item.label}`,
      title: item.label,
      type: Number(group.type),
      typeLabel: group.label,
    })),
  ),
)

const selectedStorage = computed(() =>
  storageOptions.value.find((item) => item.key === form.storageKey) || null,
)

const selectedStorageIsDiscGroup = computed(() => Number(selectedStorage.value?.type) === 4)

const localError = computed(() => {
  if (!form.title.trim()) {
    return '请输入存储节点配置名称。'
  }
  if (!form.serverIp.trim()) {
    return '请输入备份客户端 IP。'
  }
  if (!form.username.trim()) {
    return '请输入备份客户端用户名。'
  }
  if (!form.password.trim()) {
    return '请输入备份客户端密码。'
  }
  if (!form.dirName.trim()) {
    return '请输入备份源路径。'
  }
  if (!form.storageKey) {
    return '请选择上传目标存储设备。'
  }
  if (!['0', '1'].includes(String(form.backupType))) {
    return '请选择默认备份方式。'
  }
  if (!['0', '1'].includes(String(form.backupScheduleEnabled))) {
    return '请选择定时备份是否启用。'
  }
  if (!isValidTime(form.backupScheduleTime)) {
    return '备份时间格式应为 HH:mm。'
  }
  if (!['0', '1'].includes(String(form.uploadScheduleEnabled))) {
    return '请选择上传策略是否启用。'
  }
  if (!isValidTime(form.uploadScheduleTime)) {
    return '上传时间格式应为 HH:mm。'
  }
  return ''
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetForm()
    }
  },
)

function createDefaultForm() {
  return {
    backupType: 1,
    backupScheduleEnabled: 0,
    backupScheduleTime: '02:00',
    dirName: '',
    password: '',
    serverIp: '',
    status: 1,
    storageKey: '',
    title: '',
    uploadScheduleEnabled: 0,
    uploadScheduleTime: '02:00',
    username: '',
  }
}

function resetForm() {
  const fallbackStorageKey = storageOptions.value[0]?.key || ''
  const next = {
    ...createDefaultForm(),
    ...props.initialValue,
  }

  form.dirName = normalize(next.dirName)
  form.password = normalize(next.password)
  form.backupType = Number(next.backupType ?? 1)
  form.backupScheduleEnabled = Number(next.backupScheduleEnabled ?? 0)
  form.backupScheduleTime = normalizeTime(next.backupScheduleTime || '02:00')
  form.serverIp = normalize(next.serverIp)
  form.status = Number(next.status ?? 1)
  form.storageKey = next.storageKey || buildStorageKey(next.storageType, next.storageId) || fallbackStorageKey
  form.title = normalize(next.title)
  form.uploadScheduleEnabled = Number(next.uploadScheduleEnabled ?? 0)
  form.uploadScheduleTime = normalizeTime(next.uploadScheduleTime || '02:00')
  form.username = normalize(next.username)
}

function buildStorageKey(storageType, storageId) {
  if (storageType === null || storageType === undefined || !storageId) {
    return ''
  }
  return `${Number(storageType)}:${Number(storageId)}`
}

function normalize(value) {
  return value === null || value === undefined ? '' : String(value)
}

function normalizeTime(value) {
  const normalized = normalize(value)
  return isValidTime(normalized) ? normalized : '02:00'
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '').trim())
}

function submit() {
  if (localError.value || !selectedStorage.value) {
    return
  }

  emit('submit', {
    backupType: Number(form.backupType),
    backupScheduleEnabled: Number(form.backupScheduleEnabled),
    backupScheduleTime: form.backupScheduleTime,
    dirName: form.dirName.trim(),
    password: form.password.trim(),
    serverIp: form.serverIp.trim(),
    status: Number(form.status),
    storageId: Number(selectedStorage.value.id),
    storageType: Number(selectedStorage.value.type),
    title: form.title.trim(),
    uploadScheduleEnabled: Number(form.uploadScheduleEnabled),
    uploadScheduleTime: form.uploadScheduleTime,
    username: form.username.trim(),
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog dialog--wide backup-account-dialog">
      <header class="dialog__header">
        <div>
          <p class="eyebrow">存储节点配置</p>
          <h3>{{ mode === 'edit' ? '编辑存储节点配置' : '新增存储节点配置' }}</h3>
        </div>
        <button type="button" class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="dialog__body dialog__body--wide">
        <div class="toolbar-grid toolbar-grid--wide">
          <label class="field">
            <span class="field__label">存储节点配置名称</span>
            <input v-model.trim="form.title" type="text" maxlength="60" placeholder="请输入存储节点配置名称" />
          </label>

          <label class="field">
            <span class="field__label">状态</span>
            <select v-model="form.status" class="select-field">
              <option :value="1">启用</option>
              <option :value="0">停用</option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">备份客户端 IP</span>
            <input v-model.trim="form.serverIp" type="text" placeholder="192.168.1.10 或 192.168.1.10:22" />
          </label>

          <label class="field">
            <span class="field__label">客户端用户名</span>
            <input v-model.trim="form.username" type="text" placeholder="请输入客户端用户名" />
          </label>

          <label class="field">
            <span class="field__label">客户端密码</span>
            <input v-model.trim="form.password" type="password" placeholder="请输入客户端密码" />
          </label>

          <label class="field">
            <span class="field__label">备份源路径</span>
            <input v-model.trim="form.dirName" type="text" placeholder="例如 V:\\ 或 /data/source" />
          </label>
        </div>

        <section class="detail-card">
          <div class="detail-card__header">
            <div>
              <span class="field__label">备份与上传</span>
              <p class="subtle-text">备份客户端先把文件备份到本地服务器缓存目录，再按上传策略同步到选中的存储设备。</p>
            </div>
            <span class="pill">缓存目录 {{ cachePathPattern }}</span>
          </div>

          <div class="toolbar-grid toolbar-grid--wide">
            <label class="field">
              <span class="field__label">默认备份方式</span>
              <select v-model="form.backupType" class="select-field">
                <option v-for="item in backupTypeOptions" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </select>
            </label>

            <label class="field">
              <span class="field__label">启用定时备份</span>
              <select v-model="form.backupScheduleEnabled" class="select-field">
                <option :value="1">启用</option>
                <option :value="0">停用</option>
              </select>
            </label>

            <label class="field">
              <span class="field__label">备份时间</span>
              <input v-model="form.backupScheduleTime" type="time" />
            </label>

            <label class="field">
              <span class="field__label">上传到存储设备</span>
              <select v-model="form.storageKey" class="select-field">
                <option disabled value="">请选择存储设备</option>
                <option v-for="item in storageOptions" :key="item.key" :value="item.key">
                  {{ item.label }}
                </option>
              </select>
            </label>

            <label class="field">
              <span class="field__label">启用定时上传</span>
              <select v-model="form.uploadScheduleEnabled" class="select-field">
                <option :value="1">启用</option>
                <option :value="0">停用</option>
              </select>
            </label>

            <label class="field">
              <span class="field__label">上传时间</span>
              <input v-model="form.uploadScheduleTime" type="time" />
            </label>
          </div>

          <p v-if="selectedStorage" class="subtle-text">
            当前上传目标：{{ selectedStorage.typeLabel }} / {{ selectedStorage.title }}。定时备份先写入本地缓存，定时上传再同步到该目标。
          </p>
          <p v-if="selectedStorageIsDiscGroup" class="subtle-text">
            光盘匣组会按文件逐个刻录到盘匣分区，首次上传会明显慢于 NAS 或对象存储。
          </p>
        </section>

        <p v-if="localError || errorMessage" class="error-text">
          {{ localError || errorMessage }}
        </p>
      </div>

      <footer class="dialog__footer">
        <button type="button" class="ghost" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting || !!localError" @click="submit">
          {{ submitting ? '保存中...' : mode === 'edit' ? '保存修改' : '新增账号' }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.backup-account-dialog {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 3rem);
}

.backup-account-dialog .dialog__body {
  min-height: 0;
  overflow-y: auto;
}

.backup-account-dialog .dialog__footer {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.96);
}

@media (max-width: 960px) {
  .backup-account-dialog {
    max-height: calc(100vh - 1.5rem);
  }
}
</style>
