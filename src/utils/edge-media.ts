import { TOKEN_KEY, TOKEN_KEY_URL } from '@jetlinks-web/constants'
import { request } from '@jetlinks-web/core'
import { getToken } from '@jetlinks-web/utils'
import { getBaseApi } from './comm'
import { getProjectIdFromLocation } from './project-runtime'
import { getProjectStorage, isProjectStorageEnabled } from './project-storage'

type Row = Record<string, unknown>

const CHANNEL_LOOKUP_PATH = '/media/channel/_query/no-paging'
const proxyTargetCache = new Map<string, Promise<EdgeMediaProxyTarget | null>>()

type CloudMediaChannelRecord = {
  cloudChannelRecordId?: string
  proxyNodeId?: string
  businessChannelId?: string
  directDeviceId?: string
}

export type EdgeMediaProxyLookup = {
  proxyNodeId?: string
  cloudChannelId: string
  fallbackDeviceId?: string
  fallbackChannelId?: string
  projectId?: string
}

export type EdgeMediaProxyTarget = {
  proxyNodeId: string
  edgeChannelRecordId?: string
  edgeDeviceId: string
  edgeChannelId: string
}

export type EdgeMediaLiveTarget = {
  proxyNodeId?: string
  deviceId: string
  channelId: string
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const next = value.trim()
    return next || undefined
  }
  if (typeof value === 'number') return String(value)
  return undefined
}

function asResult(value: unknown): unknown {
  const record = (value && typeof value === 'object') ? value as Row : {}
  return record.result ?? record.data ?? value
}

function ensureSuccess(value: unknown, fallback: string): void {
  const record = (value && typeof value === 'object') ? value as Row : {}
  if (record.success === false) throw new Error(text(record.message) ?? fallback)
  const status = Number(record.status)
  if (Number.isFinite(status) && status >= 400) throw new Error(text(record.message) ?? fallback)
}

function rowsOf(value: unknown): Row[] {
  const result = asResult(value)
  if (Array.isArray(result)) return result as Row[]
  if (result && typeof result === 'object') {
    const record = result as Row
    if (Array.isArray(record.data)) return record.data as Row[]
  }
  return []
}

function resolveMediaProjectContext(projectId?: string): {
  projectApi?: string | null
  projectToken?: string | null
  projectDomain?: string
} {
  // Legacy media fallbacks read project credentials directly, so enforce the SaaS gate first.
  if (!isProjectStorageEnabled()) {
    return {}
  }

  const runtimeProjectId = getProjectIdFromLocation()
  const strictStorage = !!runtimeProjectId
  const resolvedProjectId = runtimeProjectId || projectId || ''
  const projectStorage = resolvedProjectId ? getProjectStorage(resolvedProjectId) : undefined

  return {
    projectToken: projectStorage?.token
      || (strictStorage || !resolvedProjectId ? undefined : localStorage.getItem(`${TOKEN_KEY}_${resolvedProjectId}`)),
    projectApi: projectStorage?.apiUrl
      || (strictStorage || !resolvedProjectId
        ? undefined
        : localStorage.getItem(`X-Tenant-Api_${resolvedProjectId}`) || localStorage.getItem('X-Tenant-Api')),
    projectDomain: projectStorage?.domain || resolvedProjectId || undefined,
  }
}

