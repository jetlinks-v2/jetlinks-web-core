/**
 * 默认走 MarketplaceClientController / 公开市场约定的 `/marketplace` 前缀：
 * - GET /marketplace/tag-classifiers?type=...（查询条件用 URL 查询串 type，不通过 request 的 params 对象传递）
 * - POST /marketplace/capabilities/_search（CapabilitySearchRequest，NDJSON 流式返回当前页数据）
 *
 * 搜索接口返回**当前页**能力列表（无 total 包装）。下一页无数据即最后一页。
 */
import { createNdJson, request } from '@jetlinks-web/core'
import i18n from '@jetlinks-web-core/locales'
import type { TagChipItem } from './sidebar'
import type {
  CapabilityVersionOption,
  FetchCapabilityVersions,
  MarketplaceResourceFetcher,
  MarketplaceResourceQuery,
  TagClassifiersFetcher,
} from './types'

const marketplaceNdJson = createNdJson({
  requestOptions(config) {
    return {
      headers: {
        ...((config.headers ?? {}) as Record<string, string>),
        Accept: 'application/x-ndjson',
      },
    }
  },
})

function getQueryFailedText() {
  return i18n.global.t('components.MarketplaceResourcePicker.queryFailed')
}

function getQueryFailedStatusText(value: number | string) {
  return i18n.global.t('components.MarketplaceResourcePicker.queryFailedWithStatus', [value])
}

function getQueryFailedCodeText(value: number | string) {
  return i18n.global.t('components.MarketplaceResourcePicker.queryFailedWithCode', [value])
}

function unwrapNdJsonRows(payload: any): any[] {
  if (payload == null) return []
  if (Array.isArray(payload)) return payload.flatMap(unwrapNdJsonRows)
  if (payload?.success === false) return []

  const result = payload?.result ?? payload?.data
  if (Array.isArray(result)) return result.flatMap(unwrapNdJsonRows)
  if (result && typeof result === 'object') return [result]

  if (typeof payload === 'object') {
    const rowKeys = ['id', 'name', 'code', 'provider', 'type', 'icon', 'description']
    if (rowKeys.some((key) => payload[key] !== undefined)) {
      return [payload]
    }
  }

  return []
}

/**
 * 解析 CapabilityPackage.info.tags / 行级 tags：
 * - 新结构：`[{ id, name, icon? }]`（CapabilityPackage.info）
 * - 兼容：顶层 `tags` 为字符串 id 数组，或旧对象无 icon
 */
export function normalizeTagsFromCapabilityRow(row: any = {}): TagChipItem[] {
  const raw =
    row.info?.tags ??
    row.metadata?.info?.tags ??
    row.capabilityPackage?.info?.tags ??
    row.packageInfo?.tags ??
    row.tags

  if (!Array.isArray(raw) || !raw.length) return []

  const out: TagChipItem[] = []
  for (const x of raw) {
    if (x == null) continue
    if (typeof x === 'string') {
      const id = String(x).trim()
      if (id) out.push({ id, name: id })
      continue
    }
    if (typeof x === 'object') {
      const id = x.id != null ? String(x.id).trim() : ''
      if (!id) continue
      const name =
        x.name != null && String(x.name).trim() !== '' ? String(x.name).trim() : id
      const icon =
        x.icon != null && String(x.icon).trim() !== '' ? String(x.icon).trim() : undefined
      out.push({ id, name, icon })
    }
  }
  return out
}

/** 将 CapabilityInfo 转为资源卡片可用的行（补充 code/state/tags 等展示字段） */
export function mapCapabilityInfoRow(row: any = {}) {
  const tags = normalizeTagsFromCapabilityRow(row)
  return {
    ...row,
    available: row.available !== false,
    useCondition: row.useCondition ?? row.metadata?.useCondition,
    code: row.code ?? row.metadata?.code,
    document: optionalTrim(
      row.document ??
        row.info?.document ??
        row.metadata?.document ??
        row.metadata?.info?.document ??
        row.capabilityPackage?.info?.document ??
        row.packageInfo?.document,
    ),
    type: row.type ?? row.provider,
    state: row.state ?? { value: 'enabled' },
    tags,
  }
}

function unwrapCapabilityVersionsResponse(res: any): any[] {
  if (Array.isArray(res)) return res
  if (res?.success === false) return []
  const r = res?.result ?? res?.data
  return Array.isArray(r) ? r : []
}

function versionStringFromRow(x: any): string {
  return String(x?.version ?? x?.name ?? x?.id ?? '').trim()
}

function optionalTrim(s: unknown): string | undefined {
  if (s == null) return undefined
  const t = String(s).trim()
  return t === '' ? undefined : t
}

