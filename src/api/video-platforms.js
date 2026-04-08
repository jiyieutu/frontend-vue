import { request } from '../lib/http'

export const videoPlatformApi = {
  cameras(platformId) {
    return request(`/video-platforms/${platformId}/cameras`)
  },
  create(payload) {
    return request('/video-platforms', {
      body: JSON.stringify(payload),
      method: 'POST',
    })
  },
  get(platformId) {
    return request(`/video-platforms/${platformId}`)
  },
  list(params = {}) {
    const query = buildQuery(params)
    return request(`/video-platforms${query}`)
  },
  options() {
    return request('/video-platforms/options')
  },
  remove(platformId) {
    return request(`/video-platforms/${platformId}`, {
      method: 'DELETE',
    })
  },
  syncCameras(platformId) {
    return request(`/video-platforms/${platformId}/sync-cameras`, {
      method: 'POST',
    })
  },
  test(platformId) {
    return request(`/video-platforms/${platformId}/test`, {
      method: 'POST',
    })
  },
  toggleStatus(platformId) {
    return request(`/video-platforms/${platformId}/status`, {
      method: 'PATCH',
    })
  },
  update(platformId, payload) {
    return request(`/video-platforms/${platformId}`, {
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
