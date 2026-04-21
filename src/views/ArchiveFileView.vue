<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { nasFileApi } from '../api/nas-files'
import { storageTargetApi } from '../api/storage-targets'

const ARCHIVE_UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024
const ARCHIVE_UPLOAD_COMPLETED_STORAGE_KEY = 'archive-upload-completed-files'
const ARCHIVE_PACKAGE_MODE = 'ZIP_FOLDER'
const ZIP_UINT16_MAX = 0xffff
const ZIP_UINT32_MAX = 0xffffffff
const ZIP_VERSION_STANDARD = 20
const ZIP_VERSION_ZIP64 = 45

const feedback = ref(null)
const items = ref([])
const loading = ref(false)
const savingArchiveTarget = ref(false)
const uploading = ref(false)
const folderFastUpload = ref(true)
const storageTargetsLoading = ref(false)
const storageTargetGroups = ref([])
const selectedFiles = ref([])
const uploadProgress = reactive({
  completedFiles: 0,
  currentFileName: '',
  fileCount: 0,
  loaded: 0,
  phase: '',
  percent: 0,
  total: 0,
})

const fileInput = ref(null)
const folderInput = ref(null)

const filters = reactive({
  fileName: '',
})

const browsing = reactive({
  currentPath: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const archiveTarget = reactive({
  type: 'local',
  id: '',
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 20))),
)

const selectedTotalBytes = computed(() =>
  selectedFiles.value.reduce((sum, file) => sum + Number(file.size || 0), 0),
)

const hasFolderSelection = computed(() =>
  selectedFiles.value.some((file) => Boolean(file?.webkitRelativePath)),
)

const archiveTargetTypeOptions = computed(() => [
  {
    code: 'local',
    label: '服务器本地',
    items: [],
  },
  ...storageTargetGroups.value
    .filter((group) => ['nas', 'object', 'disc-group'].includes(group.code))
    .map((group) => ({
      code: group.code,
      label: archiveTargetTypeLabel(group.code),
      items: Array.isArray(group.items) ? group.items : [],
    })),
])

const selectedArchiveTargetGroup = computed(() =>
  archiveTargetTypeOptions.value.find((group) => group.code === archiveTarget.type),
)

const selectedArchiveTargetItems = computed(() =>
  selectedArchiveTargetGroup.value?.items || [],
)

const selectedArchiveTargetLabel = computed(() => {
  if (archiveTarget.type === 'local') {
    return '服务器本地'
  }
  const target = selectedArchiveTargetItems.value.find((item) => String(item.id) === String(archiveTarget.id))
  return target?.label || '未选择目标'
})

const uploadProgressPercent = computed(() => Math.max(0, Math.min(100, Number(uploadProgress.percent || 0))))

const uploadProgressText = computed(() => {
  if (!uploading.value) {
    return ''
  }

  const total = Number(uploadProgress.total || 0)
  const loaded = Math.min(Number(uploadProgress.loaded || 0), total || Number(uploadProgress.loaded || 0))
  const fileCount = Number(uploadProgress.fileCount || 0)
  const completedFiles = Number(uploadProgress.completedFiles || 0)
  const currentFileName = uploadProgress.currentFileName || ''

  if (uploadProgress.phase === 'packing') {
    const current = currentFileName ? `，当前：${currentFileName}` : ''
    return `正在生成极速上传包 ${completedFiles}/${fileCount} 个文件${current}，${formatBytes(loaded)} / ${formatBytes(total)}`
  }

  if (uploadProgress.phase === 'extracting') {
    return '服务端正在安全解包并批量入账，请稍候...'
  }

  if (total > 0) {
    if (currentFileName) {
      return `正在上传 ${completedFiles}/${fileCount} 个文件，当前：${currentFileName}，${formatBytes(loaded)} / ${formatBytes(total)}`
    }
    return `正在上传 ${fileCount} 个文件，${formatBytes(loaded)} / ${formatBytes(total)}`
  }

  return `正在上传 ${fileCount} 个文件，请稍候...`
})

const breadcrumbItems = computed(() => {
  const items = [
    {
      key: 'root',
      label: '全部文件',
      type: 'root',
    },
  ]

  if (!browsing.currentPath) {
    return items
  }

  let currentPath = ''
  browsing.currentPath.split('/').forEach((part, index) => {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    items.push({
      key: `path:${index}:${currentPath}`,
      label: part,
      path: currentPath,
      type: 'folder',
    })
  })

  return items
})

const selectedSummary = computed(() => {
  if (!selectedFiles.value.length) {
    return '未选择文件'
  }

  const sample = selectedFiles.value[0]?.webkitRelativePath || selectedFiles.value[0]?.name || '--'
  const modeText = hasFolderSelection.value && folderFastUpload.value ? '，将使用极速包上传' : ''
  return `已选择 ${selectedFiles.value.length} 个文件，共 ${formatBytes(selectedTotalBytes.value)}${modeText}，示例：${sample}`
})

onMounted(() => {
  loadItems(1, true)
  initializeArchiveTarget()
})

