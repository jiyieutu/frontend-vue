import { request } from '../lib/http'

export const authApi = {
  changePassword(payload) {
    return request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
  login(payload) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  logout() {
    return request('/auth/logout', {
      method: 'POST',
    })
  },
  me() {
    return request('/auth/me')
  },
}