function unwrapNdJsonError(payload: any): string | undefined {
  if (payload?.success === false) {
    return optionalTrim(payload?.message ?? payload?.msg) ?? getQueryFailedText()
  }

  if (
    typeof payload?.status === 'number' &&
    payload.status >= 400 &&
    payload?.result == null &&
    payload?.data == null
  ) {
    return optionalTrim(payload?.message ?? payload?.msg) ?? getQueryFailedStatusText(payload.status)
  }

  if (
    typeof payload?.code === 'number' &&
    payload.code !== 200 &&
    payload.code !== 0 &&
    payload?.result == null &&
    payload?.data == null
  ) {
    return optionalTrim(payload?.message ?? payload?.msg) ?? getQueryFailedCodeText(payload.code)
  }

  return undefined
}

/** 将 CapabilityVersion 列表转为下拉选项 */
export function mapCapabilityVersionOptions(raw: any[]): CapabilityVersionOption[] {
  const out: CapabilityVersionOption[] = []
  for (const x of raw) {
    const v = versionStringFromRow(x)
    if (!v) continue
    const name = x?.name != null ? String(x.name).trim() : ''
    const label = name && name !== v ? `${name} (${v})` : v
    out.push({
      label,
      value: v,
      available: x?.available !== false,
      summary: optionalTrim(x?.summary),
      releaseNotes: optionalTrim(x?.releaseNotes),
    })
  }
  return out
}

/** 按数字段比较 x.y.z，取列表中的「最新」版本字符串 */
export function pickLatestCapabilityVersion(versionStrings: string[]): string | undefined {
  const uniq = [...new Set(versionStrings.filter(Boolean))]
  if (!uniq.length) return undefined

  function compareVersionStrings(a: string, b: string): number {
    const pa = a.split(/[.-]/).map((p) => {
      const n = parseInt(p, 10)
      return Number.isNaN(n) ? p : n
    })
    const pb = b.split(/[.-]/).map((p) => {
      const n = parseInt(p, 10)
      return Number.isNaN(n) ? p : n
    })
    const len = Math.max(pa.length, pb.length)
    for (let i = 0; i < len; i++) {
      const x = pa[i]
      const y = pb[i]
      if (x === y) continue
      if (x === undefined) return -1
      if (y === undefined) return 1
      if (typeof x === 'number' && typeof y === 'number') {
        if (x !== y) return x < y ? -1 : 1
      } else {
        const sx = String(x)
        const sy = String(y)
        if (sx !== sy) return sx < sy ? -1 : 1
      }
    }
    return 0
  }

  return [...uniq].sort(compareVersionStrings).pop()
}

/** 默认：GET /marketplace/capabilities/{id}/versions */
export const defaultFetchCapabilityVersions: FetchCapabilityVersions = async (capabilityId: string) => {
  const res: any = await request.get(
    `/marketplace/capabilities/${encodeURIComponent(capabilityId)}/versions`,
  )
  const raw = unwrapCapabilityVersionsResponse(res)
  return mapCapabilityVersionOptions(raw)
}

/** 默认：GET /marketplace/tag-classifiers?type= */
export const defaultFetchTagClassifiers: TagClassifiersFetcher = (type: string) => {
  const path = type
    ? `/marketplace/tag-classifiers?type=${encodeURIComponent(type)}`
    : '/marketplace/tag-classifiers'
  return request.get(path)
}

/** 默认：POST /marketplace/capabilities/_search（CapabilitySearchRequest，NDJSON） */
export const defaultFetchResources: MarketplaceResourceFetcher = async (q: MarketplaceResourceQuery) => {
  const body: Record<string, any> = {
    keyword: q.keyword?.trim() || undefined,
    type: q.type,
    pageIndex: q.pageIndex,
    pageSize: q.pageSize,
  }
  if (q.selectedTagIds?.length) {
    body.tags = [...q.selectedTagIds]
  }

  return new Promise<{ list: any[] }>((resolve, reject) => {
    const rows: any[] = []
    let settled = false
    let subscription: { unsubscribe(): void } | undefined

    const finishReject = (error: any) => {
      if (settled) return
      settled = true
      reject(error)
    }

    subscription = marketplaceNdJson.post(`/marketplace/capabilities/_search`, body).subscribe({
      next(payload: any) {
        const errorMessage = unwrapNdJsonError(payload)
        if (errorMessage) {
          subscription?.unsubscribe()
          finishReject(new Error(errorMessage))
          return
        }

        const chunk = unwrapNdJsonRows(payload)
        if (!chunk.length) return
        rows.push(...chunk.map(mapCapabilityInfoRow))
      },
      error(error: any) {
        finishReject(error)
      },
      complete() {
        if (settled) return
        settled = true
        resolve({ list: rows })
      },
    })
  })
}
