import router from '@jetlinks-web-core/router'
import type {
  HomeAgentContinuationReceiptOptions,
  HomeAgentRouteLink,
  HomeAgentRuntimeOptions,
} from './homeAgentContracts'
import {
  createHomeAgentContext,
  findHomeAgentRoutePermissionAnchor,
} from './homeAgentContext'
import { compactDefined, isPlainRecord, normalizeText } from './homeAgentShared'

export const createHomeAgentContinuationReceipt = (options: HomeAgentContinuationReceiptOptions) => {
  const subjectType = normalizeText(options.subjectType)
  const subjectId = normalizeText(options.subjectId)
  const subjectName = normalizeText(options.subjectName)
  const subject = subjectType && subjectId
    ? compactDefined({
      type: subjectType,
      id: subjectId,
      name: subjectName,
      subjectType,
      subjectId,
      subjectName,
    })
    : undefined

  return compactDefined({
    contextPrepared: options.contextPrepared !== false,
    targetName: normalizeText(options.targetName) || undefined,
    targetClientId: normalizeText(options.targetClientId) || undefined,
    targetMenuCode: normalizeText(options.targetMenuCode) || undefined,
    routeName: normalizeText(options.routeName) || undefined,
    path: normalizeText(options.path) || undefined,
    subject,
    businessObject: isPlainRecord(options.businessObject) ? compactDefined(options.businessObject) : undefined,
    navigation: isPlainRecord(options.navigation) ? compactDefined(options.navigation) : undefined,
  })
}

const parseObjectParam = (value: string | null) => {
  const text = normalizeText(value)
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return isPlainRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const normalizeSameOriginHashLink = (href: string) => {
  const raw = normalizeText(href)
  if (!raw || raw.startsWith('#')) return raw
  if (typeof window === 'undefined') return raw
  try {
    const url = new URL(raw, window.location.href)
    return url.origin === window.location.origin && url.hash ? url.hash : raw
  } catch {
    return raw
  }
}

const resolveHashRoutePath = (href: string) => {
  const raw = normalizeText(href)
  if (!/^#!?\//.test(raw)) return ''
  return raw.replace(/^#!/, '#').slice(1)
}

export const resolveHomeAgentMenuLink = (href: string) => {
  const raw = normalizeSameOriginHashLink(href)
  if (!raw) return ''
  if (raw.startsWith('#')) {
    const fragment = raw.slice(1)
    const params = new URLSearchParams(fragment.includes('=') ? fragment : `menu=${fragment}`)
    return normalizeText(params.get('menu') || params.get('menuCode') || params.get('route') || '')
  }
  const menuMatch = raw.match(/^jetlinks:\/\/menu\/([^?#]+)/i) || raw.match(/^menu:\/\/([^?#]+)/i)
  if (!menuMatch?.[1]) return ''
  try {
    return decodeURIComponent(menuMatch[1])
  } catch {
    return menuMatch[1]
  }
}

export const resolveHomeAgentRouteLink = (href: string): HomeAgentRouteLink | undefined => {
  const raw = normalizeSameOriginHashLink(href)
  if (!raw) return undefined
  const routePath = resolveHashRoutePath(raw)
  if (routePath) return { routeName: '', path: routePath }

  if (raw.startsWith('#')) {
    const params = new URLSearchParams(raw.slice(1))
    const routeName = normalizeText(params.get('routeName') || params.get('route'))
    if (!routeName) return undefined
    return {
      routeName,
      menuCode: normalizeText(params.get('menu') || params.get('menuCode')),
      params: {
        ...parseObjectParam(params.get('params')),
        ...(params.get('id') ? { id: params.get('id') } : {}),
        ...(params.get('tab') ? { tab: params.get('tab') } : {}),
      },
      query: parseObjectParam(params.get('query')),
    }
  }

  const routeMatch = raw.match(/^jetlinks:\/\/route\/([^?#]+)/i) || raw.match(/^route:\/\/([^?#]+)/i)
  if (!routeMatch?.[1]) return undefined
  let routeName = routeMatch[1]
  try {
    routeName = decodeURIComponent(routeName)
  } catch {
    // Keep the raw name when it is not URI-encoded.
  }
  const queryIndex = raw.indexOf('?')
  const search = queryIndex >= 0 ? raw.slice(queryIndex + 1).split('#')[0] : ''
  const params = new URLSearchParams(search)
  return {
    routeName: normalizeText(routeName),
    menuCode: normalizeText(params.get('menu') || params.get('menuCode')),
    params: {
      ...parseObjectParam(params.get('params')),
      ...(params.get('id') ? { id: params.get('id') } : {}),
      ...(params.get('tab') ? { tab: params.get('tab') } : {}),
    },
    query: parseObjectParam(params.get('query')),
  }
}

export const isHomeAgentMenuLink = (href: string) => !!resolveHomeAgentMenuLink(href)

export const createHomeAgentMarkdownLinkHandler = (
  options: HomeAgentRuntimeOptions = {},
) => (payload: { href: string; event: MouseEvent; defaultOpen?: () => void }) => {
  const routeLink = resolveHomeAgentRouteLink(payload.href)
  if (routeLink?.routeName || routeLink?.path) {
    const context = createHomeAgentContext(options)
    const permissionAnchor = findHomeAgentRoutePermissionAnchor(routeLink, context)
    if (!permissionAnchor) {
      if (routeLink.path) return false
      payload.event.preventDefault()
      return true
    }
    payload.event.preventDefault()
    if (typeof payload.defaultOpen === 'function') {
      payload.defaultOpen()
      return true
    }
    if (routeLink.path) {
      void router.push(routeLink.path)
      return true
    }
    return context.navigateToRoute(routeLink.routeName, {
      params: routeLink.params,
      query: routeLink.query,
    })
  }

  const menuCode = resolveHomeAgentMenuLink(payload.href)
  if (!menuCode) return false
  const context = createHomeAgentContext(options)
  const menu = context.findMenu(menuCode)
  payload.event.preventDefault()
  return menu ? context.navigateToMenu(menuCode) : true
}
