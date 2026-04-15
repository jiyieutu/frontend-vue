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
        <div class="login-mark">
          <div class="login-mark__inner"></div>
        </div>
        <span class="login-hero__app-title">数据管理系统</span>
      </div>

      <div class="login-visual" aria-hidden="true">
        <div class="storage-ecosystem">
          <div class="hub-ring hub-ring--1"></div>
          <div class="hub-ring hub-ring--2"></div>
          
          <div class="storage-hub">
            <div class="hub-core">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div class="hub-glow"></div>
          </div>

          <div class="data-module data-module--disk">
            <div class="module-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div class="module-status module-status--active"></div>
            <span>SSD_STORAGE_ARRAY</span>
          </div>

          <div class="data-module data-module--server">
            <div class="module-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
              </svg>
            </div>
            <div class="module-status module-status--standby"></div>
            <span>DATACENTER_NODE</span>
          </div>

          <div class="data-module data-module--backup">
            <div class="module-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </div>
            <span>AUTO_BACKUP_SYS</span>
          </div>

          <div class="stream-line stream-line--1"></div>
          <div class="stream-line stream-line--2"></div>
        </div>
      </div>

      <div class="login-hero__content">
        <p class="eyebrow">Data Management System</p>
        <h1>多源采集<br />安全存储</h1>
      </div>
      
      <div class="login-hero__footer">
        <span>© 2026 {{ appTitle }} · V1.0.0</span>
      </div>
    </section>

    <section class="login-container">
      <div class="login-card">
        <div class="login-card__header">
          <h2>账号登录</h2>
        </div>

        <form class="login-form" @submit.prevent="submit">
          <div class="field">
            <span class="field__label">访问账号</span>
            <div class="field__input-wrapper">
              <input 
                v-model.trim="form.username" 
                type="text" 
                placeholder="用户名 / 手机号"
                autocomplete="username" 
              />
            </div>
          </div>

          <div class="field">
            <span class="field__label">登录密码</span>
            <div class="field__input-wrapper">
              <input 
                v-model.trim="form.password" 
                type="password" 
                placeholder="请输入密码"
                autocomplete="current-password" 
              />
            </div>
          </div>

          <div v-if="errorMessage" class="login-error">
            <span>{{ errorMessage }}</span>
          </div>

          <button 
            type="submit" 
            class="login-submit"
            :disabled="loading || !form.username || !form.password"
          >
            {{ loading ? '验证中...' : '立即登录' }}
          </button>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  min-height: 100vh;
  background: #fdfdfc;
  padding: 0;
  gap: 0;
}

.login-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 4rem;
  background: #163b36;
  color: #ffffff;
  overflow: hidden;
}

.login-hero__before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  background: 
    radial-gradient(circle at 100% 0%, rgba(31, 96, 88, 0.4), transparent 50%),
    radial-gradient(circle at 0% 100%, rgba(208, 122, 76, 0.15), transparent 40%);
  z-index: 0;
}