function setFeedback(message, tone = 'info') {
  feedback.value = message
    ? {
        message,
        tone,
      }
    : null
}

function buildParams(page = pagination.page) {
  return {
    currentPath: browsing.currentPath,
    fileName: filters.fileName,
    page,
    pageSize: pagination.pageSize,
  }
}

async function loadItems(page = 1, silent = false) {
  loading.value = true

  try {
    const data = await nasFileApi.listArchive(buildParams(page))
    items.value = data.items || []
    pagination.page = data.page || page
    pagination.pageSize = data.pageSize || pagination.pageSize
    pagination.total = data.total || 0

    if (!items.value.length && !silent) {
      setFeedback('当前条件下没有匹配的归档文件。', 'warning')
    } else if (feedback.value?.tone === 'warning') {
      setFeedback('')
    }
  } catch (error) {
    if (!silent) {
      setFeedback(error.message, 'danger')
    }
  } finally {
    loading.value = false
  }
}

async function loadArchiveTargetOptions() {
  storageTargetsLoading.value = true
  try {
    const data = await storageTargetApi.options()
    storageTargetGroups.value = Array.isArray(data?.groups) ? data.groups : []
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    storageTargetsLoading.value = false
  }
}

async function initializeArchiveTarget() {
  await loadArchiveTargetOptions()
  try {
    const target = await nasFileApi.getArchiveDefaultTarget()
    applyArchiveTarget(target)
  } catch (error) {
    setFeedback(error.message, 'danger')
  }
}

function changeArchiveTargetType(event) {
  archiveTarget.type = event.target.value || 'local'
  archiveTarget.id = ''
}

function applyArchiveTarget(target) {
  const type = target?.archiveTargetType || 'local'
  archiveTarget.type = archiveTargetTypeOptions.value.some((group) => group.code === type) ? type : 'local'
  archiveTarget.id = archiveTarget.type === 'local' ? '' : String(target?.archiveTargetId || '')
}

async function saveArchiveTarget() {
  const payload = buildArchiveTargetPayload()
  if (!payload) {
    return
  }
  savingArchiveTarget.value = true
  try {
    const result = await nasFileApi.saveArchiveDefaultTarget(payload)
    applyArchiveTarget(result)
    setFeedback(`默认归档目标已保存：${result?.archiveTargetLabel || selectedArchiveTargetLabel.value}。`, 'success')
  } catch (error) {
    setFeedback(error.message, 'danger')
  } finally {
    savingArchiveTarget.value = false
  }
}

function buildArchiveTargetPayload() {
  if (archiveTarget.type === 'local') {
    return {
      archiveTargetId: 0,
      archiveTargetType: 'local',
    }
  }
  if (!archiveTarget.id) {
    setFeedback('请选择归档目标存储。', 'warning')
    return null
  }
  return {
    archiveTargetId: Number(archiveTarget.id),
    archiveTargetType: archiveTarget.type,
  }
}

async function submitSearch() {
  pagination.page = 1
  await loadItems(1)
}

async function resetSearch() {
  filters.fileName = ''
  browsing.currentPath = ''
  pagination.page = 1
  await loadItems(1)
}

async function previousPage() {
  if (pagination.page > 1) {
    await loadItems(pagination.page - 1, true)
  }
}

async function nextPage() {
  if (pagination.page < totalPages.value) {
    await loadItems(pagination.page + 1, true)
  }
}

async function openItem(item) {
  if (item?.entryType !== 'folder') {
    return
  }
  browsing.currentPath = item.entryPath || ''
  await loadItems(1, true)
}

async function openBreadcrumb(item) {
  if (!item) {
    return
  }
  browsing.currentPath = item.type === 'root' ? '' : item.path || ''
  await loadItems(1, true)
}

async function goParent() {
  if (!browsing.currentPath) {
    return
  }
  const parts = browsing.currentPath.split('/')
  parts.pop()
  browsing.currentPath = parts.join('/')
  await loadItems(1, true)
}

function triggerFileInput() {
  fileInput.value?.click()
}

function triggerFolderInput() {
  folderInput.value?.click()
}

function handleFileSelection(event) {
  selectedFiles.value = Array.from(event.target?.files || [])
  resetUploadProgress()
}

function handleFolderSelection(event) {
  selectedFiles.value = Array.from(event.target?.files || [])
  resetUploadProgress()
}

async function uploadSelected() {
  if (hasFolderSelection.value && folderFastUpload.value) {
    await uploadSelectedFolderAsPackage()
    return
  }
  await uploadSelectedFilesIndividually()
}

