import { apiBaseUrl } from '../lib/config'
import { request } from '../lib/http'
import { clearSession, sessionState } from '../lib/session'

export const fileApi = {
  createRebackTask(fileId) {
    return request(`/files/${fileId}/reback-tasks`, {
      method: 'POST',
    })
  },
  fetchFile(fileId, mode = 'download') {
    return fetchBinary(`/files/${fileId}/${mode}`)
  },
  list(params = {}) {
    const query = buildQuery(params)
    return request(`/files${query}`)
  },
}

async function fetchBinary(path) {
  const headers = new Headers()
  if (sessionState.token) {
    headers.set('Authorization', `Bearer ${sessionState.token}`)
  }

  const response = await fetch(buildApiUrl(path), {
    headers,
  })

  if (response.status === 401) {
    clearSession()
    window.dispatchEvent(new CustomEvent('auth:expired'))
    throw new Error('登录已过期，请重新登录。')
  }

  if (!response.ok) {
    throw new Error(await resolveBinaryError(response))
  }

  return {
    blob: await response.blob(),
    fileName: parseFileName(response.headers.get('content-disposition')),
  }
}

async function resolveBinaryError(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const payload = await response.json()
    return payload?.message || payload?.code || `请求失败，状态码：${response.status}`
  }

  const text = await response.text()
  return text || `请求失败，状态码：${response.status}`
}

function parseFileName(contentDisposition) {
  if (!contentDisposition) {
    return ''
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const asciiMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i)
  return asciiMatch?.[1] || ''
}

function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}${normalizedPath}`
}

function buildQuery(params) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    searchParams.set(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}