function buildProjectHeaders(projectId?: string): Record<string, string> {
  const { projectDomain, projectToken } = resolveMediaProjectContext(projectId)
  const headers: Record<string, string> = {}

  if (projectDomain) headers['X-Tenant-Domain'] = projectDomain
  if (projectToken) headers[TOKEN_KEY] = projectToken

  return headers
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

export function withEdgeMediaToken(path: string, projectId?: string): string {
  const { projectApi, projectToken } = resolveMediaProjectContext(projectId)
  const baseApi = String(projectApi || getBaseApi() || '').replace(/\/$/, '')
  const token = projectToken || getToken()
  const normalizedPath = /^https?:\/\//i.test(path)
    ? path
    : `${baseApi}${path.startsWith('/') ? path : `/${path}`}`

  if (!token || normalizedPath.includes(`${TOKEN_KEY_URL}=`)) {
    return absoluteUrl(normalizedPath)
  }

  const separator = normalizedPath.includes('?') ? '&' : '?'
  return absoluteUrl(`${normalizedPath}${separator}${TOKEN_KEY_URL}=${encodeURIComponent(token)}`)
}

export function buildMediaDevicePath(deviceId: string, channelId: string, action: string): string {
  return `/media/device/${encodeURIComponent(deviceId)}/${encodeURIComponent(channelId)}/${action}`
}

export function buildEdgeProxyPath(edgeNodeId: string, path: string): string {
  return `/edge/device/${encodeURIComponent(edgeNodeId)}/_/${path.replace(/^\/+/, '')}`
}

export function buildPreferredMediaPath(edgeNodeId: string, path: string): string {
  return buildEdgeProxyPath(edgeNodeId, path)
}

export function buildMediaDeviceProxyPath(
  edgeNodeId: string,
  deviceId: string,
  channelId: string,
  action: string,
): string {
  return buildPreferredMediaPath(edgeNodeId, buildMediaDevicePath(deviceId, channelId, action))
}

export function buildLiveMediaUrl(
  target: EdgeMediaLiveTarget,
  suffix: 'flv' | 'mp4' | 'm3u8',
  projectId?: string,
): string {
  const path = target.proxyNodeId
    ? buildMediaDeviceProxyPath(target.proxyNodeId, target.deviceId, target.channelId, `live.${suffix}`)
    : buildMediaDevicePath(target.deviceId, target.channelId, `live.${suffix}`)

  return withEdgeMediaToken(path, projectId)
}

export function clearEdgeMediaProxyTargetCache(): void {
  proxyTargetCache.clear()
}

async function postChannelLookup(
  path: string,
  terms: Array<{ column: string; termType: string; value: string }>,
  projectId?: string,
): Promise<Row[]> {
  const response = await request.post(
    path,
    {
      paging: false,
      terms,
    },
    {
      headers: buildProjectHeaders(projectId),
    },
  )

  ensureSuccess(response, 'Failed to resolve edge media proxy target')
  return rowsOf(response)
}

async function resolveCloudMediaChannelRecord(
  cloudChannelId: string,
  projectId?: string,
): Promise<CloudMediaChannelRecord | null> {
  const rows = await postChannelLookup(
    CHANNEL_LOOKUP_PATH,
    [{ column: 'id', termType: 'eq', value: cloudChannelId }],
    projectId,
  )
  const detail = rows[0] ?? {}
  const businessChannelId = text(detail.channelId)
  const proxyNodeId = text(detail.deviceId) ?? text(detail.edgeDeviceId)
  const cloudChannelRecordId = text(detail.id)
  const directDeviceId = text(detail.deviceId)

  if (!businessChannelId && !proxyNodeId && !cloudChannelRecordId && !directDeviceId) {
    return null
  }

  return {
    cloudChannelRecordId,
    proxyNodeId,
    businessChannelId,
    directDeviceId,
  }
}

function mapEdgeMediaProxyTarget(
  detail: Row,
  input: EdgeMediaProxyLookup,
  proxyNodeId: string,
  cloudRecord?: CloudMediaChannelRecord | null,
): EdgeMediaProxyTarget | null {
  const edgeDeviceId = text(detail.deviceId) ?? cloudRecord?.directDeviceId ?? input.fallbackDeviceId
  const edgeChannelId = text(detail.channelId) ?? input.fallbackChannelId
  const edgeChannelRecordId = text(detail.id)

  if (!edgeDeviceId || !edgeChannelId) {
    return null
  }

  return {
    proxyNodeId,
    edgeChannelRecordId,
    edgeDeviceId,
    edgeChannelId,
  }
}

async function queryEdgeMediaProxyTarget(
  proxyNodeId: string,
  terms: Array<{ column: string; termType: string; value: string }>,
  input: EdgeMediaProxyLookup,
  cloudRecord?: CloudMediaChannelRecord | null,
): Promise<EdgeMediaProxyTarget | null> {
  const lookupPath = buildPreferredMediaPath(proxyNodeId, CHANNEL_LOOKUP_PATH)
  const rows = await postChannelLookup(lookupPath, terms, input.projectId)
  return mapEdgeMediaProxyTarget(rows[0] ?? {}, input, proxyNodeId, cloudRecord)
}

async function resolveLegacyEdgeMediaProxyTarget(
  proxyNodeId: string,
  identifier: string,
  input: EdgeMediaProxyLookup,
  cloudRecord?: CloudMediaChannelRecord | null,
): Promise<EdgeMediaProxyTarget | null> {
  return queryEdgeMediaProxyTarget(
    proxyNodeId,
    [{ column: 'id', termType: 'eq', value: identifier }],
    input,
    cloudRecord,
  )
}

export async function resolveEdgeMediaProxyTarget(
  input: EdgeMediaProxyLookup,
): Promise<EdgeMediaProxyTarget | null> {
  const cacheKey = `${input.projectId || ''}::${input.proxyNodeId || ''}::${input.cloudChannelId}`
  const pending = proxyTargetCache.get(cacheKey)

  if (pending) return pending

  const task = (async () => {
    // Several business modules keep the cloud `media_channel.id` in their current `channelId`.
    // Resolve that cloud row first so we can recover both the real channel code and the proxy gateway id.
    const cloudRecord = await resolveCloudMediaChannelRecord(input.cloudChannelId, input.projectId)
      .catch(() => null)
    const proxyNodeId = cloudRecord?.proxyNodeId || input.proxyNodeId?.trim()

    if (proxyNodeId && cloudRecord?.businessChannelId) {
      const target = await queryEdgeMediaProxyTarget(
        proxyNodeId,
        [{ column: 'id', termType: 'eq', value: cloudRecord.businessChannelId }],
        input,
        cloudRecord,
      )

      if (target) return target
    }

    if (proxyNodeId) {
      return resolveLegacyEdgeMediaProxyTarget(proxyNodeId, input.cloudChannelId, input, cloudRecord)
    }

    return null
  })()
    .finally(() => {
      proxyTargetCache.delete(cacheKey)
    })

  proxyTargetCache.set(cacheKey, task)
  return task
}

export async function resolvePreferredEdgeMediaTarget(input: {
  proxyNodeId?: string
  cloudChannelId?: string
  deviceId: string
  channelId: string
  projectId?: string
}): Promise<EdgeMediaLiveTarget> {
  const cloudChannelId = input.cloudChannelId?.trim() || input.channelId

  if (!cloudChannelId) {
    return {
      deviceId: input.deviceId,
      channelId: input.channelId,
    }
  }

  const target = await resolveEdgeMediaProxyTarget({
    proxyNodeId: input.proxyNodeId?.trim(),
    cloudChannelId,
    fallbackDeviceId: input.deviceId,
    fallbackChannelId: input.channelId,
    projectId: input.projectId,
  })

  if (!target) {
    return {
      deviceId: input.deviceId,
      channelId: input.channelId,
    }
  }

  return {
    proxyNodeId: target.proxyNodeId,
    deviceId: target.edgeDeviceId,
    channelId: target.edgeChannelId,
  }
}
