import { request } from '../lib/http'

export const planApi = {
  create(payload) {
    return request('/plans', {
      body: JSON.stringify(payload),
      method: 'POST',
    })
  },
  cameras(accountId) {
    return request(`/plans/accounts/${accountId}/cameras`)
  },
  details(planId, params = {}) {
    const query = buildQuery(params)
    return request(`/plans/${planId}/details${query}`)
  },
  get(planId) {
    return request(`/plans/${planId}`)
  },
  list(params = {}) {
    const query = buildQuery(params)
    return request(`/plans${query}`)
  },
  options() {
    return request('/plans/options')
  },
  remove(planId) {
    return request(`/plans/${planId}`, {
      method: 'DELETE',
    })
  },
  update(planId, payload) {
    return request(`/plans/${planId}`, {
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
