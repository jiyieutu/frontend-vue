<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  errorMessage: {
    type: String,
    default: '',
  },
  initialValue: {
    type: Object,
    default: () => ({}),
  },
  mode: {
    type: String,
    default: 'create',
  },
  open: {
    type: Boolean,
    default: false,
  },
  raidLevelOptions: {
    type: Array,
    default: () => [],
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  typeOptions: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close', 'submit'])

const form = reactive(createDefaultForm())

const STORAGE_TYPE_LABELS = {
  object: '对象存储设备',
  nas: 'NAS 存储设备',
  'disc-group': '光盘匣组设备',
}

const writableTypeOptions = computed(() => props.typeOptions.filter((item) => item.writable))

const selectedType = computed(() =>
  props.typeOptions.find((item) => item.value === form.type) || null,
)

const isObjectType = computed(() => form.type === 'object')
const isDiscGroupType = computed(() => form.type === 'disc-group')

const serverIpLabel = computed(() => (isObjectType.value ? '接入地址 IP' : '服务器 IP'))
const accessKeyLabel = computed(() => (isObjectType.value ? 'AccessKey' : '用户名'))
const secretKeyLabel = computed(() => (isObjectType.value ? 'SecretKey' : '密码'))
const pathLabel = computed(() => (isObjectType.value ? '桶名称' : '目录'))

const localError = computed(() => {
  if (!form.type) {
    return '请选择存储设备类型。'
  }

  if (!form.title.trim()) {
    return isDiscGroupType.value ? '请输入光盘匣组名称。' : '请输入存储设备名称。'
  }

  if (isDiscGroupType.value) {
    return ''
  }

  if (isObjectType.value && !form.serverIp.trim()) {
    return '请输入对象存储接入地址 IP。'
  }

  if (!form.path.trim()) {
    return '请输入桶名称或目录。'
  }

  if (isObjectType.value && (!form.accessKey.trim() || !form.secretKey.trim())) {
    return '请输入对象存储访问凭证。'
  }

  if (isObjectType.value && (!isValidNumber(form.maxSize) || !isValidNumber(form.startSize))) {
    return '请输入合法的容量数值。'
  }

  if (isObjectType.value && (Number(form.maxSize) < 0 || Number(form.startSize) < 0)) {
    return '容量数值必须大于或等于 0。'
  }

  return ''
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetForm()
    }
  },
)

function createDefaultForm() {
  return {
    accessKey: '',
    autoAppend: false,
    availableCandidates: [],
    maxSize: '0',
    members: [],
    path: '',
    raidLevel: 5,
    remark: '',
    secretKey: '',
    selectedCandidateRfids: [],
    selectedMemberRfids: [],
    serverIp: '',
    startSize: '0',
    status: 1,
    title: '',
    type: 'object',
  }
}

function resetForm() {
  const fallbackType = writableTypeOptions.value[0]?.value || 'object'
  const next = {
    ...createDefaultForm(),
    type: fallbackType,
    ...props.initialValue,
  }

  form.accessKey = normalize(next.accessKey)
  form.autoAppend = next.autoAppend === true || Number(next.autoAppend) === 1
  form.availableCandidates = normalizeMembers(next.availableCandidates)
  form.maxSize = normalizeNumber(next.maxSize, '0')
  form.members = normalizeMembers(next.members)
  form.path = normalize(next.path)
  form.raidLevel = normalizeRaidValue(next.raidLevel, props.raidLevelOptions[0]?.value ?? 5)
  form.remark = normalize(next.remark)
  form.secretKey = normalize(next.secretKey)
  form.selectedCandidateRfids = []
  form.selectedMemberRfids = []
  form.serverIp = normalize(next.serverIp)
  form.startSize = normalizeNumber(next.startSize, '0')
  form.status = Number(next.status ?? 1)
  form.title = normalize(next.title)
  form.type = normalize(next.type) || fallbackType
  syncAvailableCandidates()
}

