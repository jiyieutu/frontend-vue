<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  errorMessage: {
    type: String,
    default: '',
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
  confirmPassword: '',
  newPassword: '',
  oldPassword: '',
})

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    form.oldPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
  },
)

const localError = computed(() => {
  if (!form.newPassword || !form.confirmPassword) {
    return ''
  }

  if (form.newPassword !== form.confirmPassword) {
    return '两次输入的新密码不一致。'
  }

  return ''
})

function submit() {
  if (localError.value) {
    return
  }

  emit('submit', {
    oldPassword: form.oldPassword,
    newPassword: form.newPassword,
    confirmPassword: form.confirmPassword,
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog">
      <header class="dialog__header">
        <div>
          <p class="eyebrow">安全设置</p>
          <h3>修改密码</h3>
        </div>
        <button type="button" class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="dialog__body">
        <label class="field">
          <span class="field__label">当前密码</span>
          <input v-model.trim="form.oldPassword" type="password" autocomplete="current-password" />
        </label>

        <label class="field">
          <span class="field__label">新密码</span>
          <input v-model.trim="form.newPassword" type="password" autocomplete="new-password" />
        </label>

        <label class="field">
          <span class="field__label">确认新密码</span>
          <input v-model.trim="form.confirmPassword" type="password" autocomplete="new-password" />
        </label>

        <p v-if="localError || errorMessage" class="error-text">
          {{ localError || errorMessage }}
        </p>
      </div>

      <footer class="dialog__footer">
        <button type="button" class="ghost" @click="$emit('close')">取消</button>
        <button
          type="button"
          :disabled="submitting || !form.oldPassword || !form.newPassword || !form.confirmPassword || !!localError"
          @click="submit"
        >
          {{ submitting ? '保存中...' : '保存密码' }}
        </button>
      </footer>
    </section>
  </div>
</template>
