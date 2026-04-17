import { request } from '../lib/http'

export const backupAccountApi = {
  backup(accountId, mode) {
    const normalizedMode = mode === 'full' ? 'full' : 'incremental'
    return request(`/backup-accounts/${accountId}/backup/${normalizedMode}`, {
      method: 'POST',
    })
  },
  create(payload) {
    return request('/backup-accounts', {
      body: JSON.stringify(payload),
      method: 'POST',
    })
  },
  get(accountId) {
    return request(`/backup-accounts/${accountId}`)
  },
  list(params = {}) {
    const query = buildQuery(params)
    return request(`/backup-accounts${query}`)
  },
  options() {
    return request('/backup-accounts/options')
  },
  remove(accountId) {
    return request(`/backup-accounts/${accountId}`, {
      method: 'DELETE',
    })
  },
  toggleStatus(accountId) {
    return request(`/backup-accounts/${accountId}/status`, {
      method: 'PATCH',
    })
  },
  update(accountId, payload) {
    return request(`/backup-accounts/${accountId}`, {
      body: JSON.stringify(payload),
      method: 'PUT',
    })
  },
  upload(accountId) {
    return request(`/backup-accounts/${accountId}/upload`, {
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
