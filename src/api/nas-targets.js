import { request } from '../lib/http'

export const nasTargetApi = {
  executeBackup(targetId, mode) {
    const normalizedMode = mode === 'incremental' ? 'incremental' : 'full'
    return request(`/nas-targets/${targetId}/backup/${normalizedMode}`, {
      method: 'POST',
    })
  },
  create(payload) {
    return request('/nas-targets', {
      body: JSON.stringify(payload),
      method: 'POST',
    })
  },
  get(targetId) {
    return request(`/nas-targets/${targetId}`)
  },
  list(params = {}) {
    const query = buildQuery(params)
    return request(`/nas-targets${query}`)
  },
  remove(targetId) {
    return request(`/nas-targets/${targetId}`, {
      method: 'DELETE',
    })
  },
  test(targetId) {
    return request(`/nas-targets/${targetId}/test`, {
      method: 'POST',
    })
  },
  updateBackupSchedule(targetId, payload) {
    return request(`/nas-targets/${targetId}/backup-schedule`, {
      body: JSON.stringify(payload),
      method: 'PUT',
    })
  },
  toggleStatus(targetId) {
    return request(`/nas-targets/${targetId}/status`, {
      method: 'PATCH',
    })
  },
  update(targetId, payload) {
    return request(`/nas-targets/${targetId}`, {
      body: JSON.stringify(payload),
      method: 'PUT',
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
