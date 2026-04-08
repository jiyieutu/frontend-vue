<script setup>
import { computed } from 'vue'
import { sessionState } from '../lib/session'

const operatorName = computed(
  () => sessionState.user?.userName || sessionState.user?.userCode || '操作员',
)

const milestones = [
  {
    label: '已拆分接口',
    value: '6 类',
    description: '认证、菜单、资源、计划、文件和系统设置已提供 Spring Boot 接口。',
  },
  {
    label: '前端框架',
    value: 'Vue 就绪',
    description: '登录、路由守卫、主框架和已迁移管理页面已运行在 Vue 前端中。',
  },
  {
    label: '旧系统桥接',
    value: '持续迁移',
    description: '尚未拆分的旧模块仍以占位页方式保留，不再隐藏入口。',
  },
]

const nextSteps = [
  '继续把剩余旧系统菜单逐步替换为独立的 Vue 页面和 Spring Boot 接口。',
  '补齐文件播放、下载、重传等仍依赖旧系统的业务动作。',
  '按模块逐步清理旧页面跳转，收口到新版控制台。',
]
</script>

<template>
  <section class="content-grid">
    <article class="panel panel--hero">
      <span class="pill">工作台</span>
      <h1>{{ operatorName }}</h1>
      <p>
        当前新版控制台已采用前后端分离模式运行。旧版 JFinal 与 Freemarker 代码仍保留在仓库中，
        作为未完成模块的迁移参考。
      </p>
    </article>

    <article class="panel">
      <p class="eyebrow">架构状态</p>
      <h2>当前拆分进度</h2>
      <div class="dashboard-grid">
        <article v-for="item in milestones" :key="item.label" class="metric-card">
          <span class="metric-card__label">{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </article>

    <article class="panel">
      <p class="eyebrow">后续迁移</p>
      <h2>建议顺序</h2>
      <ol class="simple-list">
        <li v-for="step in nextSteps" :key="step">{{ step }}</li>
      </ol>
    </article>
  </section>
</template>