async function uploadSelectedFilesIndividually() {
  if (!selectedFiles.value.length) {
    setFeedback('请先选择要上传的文件或文件夹。', 'warning')
    return
  }
  const targetPayload = buildArchiveTargetPayload()
  if (!targetPayload) {
    return
  }

  const totalBytes = selectedTotalBytes.value
  let overallLoaded = 0
  let created = 0
  let skipped = 0
  let storageFailed = 0
  let storageUploaded = 0
  let updated = 0
  uploadProgress.fileCount = selectedFiles.value.length
  uploadProgress.completedFiles = 0
  uploadProgress.currentFileName = ''
  uploadProgress.loaded = 0
  uploadProgress.phase = 'uploading'
  uploadProgress.percent = 0
  uploadProgress.total = totalBytes
  uploading.value = true

  try {
    for (let index = 0; index < selectedFiles.value.length; index += 1) {
      const file = selectedFiles.value[index]
      const relativePath = buildRelativePath(file)
      const totalChunks = buildTotalChunks(file)
      uploadProgress.currentFileName = relativePath

      if (hasCompletedUpload(file)) {
        overallLoaded += Number(file.size || 0)
        syncUploadProgress(overallLoaded, totalBytes)
        skipped += 1
        uploadProgress.completedFiles = index + 1
        continue
      }

      const session = await nasFileApi.initArchiveUpload({
        chunkSize: ARCHIVE_UPLOAD_CHUNK_SIZE,
        fileName: file.name,
        fileSize: Number(file.size || 0),
        lastModified: Number(file.lastModified || 0),
        relativePath,
        totalChunks,
        ...targetPayload,
      })

      const resumedBytes = Math.min(Number(session?.uploadedBytes || 0), Number(file.size || 0))
      overallLoaded += resumedBytes
      syncUploadProgress(overallLoaded, totalBytes)

      const startChunkIndex = Math.max(0, Number(session?.nextChunkIndex || 0))
      for (let chunkIndex = startChunkIndex; chunkIndex < totalChunks; chunkIndex += 1) {
        const chunk = sliceUploadChunk(file, chunkIndex)
        const formData = new FormData()
        formData.append('uploadId', session.uploadId)
        formData.append('chunkIndex', String(chunkIndex))
        formData.append('chunk', chunk, `${file.name}.part`)
        await nasFileApi.uploadArchiveChunk(formData)
        overallLoaded += chunk.size
        syncUploadProgress(overallLoaded, totalBytes)
      }

      const result = await nasFileApi.completeArchiveUpload({
        uploadId: session.uploadId,
      })
      if (result?.created) {
        created += 1
      } else {
        updated += 1
      }
      storageUploaded += Number(result?.storageUploaded || 0)
      storageFailed += Number(result?.storageFailed || 0)
      markCompletedUpload(file)
      uploadProgress.completedFiles = index + 1
    }

    uploadProgress.currentFileName = ''
    syncUploadProgress(totalBytes, totalBytes)
    clearSelection()
    filters.fileName = ''
    browsing.currentPath = ''
    const storageText = archiveTarget.type === 'local'
      ? `归档目标：${selectedArchiveTargetLabel.value}`
      : `目标写入 ${storageUploaded} 个，失败 ${storageFailed} 个`
    setFeedback(
      `上传完成：新增 ${created} 个，更新 ${updated} 个，跳过 ${skipped} 个已完成文件；${storageText}。`,
      storageFailed > 0 ? 'warning' : 'success',
    )
    await loadItems(1, true)
  } catch (error) {
    const currentFileName = uploadProgress.currentFileName || '当前文件'
    setFeedback(
      `${currentFileName} 上传中断：${error.message}。已保留已完成分片，再次点击“开始上传”会继续传输。`,
      'warning',
    )
  } finally {
    uploading.value = false
  }
}

