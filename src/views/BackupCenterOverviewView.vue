<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { platformApi } from '../api/platform'

const router = useRouter()
const summary = ref({})
const recentJobs = ref([])
const recentAlerts = ref([])
const recentSnapshots = ref([])
const loading = ref(false)

const cards = computed(() => [
  { title: '资产管理', desc: '管理备份资产与备份对象', route: '/platform/assets', accent: 'teal' },
  { title: '仓库管理', desc: '管理仓库、对象存储和节点', route: '/platform/repositories', accent: 'blue' },
  { title: '策略管理', desc: '统一配置备份与保留策略', route: '/platform/policies', accent: 'purple' },
  { title: '任务中心', desc: '查看备份、恢复、校验任务', route: '/platform/jobs', accent: 'amber' },
  { title: '恢复与校验', desc: '执行恢复与验证并跟踪结果', route: '/platform/restore', accent: 'rose' },
  { title: '企业级能力', desc: '调用 P1/P2 企业级 workload 能力', route: '/platform/enterprise', accent: 'indigo' },
])

const statCards = computed(() => [
  { label: '资产总数', value: summary.value.assetTotal ?? '--', hint: '已纳管的备份对象' },
  { label: '仓库总数', value: summary.value.repositoryTotal ?? '--', hint: '对象存储 / 节点仓库' },
  { label: '快照总数', value: summary.value.snapshotTotal ?? '--', hint: '当前可用恢复点' },
  { label: '待处理告警', value: summary.value.openDeadLetters ?? '--', hint: '死信与异常待处置' },
])

const jobSummary = computed(() => Array.isArray(summary.value.jobSummary) ? summary.value.jobSummary : [])
const capacityForecast = computed(() => Array.isArray(summary.value.capacityForecast) ? summary.value.capacityForecast : [])

const totalJobCount = computed(() => jobSummary.value.reduce((sum, item) => sum + normalizeNumber(item.total), 0))
const successJobCount = computed(() => jobSummary.value
  .filter((item) => ['SUCCEEDED', 'SUCCESS', 'COMPLETED'].includes(String(item.status || '').toUpperCase()))
  .reduce((sum, item) => sum + normalizeNumber(item.total), 0))
const successRate = computed(() => {
  if (!totalJobCount.value) return 0
  return Math.round((successJobCount.value / totalJobCount.value) * 1000) / 10
})

const forecastLatest = computed(() => capacityForecast.value.length ? normalizeNumber(capacityForecast.value[capacityForecast.value.length - 1].value) : 0)
const forecastGrowth = computed(() => {
  if (capacityForecast.value.length < 2) return 0
  const start = normalizeNumber(capacityForecast.value[0].value)
  const end = normalizeNumber(capacityForecast.value[capacityForecast.value.length - 1].value)
  if (!start) return end ? 100 : 0
  return Math.round(((end - start) / start) * 1000) / 10
})

const capacityPolyline = computed(() => {
  const list = capacityForecast.value
  if (!list.length) return '0,90 300,90'
  const values = list.map((item) => normalizeNumber(item.value))
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const width = 300
  const height = 90
  return values.map((value, index) => {
    const x = list.length === 1 ? width / 2 : (index / (list.length - 1)) * width
    const ratio = max === min ? 0.5 : (value - min) / (max - min)
    const y = height - ratio * (height - 12) - 6
    return `${x},${y}`
  }).join(' ')
})

const statusBars = computed(() => {
  const max = Math.max(...jobSummary.value.map((item) => normalizeNumber(item.total)), 1)
  return jobSummary.value.map((item) => ({
    label: item.status || '--',
    total: normalizeNumber(item.total),
    ratio: Math.max(10, Math.round((normalizeNumber(item.total) / max) * 100)),
  }))
})

const failedJobs = computed(() => recentJobs.value
  .filter((job) => ['FAILED', 'ERROR', 'TIMEOUT', 'CANCELLED'].includes(String(job.status || '').toUpperCase()))
  .slice(0, 5))

