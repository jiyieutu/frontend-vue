import { request } from '../lib/http'

export const settingsApi = {
  list(keyword) {
    const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
    return request(`/settings${query}`)
  },
  update(settingId, value) {
    return request(`/settings/${settingId}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    })
  },
}
