import { request, uploadRequest } from '../lib/http'

export const nasFileApi = {
  listArchive(params = {}) {
    const query = buildQuery(params)
    return request(`/nas-files/archive${query}`)
  },
  listBackup(params = {}) {
    const query = buildQuery(params)
    return request(`/nas-files/backup${query}`)
  },
  uploadArchive(formData, options = {}) {
    return uploadRequest('/nas-files/archive/upload', {
      ...options,
      body: formData,
      method: 'POST',
    })
  },
  initArchiveUpload(payload) {
    return request('/nas-files/archive/upload/init', {
      body: JSON.stringify(payload),
      method: 'POST',
    })
  },
  uploadArchiveChunk(formData, options = {}) {
    return uploadRequest('/nas-files/archive/upload/chunk', {
      ...options,
      body: formData,
      method: 'POST',
    })
  },
  completeArchiveUpload(payload) {
    return request('/nas-files/archive/upload/complete', {
      body: JSON.stringify(payload),
      method: 'POST',
    })
  },
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
