<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
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
  submitting: {
    type: Boolean,
    default: false,
  },
  typeOptions: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close', 'submit'])

const form = reactive(createDefaultForm())

const STORAGE_TYPE_LABELS = {
  object: '对象存储',
  nas: 'NAS 存储',
  'disc-group': '光盘组',
}

const writableTypeOptions = computed(() => props.typeOptions.filter((item) => item.writable))

const selectedType = computed(() =>
  props.typeOptions.find((item) => item.value === form.type) || null,
)

const serverIpLabel = computed(() => (form.type === 'object' ? '接入地址 IP' : '服务器 IP'))
const accessKeyLabel = computed(() => (form.type === 'object' ? 'AccessKey' : '用户名'))
const secretKeyLabel = computed(() => (form.type === 'object' ? 'SecretKey' : '密码'))
const pathLabel = computed(() => (form.type === 'object' ? '桶名称' : '目录'))

const localError = computed(() => {
  if (!form.type) {
    return '请选择存储类型。'
  }

  if (!form.title.trim()) {
    return '请输入存储设备名称。'
  }

  if (form.type === 'object' && !form.serverIp.trim()) {
    return '请输入对象存储接入地址 IP。'
  }

  if (!form.path.trim()) {
    return '请输入桶名称或目录。'
  }

  if (form.type === 'object' && (!form.accessKey.trim() || !form.secretKey.trim())) {
    return '请输入对象存储访问凭证。'
  }

  if (!isValidNumber(form.maxSize) || !isValidNumber(form.startSize)) {
    return '请输入合法的容量数值。'
  }

  if (Number(form.maxSize) < 0 || Number(form.startSize) < 0) {
    return '容量数值必须大于或等于 0。'
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
    accessKey: '',
    maxSize: '0',
    path: '',
    secretKey: '',
    serverIp: '',
    startSize: '0',
    status: 1,
    title: '',
    type: 'object',
  }
}

function resetForm() {
  const fallbackType = writableTypeOptions.value[0]?.value || 'object'
  const next = {
    ...createDefaultForm(),
    type: fallbackType,
    ...props.initialValue,
  }

  form.accessKey = normalize(next.accessKey)
  form.maxSize = normalizeNumber(next.maxSize, '0')
  form.path = normalize(next.path)
  form.secretKey = normalize(next.secretKey)
  form.serverIp = normalize(next.serverIp)
  form.startSize = normalizeNumber(next.startSize, '0')
  form.status = Number(next.status ?? 1)
  form.title = normalize(next.title)
  form.type = normalize(next.type) || fallbackType
}

function normalize(value) {
  return value === null || value === undefined ? '' : String(value)
}

function normalizeNumber(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  return String(value)
}

function isValidNumber(value) {
  return /^-?\d+$/.test(String(value).trim())
}

function formatTypeLabel(item) {
  if (!item) {
    return ''
  }

  return STORAGE_TYPE_LABELS[item.value] || item.label
}

function submit() {
  if (localError.value) {
    return
  }

  emit('submit', {
    accessKey: form.accessKey.trim(),
    maxSize: Number(form.maxSize),
    path: form.path.trim(),
    secretKey: form.secretKey.trim(),
    serverIp: form.serverIp.trim(),
    startSize: Number(form.startSize),
    status: Number(form.status),
    title: form.title.trim(),
    type: form.type,
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog dialog--wide">
      <header class="dialog__header">
        <div>
          <p class="eyebrow">存储设备</p>
          <h3>{{ mode === 'edit' ? '编辑存储设备' : '新增存储设备' }}</h3>
        </div>
        <button type="button" class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="dialog__body dialog__body--wide">
        <div class="toolbar-grid toolbar-grid--wide">
          <label class="field">
            <span class="field__label">存储类型</span>
            <select v-model="form.type" class="select-field" :disabled="mode === 'edit'">
              <option v-for="item in writableTypeOptions" :key="item.value" :value="item.value">
                {{ formatTypeLabel(item) }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">存储设备名称</span>
            <input v-model.trim="form.title" type="text" maxlength="60" placeholder="请输入存储设备名称" />
          </label>

          <label class="field">
            <span class="field__label">状态</span>
            <select v-model="form.status" class="select-field">
              <option :value="1">启用</option>
              <option :value="0">停用</option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">{{ serverIpLabel }}</span>
            <input v-model.trim="form.serverIp" type="text" :placeholder="form.type === 'object' ? '192.168.1.20' : '选填'" />
          </label>

          <label class="field">
            <span class="field__label">{{ pathLabel }}</span>
            <input
              v-model.trim="form.path"
              type="text"
              :placeholder="form.type === 'object' ? '请输入桶名称' : '/mnt/storage'"
            />
          </label>

          <label class="field">
            <span class="field__label">{{ accessKeyLabel }}</span>
            <input v-model.trim="form.accessKey" type="text" :placeholder="form.type === 'object' ? '请输入 AccessKey' : '选填'" />
          </label>

          <label class="field">
            <span class="field__label">{{ secretKeyLabel }}</span>
            <input v-model.trim="form.secretKey" type="password" :placeholder="form.type === 'object' ? '请输入 SecretKey' : '选填'" />
          </label>

          <label class="field">
            <span class="field__label">最大容量</span>
            <input v-model.trim="form.maxSize" type="text" placeholder="0" />
          </label>

          <label class="field">
            <span class="field__label">初始容量</span>
            <input v-model.trim="form.startSize" type="text" placeholder="0" />
          </label>
        </div>

        <section class="detail-card">
          <div class="detail-card__header">
            <div>
              <span class="field__label">{{ formatTypeLabel(selectedType) || '存储设备' }}</span>
              <p class="subtle-text">
                {{ form.type === 'object' ? '对象存储通过兼容 S3 的接口进行连通性测试。' : 'NAS 存储通过后端服务进程检测目录可访问性。' }}
              </p>
            </div>
            <span class="pill">计划类型 {{ selectedType?.planType ?? '--' }}</span>
          </div>
        </section>

        <p v-if="localError || errorMessage" class="error-text">
          {{ localError || errorMessage }}
        </p>
      </div>

      <footer class="dialog__footer">
        <button type="button" class="ghost" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting || !!localError" @click="submit">
          {{ submitting ? '保存中...' : mode === 'edit' ? '保存修改' : '新增存储设备' }}
        </button>
      </footer>
    </section>
  </div>
</template>