onMounted(async () => {
  loading.value = true
  try {
    const [dashboard, jobs, alerts, snapshots] = await Promise.all([
      platformApi.getOperationsDashboard(),
      platformApi.listJobs({ page: 1, pageSize: 8 }),
      platformApi.searchDeadLetters({ page: 1, pageSize: 5, status: 'OPEN' }),
      platformApi.listSnapshots({ page: 1, pageSize: 5 }),
    ])
    summary.value = dashboard || {}
    recentJobs.value = jobs?.items || []
    recentAlerts.value = alerts?.items || []
    recentSnapshots.value = snapshots?.items || []
  } catch (e) {
    summary.value = {}
    recentJobs.value = []
    recentAlerts.value = []
    recentSnapshots.value = []
  } finally {
    loading.value = false
  }
})

function open(route) {
  router.push(route)
}

function normalizeNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function statusTone(status) {
  const value = String(status || '').toUpperCase()
  if (['SUCCEEDED', 'SUCCESS', 'RESOLVED', 'COMPLETED'].includes(value)) return 'success'
  if (['FAILED', 'ERROR', 'OPEN', 'TIMEOUT', 'CANCELLED'].includes(value)) return 'danger'
  if (['RUNNING', 'REQUEUED', 'PENDING'].includes(value)) return 'warning'
  return 'neutral'
}
</script>