function normalize(value) {
  return value === null || value === undefined ? '' : String(value)
}

function normalizeNumber(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  return String(value)
}

function normalizeRaidValue(value, fallback) {
  const normalized = Number(value)
  if (normalized === 0 || normalized === 5 || normalized === 6) {
    return normalized
  }

  return Number(fallback ?? 5)
}

function normalizeMembers(items) {
  if (!Array.isArray(items)) {
    return []
  }

  const seen = new Set()
  return items
    .map((item) => ({
      barcode: normalize(item?.barcode),
      partCount: Number(item?.partCount ?? 0),
      rfid: normalize(item?.rfid),
      totalCapacityLabel: normalize(item?.totalCapacityLabel),
      updatedAt: normalize(item?.updatedAt),
    }))
    .filter((item) => item.rfid && !seen.has(item.rfid) && seen.add(item.rfid))
}

function isValidNumber(value) {
  return /^-?\d+$/.test(String(value).trim())
}

function formatTypeLabel(item) {
  if (!item) {
    return ''
  }

  return STORAGE_TYPE_LABELS[item.value] || item.label
}

function syncAvailableCandidates() {
  const selectedRfids = new Set(form.members.map((item) => item.rfid))
  form.availableCandidates = form.availableCandidates.filter((item) => !selectedRfids.has(item.rfid))
}

function addSelectedCandidates() {
  if (!form.selectedCandidateRfids.length) {
    return
  }

  const selectedRfids = new Set(form.selectedCandidateRfids)
  const moved = form.availableCandidates.filter((item) => selectedRfids.has(item.rfid))
  if (!moved.length) {
    return
  }

  form.members = [...form.members, ...moved]
  form.availableCandidates = form.availableCandidates.filter((item) => !selectedRfids.has(item.rfid))
  form.selectedCandidateRfids = []
}

function addAllCandidates() {
  if (!form.availableCandidates.length) {
    return
  }

  form.members = [...form.members, ...form.availableCandidates]
  form.availableCandidates = []
  form.selectedCandidateRfids = []
}

function removeSelectedMembers() {
  if (!form.selectedMemberRfids.length) {
    return
  }

  const selectedRfids = new Set(form.selectedMemberRfids)
  const moved = form.members.filter((item) => selectedRfids.has(item.rfid))
  if (!moved.length) {
    return
  }

  form.availableCandidates = [...form.availableCandidates, ...moved].sort((left, right) => left.rfid.localeCompare(right.rfid))
  form.members = form.members.filter((item) => !selectedRfids.has(item.rfid))
  form.selectedMemberRfids = []
}

function removeAllMembers() {
  if (!form.members.length) {
    return
  }

  form.availableCandidates = [...form.availableCandidates, ...form.members].sort((left, right) => left.rfid.localeCompare(right.rfid))
  form.members = []
  form.selectedMemberRfids = []
}

