import { apiBaseUrl } from './config'
import { clearSession, sessionState } from './session'

const FRIENDLY_MESSAGES = {
  ADMIN_REQUIRED: '只有管理员可以执行当前操作。',
  OPERATION_LOG_ID_INVALID: '操作日志 ID 无效。',
  OPERATION_LOG_NOT_FOUND: '未找到所选操作日志。',
  ROLE_CODE_REQUIRED: '请输入角色编码。',
  ROLE_CODE_TOO_LONG: '角色编码长度超出限制。',
  ROLE_CREATE_FAILED: '角色创建失败。',
  ROLE_DUPLICATE_CODE: '角色编码已存在。',
  ROLE_DUPLICATE_NAME: '角色名称已存在。',
  ROLE_ENABLE_INVALID: '角色状态无效。',
  ROLE_ID_INVALID: '角色 ID 无效。',
  ROLE_MENU_INVALID: '所选菜单无效。',
  ROLE_NAME_REQUIRED: '请输入角色名称。',
  ROLE_NAME_TOO_LONG: '角色名称长度超出限制。',
  ROLE_NOT_FOUND: '未找到所选角色。',
  ROLE_PROTECTED: '管理员角色不允许修改或删除。',
  USER_CODE_REQUIRED: '请输入用户账号。',
  USER_CODE_TOO_LONG: '用户账号长度超出限制。',
  USER_CREATE_FAILED: '用户创建失败。',
  USER_DUPLICATE_CODE: '用户账号已存在。',
  USER_DUPLICATE_NAME: '用户姓名已存在。',
  USER_ID_INVALID: '用户 ID 无效。',
  USER_NAME_REQUIRED: '请输入用户姓名。',
  USER_NAME_TOO_LONG: '用户姓名长度超出限制。',
  USER_PASSWORD_MISMATCH: '两次输入的密码不一致。',
  USER_PASSWORD_REQUIRED: '请输入用户密码。',
  USER_PROTECTED: '管理员用户不允许修改或删除。',
  USER_ROLE_FORBIDDEN: '管理员角色不能授予该用户。',
  USER_ROLE_INVALID: '所选角色无效。',
  ACCOUNT_BUSY: '该账号下仍有运行中的任务，不能删除。',
  ACCOUNT_NOT_FOUND: '未找到所选账号。',
  BACKUP_ACCOUNT_CREATE_FAILED: '备份账户创建失败。',
  BACKUP_ACCOUNT_DIR_REQUIRED: '请输入备份源路径。',
  BACKUP_ACCOUNT_DIR_TOO_LONG: '备份源路径长度超出限制。',
  BACKUP_ACCOUNT_DUPLICATE: '已存在相同客户端 IP 的备份账户。',
  BACKUP_ACCOUNT_ID_INVALID: '备份账户 ID 无效。',
  BACKUP_ACCOUNT_NOT_FOUND: '未找到所选备份账户。',
  BACKUP_ACCOUNT_PASSWORD_REQUIRED: '请输入备份客户端密码。',
  BACKUP_ACCOUNT_SERVER_IP_INVALID: '备份客户端 IP 无效。',
  BACKUP_ACCOUNT_SERVER_IP_REQUIRED: '请输入备份客户端 IP。',
  BACKUP_ACCOUNT_STATUS_INVALID: '备份账户状态无效。',
  BACKUP_ACCOUNT_STORAGE_INVALID: '所选备份存储设备不可用。',
  BACKUP_ACCOUNT_STORAGE_REQUIRED: '请选择上传目标存储设备。',
  BACKUP_ACCOUNT_STORAGE_TYPE_INVALID: '所选备份存储类型无效。',
  BACKUP_ACCOUNT_TITLE_REQUIRED: '请输入备份账户名称。',
  BACKUP_ACCOUNT_TITLE_TOO_LONG: '备份账户名称长度超出限制。',
  BACKUP_ACCOUNT_UPLOAD_SCHEDULE_INVALID: '上传时间策略无效。',
  BACKUP_ACCOUNT_USERNAME_REQUIRED: '请输入备份客户端用户名。',
  BACKUP_UPLOAD_FAILED: '备份上传失败。',
  BACKUP_UPLOAD_RUNNING: '当前备份账户正在上传，请稍后重试。',
  BACKUP_UPLOAD_TARGET_INVALID: '上传目标配置无效。',
  BACKUP_UPLOAD_UNSUPPORTED_TARGET: '当前后端暂不支持直接上传到光盘匣组。',
  ARCHIVE_UPLOAD_CHUNK_INVALID: '上传分片信息无效。',
  ARCHIVE_UPLOAD_CHUNK_REQUIRED: '缺少上传分片。',
  ARCHIVE_UPLOAD_CHUNK_SIZE_INVALID: '上传分片大小不正确。',
  ARCHIVE_UPLOAD_EMPTY: '请先选择要上传的文件或文件夹。',
  ARCHIVE_UPLOAD_INCOMPLETE: '文件仍有未完成分片，请再次点击开始上传继续传输。',
  ARCHIVE_UPLOAD_MERGE_FAILED: '合并上传文件失败。',
  ARCHIVE_UPLOAD_PATH_REQUIRED: '上传文件路径不能为空。',
  ARCHIVE_UPLOAD_REQUEST_INVALID: '上传请求无效。',
  ARCHIVE_UPLOAD_SESSION_INVALID: '未找到可续传的上传会话，请重新开始上传。',
  ARCHIVE_UPLOAD_SIZE_INVALID: '上传文件大小无效。',
  CAMERA_ID_INVALID: '摄像头 ID 无效。',
  CAMERA_NOT_FOUND: '未找到所选摄像头。',
  CAMERA_ROOM_TOO_LONG: '摄像头位置长度超出限制。',
  CAMERA_TITLE_REQUIRED: '请输入摄像头名称。',
  CAMERA_TITLE_TOO_LONG: '摄像头名称长度超出限制。',
  DATABASE_ERROR: '后端数据库请求失败。',
  DISC_MAGAZINE_NOT_FOUND: '未找到所选光盘匣。',
  DISC_MAGAZINE_PART_INVALID: '光盘匣 Part 编号无效。',
  DISC_MAGAZINE_PART_NOT_FOUND: '未找到所选光盘匣 Part。',
  DISC_MAGAZINE_PART_RECOVER_FORBIDDEN: '外来盘 Part 不支持在当前控制台恢复。',
  DISC_MAGAZINE_RFID_REQUIRED: '请选择有效的光盘匣。',
  DISC_GROUP_NOT_EMPTY: '该光盘组下仍包含光盘。',
  INVALID_TYPE: '不支持当前资源类型。',
  INVALID_PLAN_ID: '计划 ID 无效。',
  INVALID_PLAN_ACCOUNT: '所选视频平台无效。',
  LOGIN_FAILED: '用户名或密码错误。',
  PLAN_ACCOUNT_NOT_FOUND: '未找到所选视频平台。',
  PLAN_CAMERA_INVALID: '所选摄像头中存在无效项。',
  PLAN_CAMERA_REQUIRED: '请至少选择一个摄像头。',
  PLAN_DATE_INVALID: '请检查计划日期后重试。',
  PLAN_DATE_RANGE_INVALID: '开始日期不能晚于结束日期。',
  PLAN_DUPLICATE_TITLE: '已存在同名采集计划。',
  PLAN_NOT_DELETABLE: '运行中的计划不能删除。',
  PLAN_NOT_EDITABLE: '当前计划已不可编辑。',
  PLAN_NOTE_TOO_LONG: '备注长度超出限制。',
  PLAN_RUN_TYPE_INVALID: '运行方式无效。',
  PLAN_STORAGE_INVALID: '所选存储设备不可用。',
  PLAN_STORAGE_REQUIRED: '请选择存储设备。',
  PLAN_STORAGE_TYPE_INVALID: '所选存储类型无效。',
  PLAN_TIME_INVALID: '请检查采集时间后重试。',
  PLAN_TIME_RANGE_INVALID: '采集开始时间必须早于结束时间。',
  PLAN_TITLE_INVALID: '任务名称包含不支持的特殊字符。',
  PLAN_TITLE_REQUIRED: '请输入任务名称。',
  PLAN_TITLE_TOO_LONG: '任务名称长度超出限制。',
  PASSWORD_INVALID: '当前密码不正确。',
  PASSWORD_MISMATCH: '两次输入的新密码不一致。',
  PLAN_NOT_FOUND: '未找到所选计划。',
  PLATFORM_BUSY: '该平台下仍有关联的运行计划。',
  PLATFORM_DUPLICATE: '已存在相同接入地址的视频平台。',
  PLATFORM_ID_INVALID: '平台 ID 无效。',
  PLATFORM_NOT_FOUND: '未找到所选视频平台。',
  PLATFORM_PASSWORD_REQUIRED: '请输入平台密码。',
  PLATFORM_PORT_INVALID: '平台端口无效。',
  PLATFORM_REQUEST_INVALID: '提交的平台数据无效。',
  PLATFORM_SERVER_IP_INVALID: '平台服务器 IP 无效。',
  PLATFORM_SERVER_IP_REQUIRED: '请输入平台服务器 IP。',
  PLATFORM_STATUS_INVALID: '平台状态无效。',
  PLATFORM_SYNC_BINARY_MISSING: '未找到平台同步程序。',
  PLATFORM_SYNC_DISABLED: '后端已禁用摄像头同步。',
  PLATFORM_SYNC_EXECUTE_FAILED: '平台同步命令启动失败。',
  PLATFORM_SYNC_FAILED: '摄像头同步失败。',
  PLATFORM_SYNC_INTERRUPTED: '摄像头同步被中断。',
  PLATFORM_SYNC_PATH_MISSING: '未配置平台同步程序路径。',
  PLATFORM_SYNC_TIMEOUT: '摄像头同步超时。',
  PLATFORM_SYNC_UNSUPPORTED: '当前平台类型不支持摄像头同步。',
  PLATFORM_TITLE_REQUIRED: '请输入平台名称。',
  PLATFORM_TITLE_TOO_LONG: '平台名称长度超出限制。',
  PLATFORM_TYPE_INVALID: '平台类型无效。',
  PLATFORM_USERNAME_REQUIRED: '请输入平台用户名。',
  SETTING_NOT_FOUND: '未找到所选系统参数。',
  SETTING_READ_ONLY: '该系统参数在新版控制台中为只读。',
  SETTINGS_FORBIDDEN: '只有管理员可以修改系统设置。',
  SETTING_VALUE_REQUIRED: '参数值不能为空。',
  STORAGE_TARGET_CREDENTIALS_REQUIRED: '请输入存储访问凭证。',
  STORAGE_TARGET_BACKUP_TYPE_INVALID: '备份方式无效。',
  STORAGE_TARGET_CREATE_FAILED: '存储设备创建失败。',
  STORAGE_TARGET_DUPLICATE: '已存在相同路径的存储设备。',
  STORAGE_TARGET_IN_USE: '该存储设备下已存在采集文件。',
  STORAGE_TARGET_NOT_FOUND: '未找到所选存储设备。',
  STORAGE_TARGET_PATH_REQUIRED: '请输入存储路径或桶名称。',
  STORAGE_TARGET_READ_ONLY: '该存储设备由旧系统维护，只能查看。',
  STORAGE_TARGET_REQUEST_INVALID: '提交的存储设备数据无效。',
  STORAGE_TARGET_SERVER_IP_INVALID: '存储设备 IP 无效。',
  STORAGE_TARGET_SIZE_INVALID: '存储容量参数无效。',
  STORAGE_TARGET_STATUS_INVALID: '存储设备状态无效。',
  STORAGE_TARGET_TEST_UNSUPPORTED: '当前存储设备不支持在线测试。',
  STORAGE_TARGET_TITLE_REQUIRED: '请输入存储设备名称。',
  STORAGE_TARGET_TITLE_TOO_LONG: '存储设备名称长度超出限制。',
  STORAGE_TARGET_TYPE_INVALID: '存储设备类型无效。',
  STORAGE_TARGET_TYPE_MISMATCH: '所选存储设备类型与请求不匹配。',
  UPLOAD_SIZE_EXCEEDED: '上传文件总大小超过系统限制，请分批上传后重试。',
  NAS_BACKUP_DESTINATION_INVALID: '备份目标目录配置无效。',
  NAS_BACKUP_EXECUTE_FAILED: '执行备份失败。',
  NAS_BACKUP_RUNNING: '当前 NAS 正在备份，请稍后重试。',
  NAS_BACKUP_SCHEDULE_INVALID: '定时备份时间无效。',
  NAS_BACKUP_SOURCE_INVALID: 'NAS 源路径不可访问，无法执行备份。',
  NAS_BACKUP_TARGET_DISABLED: '当前 NAS 已停用，不能执行备份。',
  UNAUTHORIZED: '登录已过期，请重新登录。',
  USER_NOT_FOUND: '未找到所选用户。',
  VALIDATION_ERROR: '请检查提交的字段内容。',
  VIDEO_REBACK_TASK_ALREADY_PRESENT: '本地回迁文件仍然存在，删除后再重新回迁。',
  VIDEO_REBACK_TASK_DISABLED: '源平台已停用，当前任务无法重新回迁。',
  VIDEO_REBACK_TASK_FILE_MISSING: '本地回迁文件不存在或已被清理。',
  VIDEO_REBACK_TASK_ID_INVALID: '视频回迁任务 ID 无效。',
  VIDEO_REBACK_TASK_NOT_FOUND: '未找到所选视频回迁任务。',
}

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const hasBody = options.body !== undefined && options.body !== null

  if (sessionState.token) {
    headers.set('Authorization', `Bearer ${sessionState.token}`)
  }

  if (hasBody && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
  })

  const payload = await readPayload(response)

  if (response.status === 401) {
    clearSession()
    window.dispatchEvent(new CustomEvent('auth:expired'))
  }

  if (!response.ok || (payload && payload.success === false)) {
    const code = payload && payload.code ? payload.code : `HTTP_${response.status}`
    const message = resolveMessage(code, payload && payload.message, response.status)
    const error = new Error(message)
    error.code = code
    error.status = response.status
    throw error
  }

  return payload ? payload.data : null
}