<template>
  <section class="backup-center-page">
    <header class="backup-hero">
      <div class="backup-hero__left">
        <p class="eyebrow">BACKUP CENTER</p>
        <h1>备份中心首页</h1>
        <p class="backup-hero__desc">统一管理备份任务、恢复操作、仓库策略与企业级保护能力，面向运维和管理员提供更贴近正式商用后台的大盘视图。</p>
        <div class="backup-hero__actions">
          <button @click="open('/platform/backup')">立即发起备份</button>
          <button class="ghost" @click="open('/platform/operations')">查看运营大屏</button>
        </div>
      </div>
      <div class="backup-hero__right">
        <div class="storage-mark" aria-hidden="true">
          <span class="storage-mark__top"></span>
          <span class="storage-mark__middle"></span>
          <span class="storage-mark__bottom"></span>
          <span class="storage-mark__pulse"></span>
        </div>
      </div>
    </header>

    <section class="stat-grid">
      <article v-for="item in statCards" :key="item.label" class="stat-card">
        <p class="stat-card__label">{{ item.label }}</p>
        <strong>{{ item.value }}</strong>
        <span>{{ item.hint }}</span>
      </article>
    </section>

    <section class="insight-grid">
      <article class="insight-card insight-card--primary">
        <header class="feed-card__header compact">
          <div>
            <p class="eyebrow">Success Rate</p>
            <h2>任务成功率</h2>
          </div>
          <span class="status-pill status-pill--success">{{ successRate }}%</span>
        </header>
        <div class="success-rate">
          <div class="success-rate__ring" :style="{ '--rate': successRate }">
            <span>{{ successRate }}%</span>
          </div>
          <div class="success-rate__meta">
            <p>成功任务 {{ successJobCount }}</p>
            <p>任务总量 {{ totalJobCount }}</p>
            <p class="muted">按当前任务状态汇总估算</p>
          </div>
        </div>
      </article>

      <article class="insight-card">
        <header class="feed-card__header compact">
          <div>
            <p class="eyebrow">Capacity Forecast</p>
            <h2>容量预测</h2>
          </div>
          <span class="forecast-growth" :class="{ rise: forecastGrowth >= 0, fall: forecastGrowth < 0 }">{{ forecastGrowth >= 0 ? '+' : '' }}{{ forecastGrowth }}%</span>
        </header>
        <div class="capacity-summary">
          <strong>{{ forecastLatest || '--' }} <small>TB</small></strong>
          <p>当前预测周期末容量</p>
        </div>
        <svg class="trend-chart" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="capacity-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="rgba(31,160,132,0.35)" />
              <stop offset="100%" stop-color="rgba(31,160,132,0.02)" />
            </linearGradient>
          </defs>
          <polyline :points="capacityPolyline" fill="none" stroke="#1f9f84" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <div class="forecast-legend">
          <span v-for="item in capacityForecast" :key="item.period">{{ item.period }}: {{ item.value }}TB</span>
        </div>
      </article>

      <article class="insight-card">
        <header class="feed-card__header compact">
          <div>
            <p class="eyebrow">Trend Overview</p>
            <h2>趋势图表</h2>
          </div>
          <button class="ghost small" @click="open('/platform/jobs')">任务中心</button>
        </header>
        <div class="bar-trend">
          <div v-for="item in statusBars" :key="item.label" class="bar-trend__row">
            <span>{{ item.label }}</span>
            <div class="bar-trend__track"><i :style="{ width: `${item.ratio}%` }"></i></div>
            <strong>{{ item.total }}</strong>
          </div>
          <p v-if="!statusBars.length" class="feed-empty">{{ loading ? '正在加载趋势…' : '暂无趋势数据' }}</p>
        </div>
      </article>
    </section>

    <section class="feature-grid">
      <article v-for="item in cards" :key="item.route" class="feature-card" :class="`feature-card--${item.accent}`" @click="open(item.route)">
        <div class="feature-card__glyph">⛁</div>
        <div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.desc }}</p>
        </div>
      </article>
    </section>

    <section class="alert-strip" v-if="failedJobs.length">
      <div class="alert-strip__title">
        <p class="eyebrow">Failed Jobs</p>
        <h2>最近失败任务高亮</h2>
      </div>
      <div class="alert-strip__list">
        <article v-for="job in failedJobs" :key="job.id" class="failed-job-card" @click="open('/platform/jobs')">
          <div>
            <strong>#{{ job.id }}</strong>
            <p>{{ job.job_type || job.type || 'JOB' }} · {{ job.workload_type || job.workloadType || '--' }}</p>
          </div>
          <span class="status-pill status-pill--danger">{{ job.status || 'FAILED' }}</span>
        </article>
      </div>
    </section>

    <section class="feed-grid">
      <article class="feed-card">
        <header class="feed-card__header">
          <div>
            <p class="eyebrow">Recent Jobs</p>
            <h2>最近任务</h2>
          </div>
          <button class="ghost" @click="open('/platform/jobs')">查看全部</button>
        </header>
        <ul class="feed-list">
          <li v-for="job in recentJobs" :key="job.id" class="feed-item" :class="{ 'feed-item--danger': statusTone(job.status) === 'danger' }">
            <div>
              <strong>#{{ job.id }}</strong>
              <p>{{ job.job_type || job.type || 'JOB' }} · {{ job.workload_type || job.workloadType || '--' }}</p>
            </div>
            <span class="status-pill" :class="`status-pill--${statusTone(job.status)}`">{{ job.status || '--' }}</span>
          </li>
          <li v-if="!recentJobs.length" class="feed-empty">{{ loading ? '正在加载任务…' : '暂无最近任务' }}</li>
        </ul>
      </article>

      <article class="feed-card">
        <header class="feed-card__header">
          <div>
            <p class="eyebrow">Recent Alerts</p>
            <h2>最近告警</h2>
          </div>
          <button class="ghost" @click="open('/platform/dead-letters')">处理告警</button>
        </header>
        <ul class="feed-list">
          <li v-for="alert in recentAlerts" :key="alert.id" class="feed-item">
            <div>
              <strong>#{{ alert.id }}</strong>
              <p>{{ alert.event_type || alert.eventType || 'WEBHOOK' }}</p>
            </div>
            <span class="status-pill" :class="`status-pill--${statusTone(alert.status)}`">{{ alert.status || 'OPEN' }}</span>
          </li>
          <li v-if="!recentAlerts.length" class="feed-empty">{{ loading ? '正在加载告警…' : '暂无最近告警' }}</li>
        </ul>
      </article>

      <article class="feed-card">
        <header class="feed-card__header">
          <div>
            <p class="eyebrow">Recent Snapshots</p>
            <h2>最近快照</h2>
          </div>
          <button class="ghost" @click="open('/platform/restore')">进入恢复</button>
        </header>
        <ul class="feed-list">
          <li v-for="snapshot in recentSnapshots" :key="snapshot.id" class="feed-item">
            <div>
              <strong>#{{ snapshot.id }}</strong>
              <p>{{ snapshot.workload_type || snapshot.workloadType || '--' }} · {{ snapshot.asset_name || snapshot.assetName || '--' }}</p>
            </div>
            <span class="feed-item__meta">{{ snapshot.created_at || snapshot.createdAt || '--' }}</span>
          </li>
          <li v-if="!recentSnapshots.length" class="feed-empty">{{ loading ? '正在加载快照…' : '暂无最近快照' }}</li>
        </ul>
      </article>
    </section>
  </section>
