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

const showCloudFields = computed(() => form.type === 'YC' || form.type === 'YG')

const PLATFORM_TYPE_LABELS = {
  HK: '海康平台',
  YS: '宇视平台',
  YC: '云存储平台',
  YG: '运管平台',
  KD: '科达平台',
}

const localError = computed(() => {
  if (!form.type) {
    return '请选择平台类型。'
  }

  if (!form.title.trim()) {
    return '请输入平台名称。'
  }

  if (!form.serverIp.trim()) {
    return '请输入平台服务器 IP。'
  }

  if (!form.port.trim()) {
    return '请输入登录端口。'
  }

  if (!form.username.trim()) {
    return '请输入登录用户名。'
  }

  if (!form.password.trim()) {
    return '请输入登录密码。'
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
    cloudAk: '',
    cloudIp: '',
    cloudPort: '',
    cloudSk: '',
    password: '',
    playPort: '',
    port: '',
    serverIp: '',
    status: 1,
    title: '',
    type: '',
    username: '',
  }
}

function resetForm() {
  const fallbackType = props.typeOptions[0]?.value || 'HK'
  const next = {
    ...createDefaultForm(),
    type: fallbackType,
    ...props.initialValue,
  }

  form.cloudAk = normalize(next.cloudAk)
  form.cloudIp = normalize(next.cloudIp)
  form.cloudPort = normalize(next.cloudPort)
  form.cloudSk = normalize(next.cloudSk)
  form.password = normalize(next.password)
  form.playPort = normalize(next.playPort)
  form.port = normalize(next.port)
  form.serverIp = normalize(next.serverIp)
  form.status = Number(next.status ?? 1)
  form.title = normalize(next.title)
  form.type = normalize(next.type) || fallbackType
  form.username = normalize(next.username)
}

function normalize(value) {
  return value === null || value === undefined ? '' : String(value)
}

function formatTypeLabel(item) {
  if (!item) {
    return ''
  }

  return PLATFORM_TYPE_LABELS[item.value] || item.label
}

function submit() {
  if (localError.value) {
    return
  }

  emit('submit', {
    cloudAk: form.cloudAk.trim(),
    cloudIp: form.cloudIp.trim(),
    cloudPort: form.cloudPort.trim(),
    cloudSk: form.cloudSk.trim(),
    password: form.password.trim(),
    playPort: form.playPort.trim(),
    port: form.port.trim(),
    serverIp: form.serverIp.trim(),
    status: Number(form.status),
    title: form.title.trim(),
    type: form.type,
    username: form.username.trim(),
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog dialog--wide">
      <header class="dialog__header">
        <div>
          <p class="eyebrow">视频平台</p>
          <h3>{{ mode === 'edit' ? '编辑平台' : '新增平台' }}</h3>
        </div>
        <button type="button" class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="dialog__body dialog__body--wide">
        <div class="toolbar-grid toolbar-grid--wide">
          <label class="field">
            <span class="field__label">平台类型</span>
            <select v-model="form.type" class="select-field">
              <option v-for="item in typeOptions" :key="item.value" :value="item.value">
                {{ formatTypeLabel(item) }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">平台名称</span>
            <input v-model.trim="form.title" type="text" maxlength="60" placeholder="请输入平台名称" />
          </label>

          <label class="field">
            <span class="field__label">状态</span>
            <select v-model="form.status" class="select-field">
              <option :value="1">启用</option>
              <option :value="0">停用</option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">服务器 IP</span>
            <input v-model.trim="form.serverIp" type="text" placeholder="192.168.1.10" />
          </label>

          <label class="field">
            <span class="field__label">登录端口</span>
            <input v-model.trim="form.port" type="text" placeholder="8000" />
          </label>

          <label class="field">
            <span class="field__label">预览端口</span>
            <input v-model.trim="form.playPort" type="text" placeholder="选填" />
          </label>

          <label class="field">
            <span class="field__label">用户名</span>
            <input v-model.trim="form.username" type="text" placeholder="admin" />
          </label>

          <label class="field">
            <span class="field__label">密码</span>
            <input v-model.trim="form.password" type="password" placeholder="请输入密码" />
          </label>
        </div>

        <section class="detail-card">
          <div class="detail-card__header">
            <div>
              <span class="field__label">云平台扩展信息</span>
              <p class="subtle-text">
                {{ showCloudFields ? '云平台类型需要填写对应的云接入参数。' : '仅云平台类型按需填写。' }}
              </p>
            </div>
            <span class="pill">{{ showCloudFields ? '云模式' : '选填' }}</span>
          </div>

          <div class="toolbar-grid toolbar-grid--wide">
            <label class="field">
              <span class="field__label">云端 IP</span>
              <input v-model.trim="form.cloudIp" type="text" placeholder="选填" />
            </label>

            <label class="field">
              <span class="field__label">云端端口</span>
              <input v-model.trim="form.cloudPort" type="text" placeholder="选填" />
            </label>

            <label class="field">
              <span class="field__label">云端 AK</span>
              <input v-model.trim="form.cloudAk" type="text" placeholder="选填" />
            </label>

            <label class="field">
              <span class="field__label">云端 SK</span>
              <input v-model.trim="form.cloudSk" type="password" placeholder="选填" />
            </label>
          </div>
        </section>

        <p v-if="localError || errorMessage" class="error-text">
          {{ localError || errorMessage }}
        </p>
      </div>

      <footer class="dialog__footer">
        <button type="button" class="ghost" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting || !!localError" @click="submit">
          {{ submitting ? '保存中...' : mode === 'edit' ? '保存修改' : '新增平台' }}
        </button>
      </footer>
    </section>
  </div>
</template>
