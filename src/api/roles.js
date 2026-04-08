import { request } from '../lib/http'

export const roleApi = {
  create(payload) {
    return request('/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  get(roleId) {
    return request(`/roles/${roleId}`)
  },
  list(params = {}) {
    return request(`/roles${buildQuery(params)}`)
  },
  permissions(roleId) {
    return request(`/roles/${roleId}/permissions`)
  },
  remove(roleId) {
    return request(`/roles/${roleId}`, {
      method: 'DELETE',
    })
  },
  update(roleId, payload) {
    return request(`/roles/${roleId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
  updatePermissions(roleId, payload) {
    return request(`/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify(payload),
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