</template>

<style scoped>
.backup-center-page { display:flex; flex-direction:column; gap:1.5rem; }
.backup-hero { display:grid; grid-template-columns: minmax(0, 1.7fr) minmax(240px, .8fr); gap:1.5rem; align-items:center; padding:28px; border-radius:28px; background: linear-gradient(135deg, #103c39 0%, #14564f 46%, #187165 100%); color:#eef9f7; box-shadow: 0 24px 56px rgba(16,60,57,.22); }
.backup-hero__desc { max-width: 700px; margin: .75rem 0 0; color: rgba(238,249,247,.84); line-height: 1.75; }
.backup-hero__actions { display:flex; gap:12px; margin-top: 1.25rem; flex-wrap:wrap; }
.backup-hero__actions .ghost { background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); color:#eef9f7; box-shadow:none; }
.backup-hero__right { display:flex; justify-content:center; }
.storage-mark { position:relative; width:180px; height:180px; display:flex; align-items:center; justify-content:center; }
.storage-mark__top, .storage-mark__middle, .storage-mark__bottom { position:absolute; width:132px; height:34px; border-radius:999px/26px; border:1px solid rgba(255,255,255,.28); background: linear-gradient(180deg, rgba(255,255,255,.42), rgba(255,255,255,.12)); box-shadow: inset 0 1px 0 rgba(255,255,255,.22); }
.storage-mark__top { top:42px; }
.storage-mark__middle { top:74px; }
.storage-mark__bottom { top:106px; }
.storage-mark__pulse { position:absolute; inset:18px; border-radius:50%; border:1px dashed rgba(148,255,227,.42); }
.stat-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; }
.stat-card, .insight-card, .feed-card { background: rgba(255,255,255,.92); border-radius: 22px; padding: 20px; box-shadow: 0 18px 40px rgba(16,60,56,.08); }
.stat-card__label { margin:0 0 10px; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:#64837d; }
.stat-card strong { display:block; font-size:32px; color:#123431; margin-bottom:8px; }
.stat-card span { color:#607572; font-size:14px; }
.insight-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:1rem; }
.feed-card__header.compact { margin-bottom: 16px; }
.success-rate { display:flex; gap:18px; align-items:center; }
.success-rate__ring { width:108px; height:108px; border-radius:50%; display:flex; align-items:center; justify-content:center; background: conic-gradient(#169777 calc(var(--rate, 0) * 1%), #e8f3f0 0); position:relative; }
.success-rate__ring::after { content:''; position:absolute; inset:12px; border-radius:50%; background:#fff; }
.success-rate__ring span { position:relative; z-index:1; font-size:22px; font-weight:700; color:#123431; }
.success-rate__meta p { margin:0 0 8px; color:#36514c; }
.success-rate__meta .muted { color:#7c9290; font-size:13px; }
.capacity-summary { display:flex; align-items:end; justify-content:space-between; gap:12px; margin-bottom: 8px; }
.capacity-summary strong { font-size:34px; color:#123431; }
.capacity-summary small { font-size:16px; color:#56716b; }
.capacity-summary p { margin:0; color:#667e79; }
.forecast-growth { font-weight:700; }
.forecast-growth.rise { color:#169777; }
.forecast-growth.fall { color:#d35757; }
.trend-chart { width:100%; height:120px; margin-top:10px; background: linear-gradient(180deg, rgba(22,151,119,.06), rgba(22,151,119,0)); border-radius:16px; }
.forecast-legend { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; color:#657c77; font-size:12px; }
.bar-trend { display:flex; flex-direction:column; gap:12px; }
.bar-trend__row { display:grid; grid-template-columns: 84px minmax(0, 1fr) 40px; align-items:center; gap:10px; }
.bar-trend__row span { color:#48625d; font-size:13px; }
.bar-trend__track { height:10px; border-radius:999px; background:#edf4f2; overflow:hidden; }
.bar-trend__track i { display:block; height:100%; border-radius:999px; background: linear-gradient(90deg, #1f9f84, #58c9ac); }
.bar-trend__row strong { text-align:right; color:#123431; }
.feature-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; }
.feature-card { border-radius:22px; padding:18px; display:flex; gap:14px; cursor:pointer; background:rgba(255,255,255,.9); box-shadow: 0 16px 36px rgba(16,60,56,.08); transition: transform .2s ease, box-shadow .2s ease; }
.feature-card:hover { transform: translateY(-3px); box-shadow: 0 20px 44px rgba(16,60,56,.12); }
.feature-card__glyph { width:44px; height:44px; border-radius:16px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px; }
.feature-card--teal .feature-card__glyph { background: linear-gradient(135deg,#0d6c63,#1aa287); }
.feature-card--blue .feature-card__glyph { background: linear-gradient(135deg,#235eb6,#3f86ee); }
.feature-card--purple .feature-card__glyph { background: linear-gradient(135deg,#6b4fd5,#8f73ff); }
.feature-card--amber .feature-card__glyph { background: linear-gradient(135deg,#b36b18,#e69a2a); }
.feature-card--rose .feature-card__glyph { background: linear-gradient(135deg,#a84258,#e56c8b); }
.feature-card--indigo .feature-card__glyph { background: linear-gradient(135deg,#3949ab,#6f7df5); }
.feature-card h3 { margin:0 0 6px; color:#123431; }
.feature-card p { margin:0; color:#607572; line-height:1.6; font-size:14px; }
.alert-strip { display:flex; gap:18px; align-items:flex-start; padding:20px; border-radius:22px; background: linear-gradient(135deg, rgba(211,87,87,.10), rgba(255,255,255,.85)); border:1px solid rgba(211,87,87,.12); }
.alert-strip__title { min-width: 220px; }
.alert-strip__list { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; flex:1; }
.failed-job-card { background:#fff5f5; border:1px solid rgba(211,87,87,.12); border-radius:18px; padding:14px; display:flex; justify-content:space-between; gap:10px; cursor:pointer; }
.failed-job-card strong { color:#7f1d1d; }
.failed-job-card p { margin:4px 0 0; color:#985555; font-size:13px; }
.feed-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:1rem; }
.feed-card__header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:18px; }
.feed-card__header h2 { margin:4px 0 0; color:#123431; }
.feed-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:12px; }
.feed-item { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:14px; border-radius:16px; background:#f7fbfa; }
.feed-item--danger { background:#fff4f4; border:1px solid rgba(211,87,87,.1); }
.feed-item strong { color:#123431; }
.feed-item p { margin:6px 0 0; color:#657c77; font-size:13px; }
.feed-item__meta { color:#728783; font-size:12px; white-space:nowrap; }
.status-pill { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:600; white-space:nowrap; }
.status-pill--success { background:#e7faf4; color:#0e8d68; }
.status-pill--danger { background:#fff1f1; color:#c44545; }
.status-pill--warning { background:#fff6e6; color:#b87800; }
.status-pill--neutral { background:#eef3f2; color:#5f7470; }
.feed-empty { color:#7c9290; font-size:14px; padding:8px 0; }
.eyebrow { margin:0; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color: rgba(91, 121, 114, .88); }
.backup-hero .eyebrow { color: rgba(214,244,238,.72); }
button.small { padding: 8px 12px; font-size: 13px; }
@media (max-width: 1200px) {
  .insight-grid, .feed-grid { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .backup-hero { grid-template-columns: 1fr; }
  .alert-strip { flex-direction: column; }
}
</style>
