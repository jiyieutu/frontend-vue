import { request } from '../lib/http'
import { apiBaseUrl } from '../lib/config'
import { sessionState } from '../lib/session'

function tenantId() {
  return window.localStorage.getItem('platform.tenantId') || 'default'
}

function platformRequest(path, options = {}) {
  const headers = {
    'X-Tenant-Id': tenantId(),
    ...(options.headers || {}),
  }
  return request(path, { ...options, headers })
}

export const platformApi = {
  health() {
    return platformRequest('/platform/health')
  },
  capabilities() {
    return platformRequest('/platform/capabilities')
  },
  listAssets(params = {}) {
    return platformRequest(`/platform/assets${buildQuery(params)}`)
  },
  createAsset(payload) {
    return platformRequest('/platform/assets', { method: 'POST', body: JSON.stringify(payload) })
  },
  listRepositories(params = {}) {
    return platformRequest(`/platform/repositories${buildQuery(params)}`)
  },
  createRepository(payload) {
    return platformRequest('/platform/repositories', { method: 'POST', body: JSON.stringify(payload) })
  },
  listPolicies(params = {}) {
    return platformRequest(`/platform/policies${buildQuery(params)}`)
  },
  createPolicy(payload) {
    return platformRequest('/platform/policies', { method: 'POST', body: JSON.stringify(payload) })
  },
  listJobs(params = {}) {
    return platformRequest(`/platform/jobs${buildQuery(params)}`)
  },
  createJob(payload) {
    return platformRequest('/platform/jobs', { method: 'POST', body: JSON.stringify(payload) })
  },
  submitBackup(payload) {
    return platformRequest('/platform/backup/submit', { method: 'POST', body: JSON.stringify(payload) })
  },
  submitRestore(payload) {
    return platformRequest('/platform/restore/submit', { method: 'POST', body: JSON.stringify(payload) })
  },
  submitVerify(payload) {
    return platformRequest('/platform/verify/submit', { method: 'POST', body: JSON.stringify(payload) })
  },
  getJob(jobId) {
    return platformRequest(`/platform/jobs/${jobId}`)
  },
  getJobProgress(jobId) {
    return platformRequest(`/platform/jobs/${jobId}/progress`)
  },
  getJobDetails(jobId, params = {}) {
    return platformRequest(`/platform/jobs/${jobId}/details${buildQuery(params)}`)
  },
  streamJob(jobId, onMessage) {
    const token = sessionState.token || ''
    const base = apiBaseUrl.replace(/\/+$/, '')
    const url = `${base}/platform/jobs/${jobId}/stream?token=${encodeURIComponent(token)}&tenantId=${encodeURIComponent(tenantId())}`
    const source = new EventSource(url)
    source.addEventListener('progress', (event) => {
      try {
        onMessage(JSON.parse(event.data))
      } catch (error) {
        console.error(error)
      }
    })
    return source
  },
  listSnapshots(params = {}) {
    return platformRequest(`/platform/snapshots${buildQuery(params)}`)
  },
  dashboard() {
    return platformRequest('/platform/operations/dashboard')
  },
  getOperationsDashboard() {
    return platformRequest('/platform/operations/dashboard')
  },
  listTemplates(params = {}) {
    return platformRequest(`/platform/report-templates${buildQuery(params)}`)
  },
  previewTemplate(payload) {
    return platformRequest('/platform/report-templates/preview', { method: 'POST', body: JSON.stringify(payload) })
  },
  saveTemplate(payload) {
    return platformRequest('/platform/report-templates', { method: 'POST', body: JSON.stringify(payload) })
  },
  searchDeadLetters(payload) {
    return platformRequest('/platform/webhook-dead-letters/search', { method: 'POST', body: JSON.stringify(payload) })
  },
  assignDeadLetter(id, payload) {
    return platformRequest(`/platform/webhook-dead-letters/${id}/assign`, { method: 'POST', body: JSON.stringify(payload) })
  },
  resolveDeadLetter(id, payload) {
    return platformRequest(`/platform/webhook-dead-letters/${id}/resolve`, { method: 'POST', body: JSON.stringify(payload) })
  },
  noteDeadLetter(id, payload) {
    return platformRequest(`/platform/webhook-dead-letters/${id}/note`, { method: 'POST', body: JSON.stringify(payload) })
  },
  requeueDeadLetter(id) {
    return platformRequest(`/platform/webhook-dead-letters/${id}/requeue`, { method: 'POST' })
  },
  deadLetterExportUrl() {
    return `${apiBaseUrl}/platform/webhook-dead-letters/export`
  },
  enterpriseCapabilities() {
    return platformRequest('/platform/enterprise/capabilities')
  },
  enterprisePreview(payload) {
    return platformRequest('/platform/enterprise/preview', { method: 'POST', body: JSON.stringify(payload) })
  },
  enterpriseSubmitVerify(payload) {
    return platformRequest('/platform/enterprise/submit-verify', { method: 'POST', body: JSON.stringify(payload) })
  },
  enterpriseSubmitRestore(payload) {
    return platformRequest('/platform/enterprise/submit-restore', { method: 'POST', body: JSON.stringify(payload) })
  },
}

function buildQuery(params) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}
