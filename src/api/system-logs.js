import { request } from '../lib/http'

export const systemLogApi = {
  getOperation(logId) {
    return request(`/system-logs/operations/${logId}`)
  },
  listLoginLogs(params = {}) {
    return request(`/system-logs/logins${buildQuery(params)}`)
  },
  listOperationLogs(params = {}) {
    return request(`/system-logs/operations${buildQuery(params)}`)
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
