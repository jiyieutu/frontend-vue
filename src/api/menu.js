import { request } from '../lib/http'

export const menuApi = {
  list() {
    return request('/menus')
  },
}
