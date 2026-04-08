import { request } from '../lib/http'

export const storageTargetApi = {
  create(payload) {
    return request('/storage-targets', {
      body: JSON.stringify(payload),
      method: 'POST',
    })
  },
  get(type, targetId) {
    return request(`/storage-targets/${type}/${targetId}`)
  },
  options() {
    return request('/storage-targets/options')
  },
  overview(params = {}) {
    const query = buildQuery(params)
    return request(`/storage-targets${query}`)
  },
  remove(type, targetId) {
    return request(`/storage-targets/${type}/${targetId}`, {
      method: 'DELETE',
    })
  },
  test(type, targetId) {
    return request(`/storage-targets/${type}/${targetId}/test`, {
      method: 'POST',
    })
  },
  toggleStatus(type, targetId) {
    return request(`/storage-targets/${type}/${targetId}/status`, {
      method: 'PATCH',
    })
  },
  update(type, targetId, payload) {
    return request(`/storage-targets/${type}/${targetId}`, {
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
