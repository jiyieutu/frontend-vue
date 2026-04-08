<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { legacyBaseUrl } from '../lib/config'

const route = useRoute()

const legacyPath = computed(() =>
  typeof route.query.path === 'string' ? route.query.path : '',
)

const title = computed(() =>
  typeof route.query.title === 'string' && route.query.title ? route.query.title : '旧版模块',
)

const externalUrl = computed(() => {
  if (!legacyPath.value || !legacyBaseUrl) {
    return ''
  }

  if (/^https?:\/\//.test(legacyPath.value)) {
    return legacyPath.value
  }

  return `${legacyBaseUrl}${legacyPath.value.startsWith('/') ? legacyPath.value : `/${legacyPath.value}`}`
})

function openLegacy() {
  if (externalUrl.value) {
    window.open(externalUrl.value, '_blank', 'noopener')
  }
}
</script>

<template>
  <section class="content-grid">
    <article class="panel panel--hero">
      <span class="pill">旧版桥接</span>
      <h1>{{ title }}</h1>
      <p>
        当前菜单仍属于旧版 JFinal 与 Freemarker 单体系统。这里保留了原始路由信息，
        但对应业务接口尚未完成拆分。
      </p>
    </article>

    <article class="panel">
      <p class="eyebrow">原始路由</p>
      <h2>旧版入口</h2>
      <code class="code-block">{{ legacyPath || '--' }}</code>
      <p v-if="externalUrl">
        当前已配置旧版系统基础地址，因此在迁移期间仍可通过新标签页打开该模块。
      </p>
      <p v-else>
        如需临时跳回旧系统，请在 `frontend-vue/.env.local` 中配置 `VITE_LEGACY_BASE_URL`。
      </p>
      <div class="inline-actions">
        <button v-if="externalUrl" type="button" @click="openLegacy">打开旧版页面</button>
      </div>
    </article>

    <article class="panel">
      <p class="eyebrow">替换清单</p>
      <h2>完成迁移需要处理</h2>
      <ol class="simple-list">
        <li>把旧版控制器逻辑拆到 Spring Boot REST 接口中。</li>
        <li>把页面相关 SQL 下沉到后端服务或仓储层。</li>
        <li>使用独立 Vue 页面替换当前占位路由。</li>
      </ol>
    </article>
  </section>
</template>