export function uploadRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})

  if (sessionState.token) {
    headers.set('Authorization', `Bearer ${sessionState.token}`)
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(options.method || 'POST', buildApiUrl(path), true)

    headers.forEach((value, key) => {
      xhr.setRequestHeader(key, value)
    })

    if (typeof options.onUploadProgress === 'function' && xhr.upload) {
      xhr.upload.addEventListener('progress', (event) => {
        const total = event.lengthComputable ? Number(event.total || 0) : 0
        const loaded = Number(event.loaded || 0)
        options.onUploadProgress({
          lengthComputable: event.lengthComputable,
          loaded,
          total,
          percent: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
        })
      })
    }

    xhr.onerror = () => {
      reject(new Error('网络异常，请稍后重试。'))
    }

    xhr.onabort = () => {
      reject(new Error('上传已取消。'))
    }

    xhr.onload = () => {
      try {
        const ok = xhr.status >= 200 && xhr.status < 300
        const payload = parsePayload(
          xhr.getResponseHeader('content-type') || '',
          xhr.responseText || '',
          ok,
        )

        if (xhr.status === 401) {
          clearSession()
          window.dispatchEvent(new CustomEvent('auth:expired'))
        }

        if (!ok || (payload && payload.success === false)) {
          const code = payload && payload.code ? payload.code : `HTTP_${xhr.status}`
          const message = resolveMessage(code, payload && payload.message, xhr.status)
          const error = new Error(message)
          error.code = code
          error.status = xhr.status
          reject(error)
          return
        }

        resolve(payload ? payload.data : null)
      } catch (error) {
        reject(error)
      }
    }

    xhr.send(options.body ?? null)
  })
}

async function readPayload(response) {
  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()
  return parsePayload(contentType, text, response.ok)
}

function parsePayload(contentType, text, success) {
  if (!text) {
    return null
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(text)
  }

  return {
    success,
    message: text,
    data: text,
  }
}

function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}${normalizedPath}`
}

function resolveMessage(code, fallback, status) {
  if (FRIENDLY_MESSAGES[code]) {
    return FRIENDLY_MESSAGES[code]
  }

  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback
  }

  return `请求失败，状态码：${status}。`
}
