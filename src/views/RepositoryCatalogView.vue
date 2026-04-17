<script setup>
import { onMounted, reactive, ref } from 'vue'
import { platformApi } from '../api/platform'

const rows = ref([])
const loading = ref(false)
const message = ref('')
const form = reactive({
  name: '',
  type: 'object',
  endpoint: '',
  accessKey: 'admin',
  secretKey: 'admin123',
  bucketName: 'backup-data',
  basePath: '/',
  immutableEnabled: 1,
  immutableDays: 7,
  status: 1,
})

async function load() {
  loading.value = true
  try {
    const data = await platformApi.listRepositories({ page: 1, pageSize: 100 })
    rows.value = data.items || []
  } catch (error) {
    message.value = error.message
  } finally {
    loading.value = false
  }
}

async function createRepository() {
  try {
    await platformApi.createRepository(form)
    message.value = '仓库已创建。'
    form.name = ''
    form.endpoint = ''
    await load()
  } catch (error) {
    message.value = error.message
  }
}

onMounted(load)
</script>
<template>
  <section class="page-panel">
    <header class="page-header"><div><p class="eyebrow">Backup Platform</p><h2>仓库管理</h2></div></header>
    <div class="form-grid">
      <input v-model="form.name" class="input-field" placeholder="仓库名称" />
      <select v-model="form.type" class="select-field"><option value="object">对象存储</option><option value="nas">NAS 仓库</option><option value="disc-group">光盘组</option></select>
      <input v-model="form.endpoint" class="input-field" placeholder="Endpoint / 服务器 IP" />
      <input v-model="form.accessKey" class="input-field" placeholder="访问账号" />
      <input v-model="form.secretKey" class="input-field" type="password" placeholder="访问密码" />
      <input v-model="form.bucketName" class="input-field" placeholder="桶 / 路径" />
      <button @click="createRepository">新增仓库</button>
    </div>
    <p v-if="message" class="feedback">{{ message }}</p>
    <div class="table-wrapper"><table><thead><tr><th>ID</th><th>名称</th><th>类型</th><th>端点</th><th>路径</th><th>状态</th></tr></thead><tbody>
      <tr v-for="item in rows" :key="`${item.type}-${item.id}`"><td>{{ item.id }}</td><td>{{ item.name || item.title }}</td><td>{{ item.repositoryType || item.type }}</td><td>{{ item.endpoint || item.serverIp || '--' }}</td><td>{{ item.bucketName || item.path || '--' }}</td><td>{{ item.status || (item.enabled ? 'ENABLED' : 'DISABLED') }}</td></tr>
      <tr v-if="!rows.length && !loading"><td colspan="6" class="empty">暂无仓库</td></tr>
    </tbody></table></div>
  </section>
</template>
