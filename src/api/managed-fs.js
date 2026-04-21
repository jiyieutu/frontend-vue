import { apiBaseUrl } from '../lib/config'
import { request, uploadRequest } from '../lib/http'
import { sessionState } from '../lib/session'

export const managedFsApi = {
  archiveCopies(path) {
    return request(`/managed-fs/archive-copies${buildQuery({ path })}`)
  },
  archiveDownloadUrl(path, copyKey = '') {
    return buildBinaryUrl('/managed-fs/archive-download', path, { copyKey })
  },
  archivePreviewUrl(path, copyKey = '') {
    return buildBinaryUrl('/managed-fs/archive-preview', path, { copyKey })
  },
  createDirectory(path) {
    return request('/managed-fs/directories', {
      body: JSON.stringify({ path }),
      method: 'POST',
    })
  },
  downloadUrl(path) {
    return buildBinaryUrl('/managed-fs/download', path)
  },
  info() {
    return request('/managed-fs/info')
  },
  lifecycleRules() {
    return request('/managed-fs/lifecycle-rules')
  },
  list(params = {}) {
    const query = buildQuery(params)
    return request(`/managed-fs/entries${query}`)
  },
  previewUrl(path) {
    return buildBinaryUrl('/managed-fs/preview', path)
  },
  remove(path) {
    return request(`/managed-fs/entries${buildQuery({ path })}`, {
      method: 'DELETE',
    })
  },
  removeLifecycleRule(ruleId) {
    return request(`/managed-fs/lifecycle-rules/${ruleId}`, {
      method: 'DELETE',
    })
  },
  saveLifecycleRule(payload) {
    return request('/managed-fs/lifecycle-rules', {
      body: JSON.stringify(payload),
      method: 'POST',
    })
  },
  sync(payload = {}) {
    return request('/managed-fs/sync', {
      body: JSON.stringify(payload),
      method: 'POST',
    })
  },
  upload(path, formData, onUploadProgress) {
    return uploadRequest(`/managed-fs/uploads${buildQuery({ path })}`, {
      body: formData,
      method: 'POST',
      onUploadProgress,
    })
  },
}

function buildBinaryUrl(path, entryPath, extraParams = {}) {
  const query = buildQuery({
    path: entryPath,
    token: sessionState.token || '',
    ...extraParams,
  })
  return `${apiBaseUrl}${path}${query}`
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
