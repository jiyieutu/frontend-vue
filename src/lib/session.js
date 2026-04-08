import { reactive } from 'vue'

const STORAGE_KEY = 'vcas-session'

export const sessionState = reactive({
  token: '',
  user: null,
})

let hydrated = false

export function hydrateSession() {
  if (hydrated) {
    return
  }

  hydrated = true

  if (typeof window === 'undefined') {
    return
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return
    }

    const parsed = JSON.parse(raw)
    sessionState.token = typeof parsed.token === 'string' ? parsed.token : ''
    sessionState.user = parsed.user && typeof parsed.user === 'object' ? parsed.user : null
  } catch (error) {
    clearSession()
  }
}

export function setSession(token, user) {
  sessionState.token = token || ''
  sessionState.user = user || null
  persistSession()
}

export function setUser(user) {
  sessionState.user = user || null
  persistSession()
}

export function clearSession() {
  sessionState.token = ''
  sessionState.user = null

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

export function hasSession() {
  return Boolean(sessionState.token)
}

function persistSession() {
  if (typeof window === 'undefined') {
    return
  }

  if (!sessionState.token) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token: sessionState.token,
      user: sessionState.user,
    }),
  )
}
