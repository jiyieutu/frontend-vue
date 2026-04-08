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
      <span class="pill">前后端分离</span>
      <h1>{{ appTitle }}</h1>
      <p class="login-hero__copy">
        新版控制台以 Vue 重写前端页面，并通过 Spring Boot API 访问现有业务库结构，
        用于逐步替换旧版系统。
      </p>

      <div class="dashboard-grid">
        <article class="metric-card">
          <span class="metric-card__label">前端</span>
          <strong>Vue 3 + Vite</strong>
          <p>提供路由式主框架、会话保持及新版管理页面。</p>
        </article>
        <article class="metric-card">
          <span class="metric-card__label">后端</span>
          <strong>Spring Boot</strong>
          <p>提供登录认证、菜单、密码修改及已拆分业务接口。</p>
        </article>
        <article class="metric-card">
          <span class="metric-card__label">桥接</span>
          <strong>旧版数据结构</strong>
          <p>迁移过程中仍复用原有数据表，按模块逐步替换旧系统功能。</p>
        </article>
      </div>
    </section>

    <section class="login-card">
      <div class="login-card__header">
        <p class="eyebrow">登录认证</p>
        <h2>登录系统</h2>
        <p>使用原系统 `tb_users` 账号登录新版控制台。</p>
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

      <p class="helper-text">
        后端会将在线会话写入 `tb_useronline`，兼容当前旧系统登录模型。
      </p>
    </section>
  </div>
</template>
