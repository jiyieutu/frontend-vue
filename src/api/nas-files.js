import { request } from '../lib/http'

export const nasFileApi = {
  listArchive(params = {}) {
    const query = buildQuery(params)
    return request(`/nas-files/archive${query}`)
  },
  listBackup(params = {}) {
    const query = buildQuery(params)
    return request(`/nas-files/backup${query}`)
  },
  uploadArchive(formData) {
    return request('/nas-files/archive/upload', {
      body: formData,
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
