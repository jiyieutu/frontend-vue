<script setup>
import { onMounted, reactive, ref } from 'vue'
import { platformApi } from '../api/platform'

const templates = ref([])
const preview = ref(null)
const message = ref('')
const form = reactive({ code: 'custom-template', name: '自定义模板', category: 'report', sectionsText: `总览
趋势
风险`, theme: 'operations' })

async function load() {
  try {
    const data = await platformApi.listTemplates({ page: 1, pageSize: 20 })
    templates.value = data.items || []
  } catch (error) {
    message.value = error.message
  }
}

async function previewTemplate() {
  try {
    preview.value = await platformApi.previewTemplate(payload())
  } catch (error) {
    message.value = error.message
  }
}

async function saveTemplate() {
  try {
    await platformApi.saveTemplate(payload())
    message.value = '模板已保存。'
    await load()
  } catch (error) {
    message.value = error.message
  }
}

function payload() {
  return {
    code: form.code,
    name: form.name,
    category: form.category,
    schema: { sections: form.sectionsText.split(/\n+/).map(item => item.trim()).filter(Boolean), theme: form.theme },
    preview: { theme: form.theme }
  }
}

onMounted(async () => { await load(); await previewTemplate() })
</script>
<template>
  <section class="page-panel page-grid-two">
    <div>
      <header class="page-header"><div><p class="eyebrow">P4 Delivery</p><h2>报表模板设计</h2></div></header>
      <div class="form-grid form-grid--single">
        <input v-model="form.code" class="input-field" placeholder="模板编码" />
        <input v-model="form.name" class="input-field" placeholder="模板名称" />
        <select v-model="form.category" class="select-field"><option value="report">report</option><option value="audit">audit</option><option value="dashboard">dashboard</option></select>
        <textarea v-model="form.sectionsText" class="textarea-field" placeholder="每行一个章节"></textarea>
        <div class="toolbar"><button class="ghost" @click="previewTemplate">预览</button><button @click="saveTemplate">保存模板</button></div>
      </div>
      <p v-if="message" class="feedback">{{ message }}</p>
    </div>
    <div>
      <header class="page-header"><div><p class="eyebrow">Template List</p><h2>现有模板</h2></div></header>
      <div class="table-wrapper"><table><thead><tr><th>编码</th><th>名称</th><th>分类</th></tr></thead><tbody><tr v-for="item in templates" :key="item.id"><td>{{ item.code }}</td><td>{{ item.name }}</td><td>{{ item.category }}</td></tr></tbody></table></div>
      <div v-if="preview" class="summary-card"><h3>{{ preview.title }}</h3><pre>{{ JSON.stringify(preview, null, 2) }}</pre></div>

    </div>
  </section>
</template>