async function uploadSelectedFolderAsPackage() {
  if (!selectedFiles.value.length) {
    setFeedback('请先选择要上传的文件夹。', 'warning')
    return
  }
  const targetPayload = buildArchiveTargetPayload()
  if (!targetPayload) {
    return
  }

  const files = buildPackageFileList(selectedFiles.value)
  if (!files.length) {
    setFeedback('未找到可上传的文件。', 'warning')
    return
  }

  const totalBytes = files.reduce((sum, item) => sum + Number(item.file.size || 0), 0)
  const packageName = buildPackageName(files, totalBytes)
  const packageLastModified = buildPackageLastModified(files)

  uploadProgress.fileCount = files.length
  uploadProgress.completedFiles = 0
  uploadProgress.currentFileName = ''
  uploadProgress.loaded = 0
  uploadProgress.phase = 'packing'
  uploadProgress.percent = 0
  uploadProgress.total = totalBytes
  uploading.value = true

  try {
    const packageBlob = await buildZipPackage(files, (progress) => {
      uploadProgress.completedFiles = progress.completedFiles
      uploadProgress.currentFileName = progress.currentFileName
      syncUploadProgress(progress.loaded, totalBytes)
    })

    uploadProgress.phase = 'uploading'
    uploadProgress.fileCount = 1
    uploadProgress.completedFiles = 0
    uploadProgress.currentFileName = packageName
    uploadProgress.loaded = 0
    uploadProgress.total = packageBlob.size
    uploadProgress.percent = 0

    const totalChunks = buildTotalChunks(packageBlob)
    const session = await nasFileApi.initArchiveUpload({
      chunkSize: ARCHIVE_UPLOAD_CHUNK_SIZE,
      fileName: packageName,
      fileSize: Number(packageBlob.size || 0),
      lastModified: packageLastModified,
      packageFileCount: files.length,
      packageMode: ARCHIVE_PACKAGE_MODE,
      packageUncompressedSize: totalBytes,
      packageUpload: true,
      relativePath: `.upload-packages/${packageName}`,
      sourceFolderName: buildSourceFolderName(files),
      totalChunks,
      ...targetPayload,
    })

    const startChunkIndex = Math.max(0, Number(session?.nextChunkIndex || 0))
    let uploadedBytes = Math.min(Number(session?.uploadedBytes || 0), Number(packageBlob.size || 0))
    syncUploadProgress(uploadedBytes, packageBlob.size)
    for (let chunkIndex = startChunkIndex; chunkIndex < totalChunks; chunkIndex += 1) {
      const chunk = sliceUploadChunk(packageBlob, chunkIndex)
      const formData = new FormData()
      formData.append('uploadId', session.uploadId)
      formData.append('chunkIndex', String(chunkIndex))
      formData.append('chunk', chunk, `${packageName}.part`)
      await nasFileApi.uploadArchiveChunk(formData)
      uploadedBytes += chunk.size
      syncUploadProgress(uploadedBytes, packageBlob.size)
    }

    uploadProgress.phase = 'extracting'
    uploadProgress.completedFiles = 1
    syncUploadProgress(packageBlob.size, packageBlob.size)
    const result = await nasFileApi.completeArchiveUpload({
      uploadId: session.uploadId,
    })

    clearSelection()
    filters.fileName = ''
    browsing.currentPath = ''
    setFeedback(result?.message || '极速上传完成。', Number(result?.storageFailed || 0) > 0 ? 'warning' : 'success')
    await loadItems(1, true)
  } catch (error) {
    setFeedback(`文件夹极速上传中断：${error.message}`, 'warning')
  } finally {
    uploading.value = false
  }
}

function buildRelativePath(file) {
  return file?.webkitRelativePath || file?.name || `upload_${Date.now()}`
}

function buildCompletedUploadKey(file) {
  return `${buildRelativePath(file)}|${Number(file?.size || 0)}|${Number(file?.lastModified || 0)}|${archiveTarget.type}|${archiveTarget.id || 0}`
}

