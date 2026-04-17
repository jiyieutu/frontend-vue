<script setup>
import { onMounted, reactive, ref } from 'vue'
import { platformApi } from '../api/platform'

const loading = ref(false)
const message = ref('')
const rows = ref([])
const filters = reactive({ keyword: '' })
const form = reactive({
  type: 'backup-account',
  name: '',
  serverIp: '',
  path: '',
  username: 'root',
  password: 'admin',
  storageType: 2,
  storageId: 0,
  backupType: 1,
  status: 1,
})

async function load() {
  loading.value = true
  try {
    const data = await platformApi.listAssets({ keyword: filters.keyword, page: 1, pageSize: 100 })
    rows.value = data.items || []
  } catch (error) {
    message.value = error.message
  } finally {
    loading.value = false
  }
}

async function createAsset() {
  try {
    await platformApi.createAsset({ ...form })
    message.value = '资产已创建。'
    form.name = ''
    form.serverIp = ''
    form.path = ''
    await load()
  } catch (error) {
    message.value = error.message
  }
}

onMounted(load)
</script>

<template>
  <section class="page-panel">
    <header class="page-header">
      <div>
        <p class="eyebrow">Backup Platform</p>
        <h2>资产管理</h2>
      </div>
      <div class="toolbar">
        <input v-model="filters.keyword" class="input-field" placeholder="按名称或类型搜索" />
        <button class="ghost" @click="load">查询</button>
      </div>
    </header>

    <div class="form-grid">
      <select v-model="form.type" class="select-field">
        <option value="backup-account">备份客户端资产</option>
        <option value="nas-target">NAS 资产</option>
      </select>
      <input v-model="form.name" class="input-field" placeholder="资产名称" />
      <input v-model="form.serverIp" class="input-field" placeholder="服务器 IP" />
      <input v-model="form.path" class="input-field" placeholder="目录 / NAS 路径" />
      <input v-model="form.username" class="input-field" placeholder="用户名" />
      <input v-model="form.password" class="input-field" type="password" placeholder="密码" />
      <button @click="createAsset">新增资产</button>
    </div>

    <p v-if="message" class="feedback">{{ message }}</p>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>ID</th><th>名称</th><th>类型</th><th>地址</th><th>路径</th><th>状态</th></tr></thead>
        <tbody>
          <tr v-for="item in rows" :key="`${item.type}-${item.id}`">
            <td>{{ item.id }}</td>
            <td>{{ item.name }}</td>
            <td>{{ item.assetType || item.type }}</td>
            <td>{{ item.endpoint || '--' }}</td>
            <td>{{ item.path || '--' }}</td>
            <td>{{ item.status }}</td>
          </tr>
          <tr v-if="!rows.length && !loading"><td colspan="6" class="empty">暂无资产</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
