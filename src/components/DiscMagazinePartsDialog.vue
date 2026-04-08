<script setup>
const props = defineProps({
  errorMessage: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  magazine: {
    type: Object,
    default: null,
  },
  open: {
    type: Boolean,
    default: false,
  },
  parts: {
    type: Array,
    default: () => [],
  },
  recoveringPartKey: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'recover'])

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  return value
}

function statusClass(statusKey) {
  if (statusKey === 'formatted' || statusKey === 'normal' || statusKey === 'burn-complete') {
    return 'status-pill--active'
  }
  if (statusKey === 'unformatted') {
    return 'status-pill--muted'
  }
  if (statusKey === 'partial-error') {
    return 'status-pill--warning'
  }
  if (statusKey === 'foreign') {
    return 'status-pill--info'
  }

  return 'status-pill--danger'
}

function isRecovering(part) {
  return props.recoveringPartKey === String(part.partNo)
}

function recover(part) {
  emit('recover', part)
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog dialog--wide">
      <header class="dialog__header">
        <div>
          <p class="eyebrow">光盘匣详情</p>
          <h2>{{ magazine?.rfid || '--' }}</h2>
        </div>
        <button type="button" class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="dialog__body dialog__body--wide">
        <div class="dashboard-grid">
          <article class="metric-card">
            <p class="metric-card__label">条形码</p>
            <strong>{{ formatValue(magazine?.barcode) }}</strong>
          </article>
          <article class="metric-card">
            <p class="metric-card__label">总容量</p>
            <strong>{{ formatValue(magazine?.totalCapacityLabel) }}</strong>
          </article>
          <article class="metric-card">
            <p class="metric-card__label">Part 数量</p>
            <strong>{{ formatValue(magazine?.partCount) }}</strong>
          </article>
          <article class="metric-card">
            <p class="metric-card__label">状态</p>
            <strong>
              <span class="status-pill" :class="statusClass(magazine?.statusKey)">
                {{ formatValue(magazine?.statusLabel) }}
              </span>
            </strong>
          </article>
        </div>

        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

        <div class="account-table-wrap">
          <table class="account-table">
            <thead>
              <tr>
                <th>Part 号</th>
                <th>状态</th>
                <th>RAID 类型</th>
                <th>所属光盘组</th>
                <th>容量</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="empty-cell">正在加载光盘匣详情...</td>
              </tr>
              <tr v-else-if="!parts.length">
                <td colspan="7" class="empty-cell">当前光盘匣没有 Part 数据。</td>
              </tr>
              <tr v-for="part in parts" :key="part.partNo">
                <td>{{ part.partNo }}</td>
                <td>
                  <span class="status-pill" :class="statusClass(part.statusKey)">
                    {{ part.statusLabel }}
                  </span>
                </td>
                <td>{{ formatValue(part.raidType) }}</td>
                <td>{{ formatValue(part.groupName) }}</td>
                <td>{{ formatValue(part.capacityLabel) }}</td>
                <td>{{ formatValue(part.updatedAt) }}</td>
                <td>
                  <div class="action-group">
                    <button
                      v-if="part.canRecover"
                      type="button"
                      class="ghost"
                      :disabled="isRecovering(part)"
                      @click="recover(part)"
                    >
                      {{ isRecovering(part) ? '恢复中...' : '恢复' }}
                    </button>
                    <span v-else class="subtle-text">无需恢复</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>