function submit() {
  if (localError.value) {
    return
  }

  emit('submit', {
    accessKey: form.accessKey.trim(),
    autoAppend: form.autoAppend ? 1 : 0,
    maxSize: Number(form.maxSize),
    memberRfids: form.members.map((item) => item.rfid),
    path: form.path.trim(),
    raidLevel: Number(form.raidLevel),
    remark: form.remark.trim(),
    secretKey: form.secretKey.trim(),
    serverIp: form.serverIp.trim(),
    startSize: Number(form.startSize),
    status: Number(form.status),
    title: form.title.trim(),
    type: form.type,
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog dialog--wide storage-target-dialog">
      <header class="dialog__header">
        <div>
          <p class="eyebrow">存储设备</p>
          <h3>{{ mode === 'edit' ? '编辑存储设备' : '新增存储设备' }}</h3>
        </div>
        <button type="button" class="ghost" @click="$emit('close')">关闭</button>
      </header>

      <div class="dialog__body dialog__body--wide">
        <div class="toolbar-grid toolbar-grid--wide">
          <label class="field">
            <span class="field__label">设备类型</span>
            <select v-model="form.type" class="select-field" :disabled="mode === 'edit'">
              <option v-for="item in writableTypeOptions" :key="item.value" :value="item.value">
                {{ formatTypeLabel(item) }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field__label">{{ isDiscGroupType ? '盘匣组名称' : '存储设备名称' }}</span>
            <input
              v-model.trim="form.title"
              type="text"
              maxlength="60"
              :placeholder="isDiscGroupType ? '请输入盘匣组名称' : '请输入存储设备名称'"
            />
          </label>

          <label class="field">
            <span class="field__label">状态</span>
            <select v-model="form.status" class="select-field">
              <option :value="1">启用</option>
              <option :value="0">停用</option>
            </select>
          </label>

          <template v-if="!isDiscGroupType">
            <label class="field">
              <span class="field__label">{{ serverIpLabel }}</span>
              <input v-model.trim="form.serverIp" type="text" :placeholder="isObjectType ? '192.168.1.20' : '选填'" />
            </label>

            <label class="field">
              <span class="field__label">{{ pathLabel }}</span>
              <input
                v-model.trim="form.path"
                type="text"
                :placeholder="isObjectType ? '请输入桶名称' : '/mnt/storage'"
              />
            </label>

            <label class="field">
              <span class="field__label">{{ accessKeyLabel }}</span>
              <input v-model.trim="form.accessKey" type="text" :placeholder="isObjectType ? '请输入 AccessKey' : '选填'" />
            </label>

            <label class="field">
              <span class="field__label">{{ secretKeyLabel }}</span>
              <input v-model.trim="form.secretKey" type="password" :placeholder="isObjectType ? '请输入 SecretKey' : '选填'" />
            </label>

            <label v-if="isObjectType" class="field">
              <span class="field__label">最大容量</span>
              <input v-model.trim="form.maxSize" type="text" placeholder="0" />
            </label>

            <label v-if="isObjectType" class="field">
              <span class="field__label">初始容量</span>
              <input v-model.trim="form.startSize" type="text" placeholder="0" />
            </label>
          </template>

          <template v-else>
            <label class="field">
              <span class="field__label">RAID 等级</span>
              <select v-model="form.raidLevel" class="select-field">
                <option v-for="item in raidLevelOptions" :key="item.value" :value="Number(item.value)">
                  {{ item.label }}
                </option>
              </select>
            </label>

            <label class="field field--checkbox">
              <span class="field__label">自动追加盘匣</span>
              <span class="checkbox-inline">
                <input v-model="form.autoAppend" type="checkbox" />
                <span>启用</span>
              </span>
            </label>

            <label class="field field--span-2">
              <span class="field__label">备注</span>
              <input v-model.trim="form.remark" type="text" maxlength="120" placeholder="选填" />
            </label>
          </template>
        </div>

        <section v-if="!isDiscGroupType" class="detail-card">
          <div class="detail-card__header">
            <div>
              <span class="field__label">{{ formatTypeLabel(selectedType) || '存储设备' }}</span>
              <p class="subtle-text">
                {{
                  isObjectType
                    ? '对象存储通过兼容 S3 的接口进行连通性测试。'
                    : 'NAS 存储作为数据接收目录，通过后端服务进程检测目录可访问性。'
                }}
              </p>
            </div>
            <span class="pill">计划类型 {{ selectedType?.planType ?? '--' }}</span>
          </div>
        </section>

        <section v-else class="detail-card">
          <div class="detail-card__header">
            <div>
              <span class="field__label">光盘匣组成员</span>
              <p class="subtle-text">左侧为可加入的未分组盘匣，右侧为当前光盘匣组成员。</p>
            </div>
            <span class="pill">当前已选 {{ form.members.length }} 个</span>
          </div>

          <div class="disc-group-transfer">
            <section class="disc-group-transfer__pane">
              <header class="disc-group-transfer__title">
                <strong>可用未分组盘匣</strong>
                <span>{{ form.availableCandidates.length }} 个</span>
              </header>

              <div class="disc-group-list">
                <label v-for="item in form.availableCandidates" :key="`available:${item.rfid}`" class="disc-group-item">
                  <input v-model="form.selectedCandidateRfids" type="checkbox" :value="item.rfid" />
                  <div class="disc-group-item__content">
                    <strong>{{ item.rfid }}</strong>
                    <div class="subtle-text">
                      {{ item.barcode || '--' }} · {{ item.totalCapacityLabel || '--' }} · {{ item.partCount || 0 }} Part
                    </div>
                  </div>
                </label>

                <p v-if="!form.availableCandidates.length" class="disc-group-list__empty">当前没有可加入的盘匣。</p>
              </div>
            </section>

            <div class="disc-group-transfer__actions">
              <button type="button" class="ghost" @click="addSelectedCandidates">添加 ></button>
              <button type="button" class="ghost" @click="addAllCandidates">全部 >></button>
              <button type="button" class="ghost" @click="removeSelectedMembers">&lt; 移出</button>
              <button type="button" class="ghost" @click="removeAllMembers">&lt;&lt; 全部</button>
            </div>

            <section class="disc-group-transfer__pane">
              <header class="disc-group-transfer__title">
                <strong>已选盘匣</strong>
                <span>{{ form.members.length }} 个</span>
              </header>

              <div class="disc-group-list">
                <label v-for="item in form.members" :key="`member:${item.rfid}`" class="disc-group-item">
                  <input v-model="form.selectedMemberRfids" type="checkbox" :value="item.rfid" />
                  <div class="disc-group-item__content">
                    <strong>{{ item.rfid }}</strong>
                    <div class="subtle-text">
                      {{ item.barcode || '--' }} · {{ item.totalCapacityLabel || '--' }} · {{ item.partCount || 0 }} Part
                    </div>
                  </div>
                </label>

                <p v-if="!form.members.length" class="disc-group-list__empty">当前还没有加入盘匣。</p>
              </div>
            </section>
          </div>
        </section>

        <p v-if="localError || errorMessage" class="error-text">
          {{ localError || errorMessage }}
        </p>
      </div>

      <footer class="dialog__footer">
        <button type="button" class="ghost" @click="$emit('close')">取消</button>
        <button type="button" :disabled="submitting || !!localError" @click="submit">
          {{ submitting ? '保存中...' : mode === 'edit' ? '保存修改' : '新增存储设备' }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.storage-target-dialog {
  max-height: min(90vh, 920px);
  display: flex;
  flex-direction: column;
}

.storage-target-dialog .dialog__body {
  overflow-y: auto;
}

.field--checkbox {
  justify-content: center;
}

.field--span-2 {
  grid-column: span 2;
}

.checkbox-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  color: rgba(15, 23, 42, 0.78);
}

.disc-group-transfer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 1rem;
  align-items: stretch;
}

.disc-group-transfer__pane {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 1rem;
  background: rgba(248, 250, 252, 0.78);
  min-height: 22rem;
  display: flex;
  flex-direction: column;
}

.disc-group-transfer__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.95rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.disc-group-transfer__title span {
  color: rgba(71, 85, 105, 0.8);
  font-size: 0.86rem;
}

.disc-group-transfer__actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
}

.disc-group-list {
  padding: 0.75rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.disc-group-list__empty {
  margin: auto 0;
  padding: 1.5rem 1rem;
  text-align: center;
  color: rgba(100, 116, 139, 0.88);
}

.disc-group-item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.85rem 0.9rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: white;
  cursor: pointer;
}

.disc-group-item__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.disc-group-item__content strong {
  word-break: break-all;
}

@media (max-width: 960px) {
  .disc-group-transfer {
    grid-template-columns: 1fr;
  }

  .disc-group-transfer__actions {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .field--span-2 {
    grid-column: auto;
  }
}
</style>
