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
  open: {
    type: Boolean,
    default: false,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'submit'])

const form = reactive(createDefaultForm())

const localError = computed(() => {
  if (![0, 1].includes(Number(form.enabled))) {
    return '请选择定时备份状态。'
  }
  if (!/^\d{2}:\d{2}$/.test(form.scheduleTime.trim())) {
    return '请输入正确的备份时间。'
  }
  if (![0, 1].includes(Number(form.backupType))) {
    return '请选择定时备份方式。'
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
    enabled: 0,
    scheduleTime: '02:00',
  }
}

function resetForm() {
  const next = {
    ...createDefaultForm(),
    ...props.initialValue,
  }

  form.backupType = Number(next.backupType ?? 0)
  form.enabled = Number(next.enabled ?? next.backupScheduleEnabled ?? 0)
  form.scheduleTime = normalizeTime(next.scheduleTime ?? next.backupScheduleTime)
}

function normalizeTime(value) {
  const text = value === null || value === undefined ? '' : String(value).trim()
  return /^\d{2}:\d{2}$/.test(text) ? text : '02:00'
}

function submit() {
  if (localError.value) {
    return
  }

  emit('submit', {
    backupType: Number(form.backupType),
    enabled: Number(form.enabled),
    scheduleTime: form.scheduleTime.trim(),
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog">
      <header class="dialog__header">
        <div>
          <p class="eyebrow">定时备份</p>
          <h3>{{ title ? `设置 ${title}` : '设置定时备份' }}</h3>
        </div>
        <button type="button" class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="dialog__body">
        <div class="toolbar-grid">
          <label class="field">
            <span class="field__label">定时状态</span>
            <select v-model="form.enabled" class="select-field">
              <option :value="1">启用</option>
              <option :value="0">停用</option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">备份方式</span>
            <select v-model="form.backupType" class="select-field">
              <option :value="0">全量备份</option>
              <option :value="1">增量备份</option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">备份时间</span>
            <input v-model="form.scheduleTime" type="time" />
          </label>
        </div>

        <p class="subtle-text">到达设定时间后，系统会按所选方式自动执行一次备份。</p>

        <p v-if="localError || errorMessage" class="error-text">
          {{ localError || errorMessage }}
        </p>
      </div>

      <footer class="dialog__footer">
        <button type="button" class="ghost" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting || !!localError" @click="submit">
          {{ submitting ? '保存中...' : '保存设置' }}
        </button>
      </footer>
    </section>
  </div>
</template>
