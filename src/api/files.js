import { request } from '../lib/http'

export const fileApi = {
  list(params = {}) {
    const query = buildQuery(params)
    return request(`/files${query}`)
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
