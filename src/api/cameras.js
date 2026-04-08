import { request } from '../lib/http'

export const cameraApi = {
  get(cameraId) {
    return request(`/cameras/${cameraId}`)
  },
  list(params = {}) {
    const query = buildQuery(params)
    return request(`/cameras${query}`)
  },
  options() {
    return request('/cameras/options')
  },
  update(cameraId, payload) {
    return request(`/cameras/${cameraId}`, {
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
