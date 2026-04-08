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
})

const emit = defineEmits(['close', 'submit'])

const form = reactive({
  roomName: '',
  title: '',
})

const localError = computed(() => {
  if (!form.title.trim()) {
    return '请输入摄像头名称。'
  }

  return ''
})

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    form.roomName = normalize(props.initialValue.roomName)
    form.title = normalize(props.initialValue.title)
  },
)

function normalize(value) {
  return value === null || value === undefined ? '' : String(value)
}

function submit() {
  if (localError.value) {
    return
  }

  emit('submit', {
    roomName: form.roomName.trim(),
    title: form.title.trim(),
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog">
      <header class="dialog__header">
        <div>
          <p class="eyebrow">摄像头</p>
          <h3>编辑摄像头</h3>
        </div>
        <button type="button" class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="dialog__body">
        <label class="field">
          <span class="field__label">摄像头名称</span>
          <input v-model.trim="form.title" type="text" maxlength="60" placeholder="请输入摄像头名称" />
        </label>

        <label class="field">
          <span class="field__label">位置</span>
          <input v-model.trim="form.roomName" type="text" maxlength="60" placeholder="请输入位置或区域" />
        </label>

        <p v-if="localError || errorMessage" class="error-text">
          {{ localError || errorMessage }}
        </p>
      </div>

      <footer class="dialog__footer">
        <button type="button" class="ghost" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting || !!localError" @click="submit">
          {{ submitting ? '保存中...' : '保存修改' }}
        </button>
      </footer>
    </section>
  </div>
</template>
