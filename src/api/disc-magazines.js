import { request } from '../lib/http'

export const discMagazineApi = {
  get(rfid) {
    return request(`/disc-magazines/${encodeURIComponent(rfid)}`)
  },
  list(params = {}) {
    const query = buildQuery(params)
    return request(`/disc-magazines${query}`)
  },
  listParts(rfid) {
    return request(`/disc-magazines/${encodeURIComponent(rfid)}/parts`)
  },
  recoverPart(rfid, partNo) {
    return request(`/disc-magazines/${encodeURIComponent(rfid)}/parts/${partNo}/recover`, {
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
