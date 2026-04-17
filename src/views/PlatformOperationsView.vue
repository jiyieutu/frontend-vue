<script setup>
import { onMounted, ref } from 'vue'
import { platformApi } from '../api/platform'

const dashboard = ref(null)
const message = ref('')

async function load() {
  try {
    dashboard.value = await platformApi.dashboard()
  } catch (error) {
    message.value = error.message
  }
}

onMounted(load)
</script>
<template>
  <section class="page-panel">
    <header class="page-header"><div><p class="eyebrow">P4 Operations</p><h2>平台运营大屏</h2></div><button class="ghost" @click="load">刷新</button></header>
    <p v-if="message" class="feedback">{{ message }}</p>
    <div v-if="dashboard" class="metric-grid">
      <article class="metric-card"><p class="metric-card__label">资产总数</p><strong>{{ dashboard.assetTotal }}</strong></article>
      <article class="metric-card"><p class="metric-card__label">仓库总数</p><strong>{{ dashboard.repositoryTotal }}</strong></article>
      <article class="metric-card"><p class="metric-card__label">快照总数</p><strong>{{ dashboard.snapshotTotal }}</strong></article>
      <article class="metric-card"><p class="metric-card__label">死信待处理</p><strong>{{ dashboard.openDeadLetters }}</strong></article>
    </div>
    <div class="page-grid-two">
      <div class="table-wrapper"><table><thead><tr><th>状态</th><th>数量</th></tr></thead><tbody><tr v-for="item in dashboard?.jobSummary || []" :key="item.status"><td>{{ item.status }}</td><td>{{ item.total }}</td></tr></tbody></table></div>
      <div class="table-wrapper"><table><thead><tr><th>周期</th><th>容量预测</th></tr></thead><tbody><tr v-for="item in dashboard?.capacityForecast || []" :key="item.period"><td>{{ item.period }}</td><td>{{ item.value }} TB</td></tr></tbody></table></div>
    </div>
  </section>
</template>