.login-hero__brand {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.login-mark {
  width: 2.8rem;
  height: 2.8rem;
  background: #ffffff;
  border-radius: 12px;
  display: grid;
  place-items: center;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.login-mark__inner {
  width: 1.2rem;
  height: 1.2rem;
  background: #1f6058;
  border-radius: 4px;
  transform: rotate(45deg);
}

.login-hero__app-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.login-hero__content {
  position: relative;
  z-index: 10;
  margin-top: -2rem;
}

.login-hero h1 {
  font-size: clamp(2.8rem, 5vw, 4.2rem);
  line-height: 1.1;
  margin: 1rem 0;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.login-visual {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}

.storage-ecosystem {
  position: absolute;
  top: 50%;
  right: -2rem;
  transform: translateY(-55%);
  width: 480px;
  height: 480px;
}

.storage-hub {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 140px;
  height: 140px;
  z-index: 5;
}

.hub-core {
  position: absolute;
  inset: 10%;
  background: linear-gradient(135deg, #2d8a7f, #1f6058);
  border-radius: 32px;
  display: grid;
  place-items: center;
  color: #ffffff;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.3),
    inset 0 2px 4px rgba(255, 255, 255, 0.2);
  z-index: 2;
}

.hub-core svg {
  width: 3rem;
  height: 3rem;
}

.hub-glow {
  position: absolute;
  inset: -10%;
  background: radial-gradient(circle, rgba(45, 138, 127, 0.4) 0%, transparent 70%);
  filter: blur(20px);
  animation: pulse 4s ease-in-out infinite;
}

.hub-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 1.5px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
}

.hub-ring--1 {
  width: 240px;
  height: 240px;
  border-style: dashed;
  animation: rotate 20s linear infinite;
}

.hub-ring--2 {
  width: 380px;
  height: 380px;
  animation: rotate 35s linear infinite reverse;
}

.data-module {
  position: absolute;
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  gap: 0.9rem;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
  animation: float 8s ease-in-out infinite;
}

.data-module--disk {
  top: 10%;
  right: 15%;
  border-left: 4px solid #d07a4c;
}

.data-module--server {
  bottom: 15%;
  right: 2%;
  border-left: 4px solid #2d8a7f;
  animation-delay: -2s;
}

.data-module--backup {
  top: 60%;
  right: 18%;
  border-left: 4px solid #3976a9;
  animation-delay: -4s;
}

.module-icon svg {
  width: 1.4rem;
  height: 1.4rem;
  color: rgba(255, 255, 255, 0.8);
}

.module-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.module-status--active {
  background: #4caf50;
  box-shadow: 0 0 10px #4caf50;
}

.module-status--standby {
  background: #ffc107;
  box-shadow: 0 0 10px #ffc107;
}

.stream-line {
  position: absolute;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  height: 1px;
  width: 100px;
  animation: stream 4s linear infinite;
}

.stream-line--1 { top: 30%; left: 10%; transform: rotate(15deg); }
.stream-line--2 { bottom: 30%; right: 10%; transform: rotate(-15deg); animation-delay: -2s; }

@keyframes rotate {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0); }
  50% { transform: translateY(-15px) rotate(1deg); }
}

@keyframes pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
  50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.7; }
}

@keyframes stream {
  0% { transform: translateX(-100%) rotate(inherit); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateX(200%) rotate(inherit); opacity: 0; }
}

.login-hero__footer {
  position: relative;
  z-index: 2;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
}

.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  background: #f7f9f8;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  padding: 3.5rem;
  border-radius: 32px;
  box-shadow: 0 32px 64px rgba(22, 59, 54, 0.08);
  border: 1px solid rgba(22, 59, 54, 0.04);
}

.login-card__header {
  margin-bottom: 2.5rem;
}

.login-card__header h2 {
  font-size: 2.2rem;
  margin: 0;
  color: #16302b;
  font-weight: 800;
}

.login-form {
  display: grid;
  gap: 1.8rem;
}

.field {
  display: grid;
  gap: 0.6rem;
}

.field__label {
  font-size: 0.9rem;
  font-weight: 700;
  color: #16302b;
  margin-left: 0.2rem;
}

.field__input-wrapper input {
  width: 100%;
  padding: 1.1rem 1.25rem;
  background: #f4f6f5;
  border: 2px solid transparent;
  border-radius: 16px;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.field__input-wrapper input:focus {
  background: #ffffff;
  border-color: #1f6058;
  outline: none;
  box-shadow: 0 8px 20px rgba(31, 96, 88, 0.08);
}

.login-error {
  background: rgba(155, 59, 42, 0.08);
  color: #9b3b2a;
  padding: 0.8rem 1.2rem;
  border-radius: 12px;
  font-size: 0.9rem;
  border: 1px solid rgba(155, 59, 42, 0.1);
}

.login-submit {
  width: 100%;
  padding: 1.1rem;
  background: #1f6058;
  color: #ffffff;
  border: none;
  border-radius: 16px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 12px 24px rgba(31, 96, 88, 0.2);
}

.login-submit:hover:not(:disabled) {
  background: #164641;
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(31, 96, 88, 0.25);
}

.login-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 1024px) {
  .login-page {
    grid-template-columns: 1fr;
  }
  
  .login-hero {
    display: none;
  }
  
  .login-container {
    padding: 2rem;
  }
}
</style>
