<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '../api/auth'
import { appTitle } from '../lib/config'
import { setSession } from '../lib/session'

const route = useRoute()
const router = useRouter()

const errorMessage = ref('')
const loading = ref(false)
const form = reactive({
  password: '',
  username: '',
})

const redirectTarget = computed(() =>
  typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard',
)

async function submit() {
  errorMessage.value = ''
  loading.value = true

  try {
    const result = await authApi.login(form)
    setSession(result.token, result.user)
    router.replace(redirectTarget.value)
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <section class="login-hero">
      <div class="login-hero__brand">
        <span class="login-mark">VC</span>
        <span>{{ appTitle }}</span>
      </div>

      <div class="login-visual" aria-hidden="true">
        <div class="login-visual__screen">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="login-visual__rail">
          <i></i>
          <i></i>
          <i></i>
          <i></i>
        </div>
      </div>

      <div class="login-hero__content">
        <p class="eyebrow">Video Console</p>
        <h1>统一管理，快速进入。</h1>
        <p class="login-hero__copy">登录后查看视频平台、摄像头、任务计划和归档数据。</p>
      </div>
    </section>

    <section class="login-card">
      <div class="login-card__header">
        <p class="eyebrow">Welcome</p>
        <h2>账号登录</h2>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <label class="field">
          <span class="field__label">用户名</span>
          <input v-model.trim="form.username" type="text" autocomplete="username" />
        </label>

        <label class="field">
          <span class="field__label">密码</span>
          <input v-model.trim="form.password" type="password" autocomplete="current-password" />
        </label>

        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

        <button type="submit" :disabled="loading || !form.username || !form.password">
          {{ loading ? '登录中...' : '进入系统' }}
        </button>
      </form>
    </section>
  </div>
</template>
