import { request } from '../lib/http'

export const healthApi = {
  get() {
    return request('/health')
  },
}
