<script setup>
import { computed, ref } from 'vue'
import { settingsApi } from '../api/settings'

const feedback = ref(null)
const keyword = ref('')
const loading = ref(false)
const settings = ref([])

const editableCount = computed(() => settings.value.filter((item) => item.editable).length)

loadSettings()

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
}

async function loadSettings() {
  loading.value = true

  try {
    const data = await settingsApi.list(keyword.value)
    settings.value = data.map((item) => ({
      ...item,
      draftValue: item.value,
      saving: false,
    }))

    if (!settings.value.length) {
      setFeedback('当前关键字下没有匹配的系统参数。', 'warning')
    } else if (feedback.value?.tone === 'warning') {
      setFeedback('')
    }
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    loading.value = false
  }
}

async function searchSettings() {
  await loadSettings()
}

async function resetSearch() {
  keyword.value = ''
  await loadSettings()
}

async function saveSetting(item) {
  if (!item.editable || item.saving || item.draftValue === item.value) {
    return
  }

  item.saving = true

  try {
    const updated = await settingsApi.update(item.id, item.draftValue)
    item.value = updated.value
    item.draftValue = updated.value
    item.updatedAt = updated.updatedAt
    setFeedback(`参数“${item.note || item.code}”已更新。`, 'success')
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    item.saving = false
  }
}
</script>

<template>
  <section class="content-grid">
    <article class="panel">
      <div class="panel__toolbar panel__toolbar--stack">
        <div>
          <p class="eyebrow">系统管理</p>
          <h1>系统参数</h1>
          <p>直接维护系统参数配置，无需再经过系统管理中心首页。</p>
        </div>

        <form class="account-search" @submit.prevent="searchSettings">
          <label class="field field--inline">
            <span class="field__label">关键字</span>
            <input v-model.trim="keyword" type="text" placeholder="按备注或编码搜索" />
          </label>

          <div class="inline-actions">
            <button type="submit" :disabled="loading">查询</button>
            <button type="button" class="ghost" :disabled="loading" @click="resetSearch">重置</button>
          </div>
        </form>
      </div>

      <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`">
        {{ feedback.message }}
      </div>
    </article>

    <article class="panel">
      <div class="panel__toolbar">
        <div>
          <p class="eyebrow">参数明细</p>
          <h2>共 {{ settings.length }} 条</h2>
        </div>
        <span class="subtle-text">可编辑 {{ editableCount }} 条</span>
      </div>

      <div class="account-table-wrap">
        <table class="account-table settings-table">
          <thead>
            <tr>
              <th>备注</th>
              <th>编码</th>
              <th>参数值</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="empty-cell">参数加载中...</td>
            </tr>
            <tr v-else-if="!settings.length">
              <td colspan="5" class="empty-cell">未找到系统参数。</td>
            </tr>
            <tr v-for="item in settings" :key="item.id">
              <td>{{ item.note || '--' }}</td>
              <td><code>{{ item.code || '--' }}</code></td>
              <td class="settings-table__value">
                <input v-model="item.draftValue" type="text" :disabled="!item.editable || item.saving" />
              </td>
              <td>{{ item.updatedAt || '--' }}</td>
              <td>
                <div class="inline-actions">
                  <span v-if="!item.editable" class="status-pill status-pill--idle">只读</span>
                  <button
                    v-else
                    type="button"
                    class="ghost"
                    :disabled="item.saving || item.draftValue === item.value"
                    @click="saveSetting(item)"
                  >
                    {{ item.saving ? '保存中...' : '保存' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>
