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
})

const emit = defineEmits(['close', 'submit'])

const form = reactive(createDefaultForm())

const localError = computed(() => {
  if (!form.title.trim()) {
    return '请输入 NAS 名称。'
  }
  if (!form.serverIp.trim()) {
    return '请输入 NAS IP。'
  }
  if (!form.path.trim()) {
    return '请输入 NAS 路径。'
  }
  if (![0, 1].includes(Number(form.backupType))) {
    return '请选择备份方式。'
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
    backupType: 0,
    maxSize: '0',
    password: '',
    path: '',
    serverIp: '',
    startSize: '0',
    status: 1,
    title: '',
    username: '',
  }
}

function resetForm() {
  const next = {
    ...createDefaultForm(),
    ...props.initialValue,
  }

  form.backupType = Number(next.backupType ?? 0)
  form.maxSize = normalizeNumber(next.maxSize, '0')
  form.password = normalize(next.password ?? next.secretKey)
  form.path = normalize(next.path)
  form.serverIp = normalize(next.serverIp)
  form.startSize = normalizeNumber(next.startSize, '0')
  form.status = Number(next.status ?? 1)
  form.title = normalize(next.title)
  form.username = normalize(next.username ?? next.accessKey)
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

function submit() {
  if (localError.value) {
    return
  }

  emit('submit', {
    backupType: Number(form.backupType),
    maxSize: Number(form.maxSize),
    password: form.password.trim(),
    path: form.path.trim(),
    serverIp: form.serverIp.trim(),
    startSize: Number(form.startSize),
    status: Number(form.status),
    title: form.title.trim(),
    username: form.username.trim(),
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog dialog--wide">
      <header class="dialog__header">
        <div>
          <p class="eyebrow">存储设备配置</p>
          <h3>{{ mode === 'edit' ? '编辑存储设备' : '新增存储设备' }}</h3>
        </div>
        <button type="button" class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="dialog__body dialog__body--wide">
        <div class="toolbar-grid toolbar-grid--wide">
          <label class="field">
            <span class="field__label">设备名称</span>
            <input v-model.trim="form.title" type="text" maxlength="60" placeholder="请输入设备名称" />
          </label>

          <label class="field">
            <span class="field__label">状态</span>
            <select v-model="form.status" class="select-field">
              <option :value="1">启用</option>
              <option :value="0">停用</option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">默认备份方式</span>
            <select v-model="form.backupType" class="select-field">
              <option :value="0">全量备份</option>
              <option :value="1">增量备份</option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">NAS IP</span>
            <input v-model.trim="form.serverIp" type="text" placeholder="192.168.1.20" />
          </label>

          <label class="field">
            <span class="field__label">账号</span>
            <input v-model.trim="form.username" type="text" placeholder="选填" />
          </label>

          <label class="field">
            <span class="field__label">密码</span>
            <input v-model.trim="form.password" type="password" placeholder="选填" />
          </label>

          <label class="field">
            <span class="field__label">NAS 路径</span>
            <input v-model.trim="form.path" type="text" placeholder="/mnt/storage" />
          </label>
        </div>

        <section class="detail-card">
          <div class="detail-card__header">
            <div>
              <span class="field__label">NAS 存储</span>
              <p class="subtle-text">通过后端服务进程检测当前 NAS 路径是否可访问，操作列可手动执行全量或增量备份。</p>
            </div>
            <span class="pill">计划类型 2</span>
          </div>
        </section>

        <p v-if="localError || errorMessage" class="error-text">
          {{ localError || errorMessage }}
        </p>
      </div>

      <footer class="dialog__footer">
        <button type="button" class="ghost" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting || !!localError" @click="submit">
          {{ submitting ? '保存中...' : mode === 'edit' ? '保存修改' : '新增 NAS' }}
        </button>
      </footer>
    </section>
  </div>
</template>
