import axios from 'axios'

let resolvedBase = null
const explicit = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || ''

async function detectBaseUrl() {
  if (resolvedBase) return resolvedBase
  if (explicit) {
    resolvedBase = explicit
    return resolvedBase
  }
  const candidates = []
  for (let p = 4000; p <= 4010; p++) candidates.push(`http://localhost:${p}`)
  // Quick probe /health
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/health`, { method: 'GET' })
      if (res.ok) {
        resolvedBase = base
        break
      }
    } catch (_) {}
  }
  resolvedBase = resolvedBase || 'http://localhost:4000'
  return resolvedBase
}

export const api = axios.create()

// Request interceptor: add token and ensure baseURL resolved
api.interceptors.request.use(async (config) => {
  if (!config.baseURL) {
    const base = await detectBaseUrl()
    config.baseURL = `${base}/api`
  }
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Optional: simple response error hook to retry once if 404 from wrong port
api.interceptors.response.use(undefined, async (error) => {
  // If unauthorized, clear token and optionally redirect to login
  if (error?.response?.status === 401) {
    try { localStorage.removeItem('token') } catch {}
    // Try to provide a small UX hint via sessionStorage
    try { sessionStorage.setItem('auth:message', error.response?.data?.message || 'Veuillez vous reconnecter.') } catch {}
    // Only redirect if running in a browser context
    if (typeof window !== 'undefined' && window.location && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
  }
  const original = error.config || {}
  if (!original.__retried && (!explicit)) {
    original.__retried = true
    try {
      const base = await detectBaseUrl()
      original.baseURL = `${base}/api`
      return api(original)
    } catch (_) {}
  }
  return Promise.reject(error)
})

export async function getApiBase() {
  return await detectBaseUrl()
}
