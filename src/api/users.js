import { request } from '../lib/http'

export const userApi = {
  create(payload) {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  get(userId) {
    return request(`/users/${userId}`)
  },
  list(params = {}) {
    return request(`/users${buildQuery(params)}`)
  },
  remove(userId) {
    return request(`/users/${userId}`, {
      method: 'DELETE',
    })
  },
  resetPassword(userId, payload) {
    return request(`/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
  roles(userId) {
    return request(`/users/${userId}/roles`)
  },
  update(userId, payload) {
    return request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
  updateRoles(userId, payload) {
    return request(`/users/${userId}/roles`, {
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
