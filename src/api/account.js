import { request } from '../lib/http'

export const accountApi = {
  delete(type, accountId) {
    return request(`/accounts/${type}/${accountId}`, {
      method: 'DELETE',
    })
  },
  overview(keyword) {
    const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
    return request(`/accounts/overview${query}`)
  },
  toggleStatus(type, accountId) {
    return request(`/accounts/${type}/${accountId}/status`, {
      method: 'PATCH',
    })
  },
}