function loadCompletedUploadKeys() {
  try {
    const rawValue = window.localStorage.getItem(ARCHIVE_UPLOAD_COMPLETED_STORAGE_KEY)
    if (!rawValue) {
      return []
    }
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

function saveCompletedUploadKeys(keys) {
  try {
    window.localStorage.setItem(ARCHIVE_UPLOAD_COMPLETED_STORAGE_KEY, JSON.stringify(keys.slice(-500)))
  } catch (error) {
    // Ignore storage failures and continue with in-memory upload flow.
  }
}

function hasCompletedUpload(file) {
  const key = buildCompletedUploadKey(file)
  return loadCompletedUploadKeys().includes(key)
}

function markCompletedUpload(file) {
  const key = buildCompletedUploadKey(file)
  const keys = loadCompletedUploadKeys()
  if (!keys.includes(key)) {
    keys.push(key)
    saveCompletedUploadKeys(keys)
  }
}

function buildTotalChunks(file) {
  const size = Number(file?.size || 0)
  if (size <= 0) {
    return 0
  }
  return Math.ceil(size / ARCHIVE_UPLOAD_CHUNK_SIZE)
}

function sliceUploadChunk(file, chunkIndex) {
  const start = chunkIndex * ARCHIVE_UPLOAD_CHUNK_SIZE
  const end = Math.min(Number(file.size || 0), start + ARCHIVE_UPLOAD_CHUNK_SIZE)
  return file.slice(start, end)
}

function buildPackageFileList(files) {
  return Array.from(files || [])
    .map((file) => ({
      file,
      relativePath: normalizeZipEntryName(buildRelativePath(file)),
    }))
    .filter((item) => item.file && item.relativePath)
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

async function buildZipPackage(files, onProgress) {
  const parts = []
  const centralDirectoryParts = []
  let offset = 0
  let hashedBytes = 0

  for (let index = 0; index < files.length; index += 1) {
    const item = files[index]
    const file = item.file
    const relativePath = item.relativePath
    const fileSize = Number(file.size || 0)
    assertZip64SafeInteger(fileSize, '单个文件大小')
    assertZip64SafeInteger(offset, 'ZIP 包偏移量')

    const nameBytes = new TextEncoder().encode(relativePath)
    const timeInfo = toZipDosDateTime(Number(file.lastModified || 0))
    const localHeaderOffset = offset
    const crc32 = await calculateBlobCrc32(file, (bytesRead) => {
      hashedBytes += bytesRead
      if (onProgress) {
        onProgress({
          completedFiles: index,
          currentFileName: relativePath,
          loaded: hashedBytes,
        })
      }
    })

    const localHeader = createZipLocalHeader(nameBytes, timeInfo, crc32, fileSize)
    const centralDirectoryHeader = createZipCentralDirectoryHeader(nameBytes, timeInfo, crc32, fileSize, localHeaderOffset)

    parts.push(localHeader, file)
    centralDirectoryParts.push(centralDirectoryHeader)
    offset += localHeader.byteLength + fileSize
    assertZip64SafeInteger(offset, 'ZIP 包偏移量')

    if (onProgress) {
      onProgress({
        completedFiles: index + 1,
        currentFileName: relativePath,
        loaded: hashedBytes,
      })
    }
  }

  const centralDirectoryOffset = offset
  let centralDirectorySize = 0
  centralDirectoryParts.forEach((part) => {
    centralDirectorySize += part.byteLength
  })
  assertZip64SafeInteger(centralDirectorySize, 'ZIP 目录大小')
  assertZip64SafeInteger(centralDirectoryOffset + centralDirectorySize, 'ZIP 包大小')

  const endRecords = createZipEndRecords(files.length, centralDirectorySize, centralDirectoryOffset)
  return new Blob([...parts, ...centralDirectoryParts, ...endRecords], {
    type: 'application/zip',
  })
}

async function calculateBlobCrc32(blob, onRead) {
  let crc = 0 ^ -1
  if (blob.stream) {
    const reader = blob.stream().getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        if (value?.length) {
          crc = updateCrc32(crc, value)
          if (onRead) {
            onRead(value.length)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  } else {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    crc = updateCrc32(crc, bytes)
    if (onRead) {
      onRead(bytes.length)
    }
  }
  return (crc ^ -1) >>> 0
}

function updateCrc32(crc, bytes) {
  const table = getCrc32Table()
  let value = crc
  for (let index = 0; index < bytes.length; index += 1) {
    value = (value >>> 8) ^ table[(value ^ bytes[index]) & 0xff]
  }
  return value
}

let crc32Table = null

function getCrc32Table() {
  if (crc32Table) {
    return crc32Table
  }
  crc32Table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    crc32Table[index] = value >>> 0
  }
  return crc32Table
}

function createZipLocalHeader(nameBytes, timeInfo, crc32, fileSize) {
  const sizeZip64 = needsZip64(fileSize)
  const extra = sizeZip64 ? createZip64ExtraField([fileSize, fileSize]) : new Uint8Array(0)
  const header = new Uint8Array(30 + nameBytes.length + extra.length)
  const view = new DataView(header.buffer)
  setZipUint32(view, 0, 0x04034b50)
  setZipUint16(view, 4, sizeZip64 ? ZIP_VERSION_ZIP64 : ZIP_VERSION_STANDARD)
  setZipUint16(view, 6, 0x0800)
  setZipUint16(view, 8, 0)
  setZipUint16(view, 10, timeInfo.time)
  setZipUint16(view, 12, timeInfo.date)
  setZipUint32(view, 14, crc32)
  setZipUint32(view, 18, sizeZip64 ? ZIP_UINT32_MAX : fileSize)
  setZipUint32(view, 22, sizeZip64 ? ZIP_UINT32_MAX : fileSize)
  setZipUint16(view, 26, nameBytes.length)
  setZipUint16(view, 28, extra.length)
  header.set(nameBytes, 30)
  header.set(extra, 30 + nameBytes.length)
  return header
}

function createZipCentralDirectoryHeader(nameBytes, timeInfo, crc32, fileSize, localHeaderOffset) {
  const sizeZip64 = needsZip64(fileSize)
  const offsetZip64 = needsZip64(localHeaderOffset)
  const zip64Values = []
  if (sizeZip64) {
    zip64Values.push(fileSize, fileSize)
  }
  if (offsetZip64) {
    zip64Values.push(localHeaderOffset)
  }
  const extra = zip64Values.length ? createZip64ExtraField(zip64Values) : new Uint8Array(0)
  const header = new Uint8Array(46 + nameBytes.length + extra.length)
  const view = new DataView(header.buffer)
  const version = zip64Values.length ? ZIP_VERSION_ZIP64 : ZIP_VERSION_STANDARD
  setZipUint32(view, 0, 0x02014b50)
  setZipUint16(view, 4, version)
  setZipUint16(view, 6, version)
  setZipUint16(view, 8, 0x0800)
  setZipUint16(view, 10, 0)
  setZipUint16(view, 12, timeInfo.time)
  setZipUint16(view, 14, timeInfo.date)
  setZipUint32(view, 16, crc32)
  setZipUint32(view, 20, sizeZip64 ? ZIP_UINT32_MAX : fileSize)
  setZipUint32(view, 24, sizeZip64 ? ZIP_UINT32_MAX : fileSize)
  setZipUint16(view, 28, nameBytes.length)
  setZipUint16(view, 30, extra.length)
  setZipUint16(view, 32, 0)
  setZipUint16(view, 34, 0)
  setZipUint16(view, 36, 0)
  setZipUint32(view, 38, 0)
  setZipUint32(view, 42, offsetZip64 ? ZIP_UINT32_MAX : localHeaderOffset)
  header.set(nameBytes, 46)
  header.set(extra, 46 + nameBytes.length)
  return header
}

function createZipEndRecords(fileCount, centralDirectorySize, centralDirectoryOffset) {
  const zip64Required =
    fileCount > ZIP_UINT16_MAX ||
    centralDirectorySize > ZIP_UINT32_MAX ||
    centralDirectoryOffset > ZIP_UINT32_MAX
  const endRecord = createZipEndRecord(fileCount, centralDirectorySize, centralDirectoryOffset, zip64Required)
  if (!zip64Required) {
    return [endRecord]
  }

  const zip64EndRecordOffset = centralDirectoryOffset + centralDirectorySize
  const zip64EndRecord = createZip64EndRecord(fileCount, centralDirectorySize, centralDirectoryOffset)
  const zip64Locator = createZip64EndLocator(zip64EndRecordOffset)
  return [zip64EndRecord, zip64Locator, endRecord]
}

function createZipEndRecord(fileCount, centralDirectorySize, centralDirectoryOffset, zip64Required = false) {
  const record = new Uint8Array(22)
  const view = new DataView(record.buffer)
  setZipUint32(view, 0, 0x06054b50)
  setZipUint16(view, 4, 0)
  setZipUint16(view, 6, 0)
  setZipUint16(view, 8, zip64Required ? ZIP_UINT16_MAX : fileCount)
  setZipUint16(view, 10, zip64Required ? ZIP_UINT16_MAX : fileCount)
  setZipUint32(view, 12, zip64Required ? ZIP_UINT32_MAX : centralDirectorySize)
  setZipUint32(view, 16, zip64Required ? ZIP_UINT32_MAX : centralDirectoryOffset)
  setZipUint16(view, 20, 0)
  return record
}

function createZip64EndRecord(fileCount, centralDirectorySize, centralDirectoryOffset) {
  const record = new Uint8Array(56)
  const view = new DataView(record.buffer)
  setZipUint32(view, 0, 0x06064b50)
  setZipUint64(view, 4, 44)
  setZipUint16(view, 12, ZIP_VERSION_ZIP64)
  setZipUint16(view, 14, ZIP_VERSION_ZIP64)
  setZipUint32(view, 16, 0)
  setZipUint32(view, 20, 0)
  setZipUint64(view, 24, fileCount)
  setZipUint64(view, 32, fileCount)
  setZipUint64(view, 40, centralDirectorySize)
  setZipUint64(view, 48, centralDirectoryOffset)
  return record
}

function createZip64EndLocator(zip64EndRecordOffset) {
  const locator = new Uint8Array(20)
  const view = new DataView(locator.buffer)
  setZipUint32(view, 0, 0x07064b50)
  setZipUint32(view, 4, 0)
  setZipUint64(view, 8, zip64EndRecordOffset)
  setZipUint32(view, 16, 1)
  return locator
}

function createZip64ExtraField(values) {
  const extra = new Uint8Array(4 + values.length * 8)
  const view = new DataView(extra.buffer)
  setZipUint16(view, 0, 0x0001)
  setZipUint16(view, 2, values.length * 8)
  values.forEach((value, index) => {
    setZipUint64(view, 4 + index * 8, value)
  })
  return extra
}

function setZipUint16(view, offset, value) {
  view.setUint16(offset, Number(value || 0), true)
}

function setZipUint32(view, offset, value) {
  view.setUint32(offset, Number(value || 0) >>> 0, true)
}

function setZipUint64(view, offset, value) {
  assertZip64SafeInteger(value, 'ZIP64 数值')
  view.setBigUint64(offset, BigInt(value), true)
}

function needsZip64(value) {
  return Number(value || 0) >= ZIP_UINT32_MAX
}

function assertZip64SafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} 超出浏览器可安全处理范围，请分批上传。`)
  }
}

function toZipDosDateTime(value) {
  const date = new Date(value || Date.now())
  const year = Math.max(1980, date.getFullYear())
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  }
}

function buildPackageName(files, totalBytes) {
  const folderName = sanitizePackageName(buildSourceFolderName(files))
  const lastModified = buildPackageLastModified(files)
  return `${folderName}-${files.length}-${totalBytes}-${lastModified}.zip`
}

function buildPackageLastModified(files) {
  return files.reduce((maxValue, item) => Math.max(maxValue, Number(item.file?.lastModified || 0)), 0)
}

function buildSourceFolderName(files) {
  const firstPath = files.find((item) => item.file?.webkitRelativePath)?.file?.webkitRelativePath || ''
  const firstPart = firstPath.split('/').filter(Boolean)[0]
  return firstPart || 'archive-folder'
}

function normalizeZipEntryName(path) {
  const value = String(path || '').replace(/\\/g, '/').replace(/^\/+/, '').trim()
  const parts = value
    .split('/')
    .map((part) => sanitizeZipPathPart(part))
    .filter(Boolean)
  return parts.join('/')
}

function sanitizeZipPathPart(part) {
  const value = String(part || '').trim()
  if (!value || value === '.' || value === '..') {
    return ''
  }
  return value.replace(/[:*?"<>|']/g, '_')
}

function sanitizePackageName(value) {
  return sanitizeZipPathPart(value).replace(/\s+/g, '_') || 'archive-folder'
}

function syncUploadProgress(loaded, total) {
  const safeTotal = Number(total || 0)
  const safeLoaded = Math.min(Number(loaded || 0), safeTotal || Number(loaded || 0))
  uploadProgress.loaded = safeLoaded
  uploadProgress.total = safeTotal
  uploadProgress.percent = safeTotal > 0 ? Math.min(100, Math.round((safeLoaded / safeTotal) * 100)) : 100
}

function clearSelection() {
  selectedFiles.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  if (folderInput.value) {
    folderInput.value.value = ''
  }
}

function resetUploadProgress() {
  uploadProgress.completedFiles = 0
  uploadProgress.currentFileName = ''
  uploadProgress.fileCount = 0
  uploadProgress.loaded = 0
  uploadProgress.phase = ''
  uploadProgress.percent = 0
  uploadProgress.total = 0
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }
  return value
}

function formatExists(value) {
  return value ? '存在' : '缺失'
}

function typeLabel(value) {
  return value === 'folder' ? '文件夹' : '文件'
}

function archiveTargetTypeLabel(value) {
  if (value === 'object') {
    return '对象存储'
  }
  if (value === 'nas') {
    return 'NAS'
  }
  if (value === 'disc-group') {
    return '光盘库'
  }
  return '服务器本地'
}

function formatBytes(bytes) {
  const value = Number(bytes || 0)
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(2)} KB`
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(2)} MB`
  }
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
}

async function jumpToPage(event) {
  const target = Number(event.target.value)
  if (target >= 1 && target <= totalPages.value && target !== pagination.page) {
    pagination.page = target
    await loadItems(target, true)
  } else {
    event.target.value = pagination.page
  }
}

async function changePageSize(event) {
  const newSize = Number(event.target.value)
  if (newSize !== pagination.pageSize) {
    pagination.pageSize = newSize
    pagination.page = 1
    await loadItems(1, true)
  }
}
</script>

<template>
  <section class="content-grid">
    <article class="panel">
      <div class="panel__toolbar panel__toolbar--stack">
        <div>
          <p class="eyebrow">归档上传</p>
          <h2>上传归档文件</h2>
        </div>

        <div class="inline-actions">
          <button type="button" class="ghost" :disabled="uploading" @click="triggerFileInput">选择文件</button>
          <button type="button" class="ghost" :disabled="uploading" @click="triggerFolderInput">选择文件夹</button>
          <button type="button" :disabled="uploading || !selectedFiles.length" @click="uploadSelected">
            {{ uploading ? '上传中...' : '开始上传' }}
          </button>
        </div>
      </div>

      <div class="path-toolbar" style="margin-bottom: 1.5rem;">
        <div class="path-breadcrumb">
          <button
            v-for="item in breadcrumbItems"
            :key="item.key"
            type="button"
            class="link-button"
            @click="openBreadcrumb(item)"
          >
            {{ item.label }}
          </button>
        </div>

        <button type="button" class="ghost" :disabled="!browsing.currentPath" @click="goParent">
          返回上一级
        </button>
      </div>

      <div v-if="feedback" class="banner" :class="`banner--${feedback.tone}`" style="margin-bottom: 1.5rem;">
        {{ feedback.message }}
      </div>

      <div class="upload-summary">
        <div class="archive-target-grid">
          <label class="field">
            <span class="field__label">归档目标类型</span>
            <select :value="archiveTarget.type" :disabled="uploading || storageTargetsLoading" @change="changeArchiveTargetType">
              <option v-for="group in archiveTargetTypeOptions" :key="group.code" :value="group.code">
                {{ group.label }}
              </option>
            </select>
          </label>

          <label v-if="archiveTarget.type !== 'local'" class="field">
            <span class="field__label">归档目标</span>
            <select v-model="archiveTarget.id" :disabled="uploading || storageTargetsLoading">
              <option value="">请选择</option>
              <option v-for="target in selectedArchiveTargetItems" :key="target.id" :value="target.id">
                {{ target.label }}
              </option>
            </select>
          </label>

          <p class="archive-target-hint">
            当前目标：{{ selectedArchiveTargetLabel }}
          </p>

          <button
            type="button"
            class="ghost"
            :disabled="uploading || savingArchiveTarget || storageTargetsLoading"
            @click="saveArchiveTarget"
          >
            {{ savingArchiveTarget ? '保存中...' : '保存默认目标' }}
          </button>
        </div>

        <p>{{ selectedSummary }}</p>

        <label v-if="hasFolderSelection" class="upload-mode-option">
          <input v-model="folderFastUpload" type="checkbox" :disabled="uploading" />
          <span>极速模式：ZIP64 打包目录后分片上传，适合大量文件和大文件</span>
        </label>

        <div
          v-if="uploading"
          class="upload-progress"
          role="progressbar"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-valuenow="uploadProgressPercent"
        >
          <div class="upload-progress__meta">
            <strong>上传进度 {{ uploadProgressPercent }}%</strong>
            <span>{{ uploadProgressText }}</span>
          </div>
          <div class="upload-progress__track">
            <div class="upload-progress__fill" :style="{ width: `${uploadProgressPercent}%` }"></div>
          </div>
        </div>
      </div>

      <input ref="fileInput" type="file" multiple hidden @change="handleFileSelection" />
      <input ref="folderInput" type="file" multiple webkitdirectory directory hidden @change="handleFolderSelection" />
    </article>

    <article class="panel">
      <div class="panel__toolbar panel__toolbar--stack">
        <div>
          <p class="eyebrow">查询条件</p>
          <h2>归档目录检索</h2>
          <p class="subtle-text" style="margin-top: 0.5rem; display: flex; gap: 1.5rem;">
            <span>当前结果：<strong style="color: var(--text);">{{ pagination.total }}</strong></span>
          </p>
        </div>
      </div>

      <form class="toolbar-grid toolbar-grid--wide" @submit.prevent="submitSearch">
        <label class="field">
          <span class="field__label">文件名称</span>
          <input v-model.trim="filters.fileName" type="text" placeholder="支持模糊检索" />
        </label>

        <div class="inline-actions">
          <button type="submit" :disabled="loading">查询</button>
          <button type="button" class="ghost" :disabled="loading" @click="resetSearch">重置</button>
        </div>
      </form>
    </article>

    <article class="panel">
      <div class="panel__toolbar">
        <div>
          <p class="eyebrow">结果列表</p>
          <h2>共 {{ pagination.total }} 条</h2>
        </div>
      </div>

      <div class="account-table-wrap">
        <table class="account-table resource-table">
          <thead>
            <tr>
              <th>类型</th>
              <th>文件名称</th>
              <th>大小/数量</th>
              <th>归档目标</th>
              <th>归档时间</th>
              <th>本地状态</th>
              <th>本地路径</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="empty-cell">正在加载归档文件...</td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="7" class="empty-cell">未找到归档文件。</td>
            </tr>
            <tr v-for="item in items" :key="`${item.entryType}:${item.entryPath || item.fileName}`">
              <td>
                <span class="status-pill" :class="item.entryType === 'folder' ? 'status-pill--info' : 'status-pill--active'">
                  {{ typeLabel(item.entryType) }}
                </span>
              </td>
              <td>
                <button
                  v-if="item.entryType === 'folder'"
                  type="button"
                  class="link-button"
                  @click="openItem(item)"
                >
                  {{ item.fileName }}
                </button>
                <strong v-else>{{ item.fileName }}</strong>
              </td>
              <td>{{ formatValue(item.fileSizeLabel) }}</td>
              <td>{{ formatValue(item.storageTargetLabel) }}</td>
              <td>{{ formatValue(item.uploadStartTime) }}</td>
              <td>
                <span class="status-pill" :class="item.fileExists ? 'status-pill--active' : 'status-pill--idle'">
                  {{ formatExists(item.fileExists) }}
                </span>
              </td>
              <td>{{ formatValue(item.localFullName) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="panel__footer" style="display: flex; justify-content: flex-end; margin-top: 1rem;">
        <div class="page-nav">
          <select
            class="input-field"
            style="width: 8rem; padding: 0.1rem;"
            :value="pagination.pageSize"
            @change="changePageSize"
          >
            <option :value="10">10 条/页</option>
            <option :value="20">20 条/页</option>
            <option :value="50">50 条/页</option>
            <option :value="100">100 条/页</option>
          </select>

          <button type="button" class="ghost" :disabled="loading || pagination.page <= 1" @click="previousPage">
            上一页
          </button>
          <span style="display: flex; align-items: center; gap: 0.5rem;">
            第
            <input
              type="number"
              :value="pagination.page"
              class="input-field"
              style="width: 4rem; text-align: center; padding: 0.1rem;"
              :min="1"
              :max="totalPages"
              @change="jumpToPage"
            />
            页 / {{ totalPages }}
          </span>
          <button type="button" class="ghost" :disabled="loading || pagination.page >= totalPages" @click="nextPage">
            下一页
          </button>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.content-grid,
.panel {
  min-width: 0;
}

.account-table-wrap {
  overflow: auto;
  max-height: calc(100vh - 420px);
  min-height: 200px;
}

.archive-target-grid {
  align-items: end;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: minmax(10rem, 14rem) minmax(14rem, 22rem) 1fr auto;
  margin-bottom: 0.75rem;
}

.archive-target-hint {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0 0 0.7rem;
}

.upload-mode-option {
  align-items: center;
  color: var(--muted);
  display: flex;
  font-size: 0.9rem;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

@media (max-width: 900px) {
  .archive-target-grid {
    grid-template-columns: 1fr;
  }

  .archive-target-hint {
    margin-bottom: 0;
  }
}
</style>
