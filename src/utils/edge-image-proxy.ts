import { TOKEN_KEY_URL } from '@jetlinks-web/constants'
import { getToken } from '@jetlinks-web/utils'

import { getBaseApi, isFromCloud } from './request-context'

type EdgeImageContext = {
  token: string
  edgeApiRoot: URL
  proxyUrl: URL
}

let installed = false

/** 使用与接口请求相同的边端代理前缀；图片代理是该前缀的同级路由。 */
const getEdgeImageContext = (): EdgeImageContext | undefined => {
  if (!isFromCloud() || !localStorage.getItem('thingId')) return

  const edgeApiRoot = new URL(`${getBaseApi().replace(/\/+$/, '')}/`, window.location.origin)
  if (!edgeApiRoot.pathname.endsWith('/_/')) return

  return {
    token: String(getToken() || ''),
    edgeApiRoot,
    proxyUrl: new URL('../_proxy', edgeApiRoot),
  }
}

const withCurrentToken = (url: URL, token: string): URL => {
  // 边端返回的旧 token 不适用于云端代理。
  url.searchParams.delete(TOKEN_KEY_URL)
  if (token) url.searchParams.set(TOKEN_KEY_URL, token)
  return url
}

const edgeFilePath = (pathname: string): string | undefined => {
  const match = pathname.match(/(?:^|\/)(?:api\/)?(file\/[^?#]+|ui\/vis\/[^?#]+)$/)
  return match?.[1]
}

/**
 * 只在云端远程边端页面改写非云端来源的网络图片。
 * 该页面的外域图片由边端提供；同源图片、云端 API 图片及已代理地址保持原样。
 */
export const resolveEdgeImageUrl = (source: string): string => {
  const value = source.trim()
  if (!/^(?:https?:)?\/\//i.test(value)) return source

  const context = getEdgeImageContext()
  if (!context) return source

  let original: URL
  try {
    original = new URL(value, window.location.href)
  } catch {
    return source
  }

  if (!['http:', 'https:'].includes(original.protocol)
    || original.origin === window.location.origin
    || original.origin === context.edgeApiRoot.origin) {
    return source
  }

  const filePath = edgeFilePath(original.pathname)
  if (filePath) {
    const target = new URL(filePath, context.edgeApiRoot)
    target.search = original.search
    return withCurrentToken(target, context.token).toString()
  }

  const target = new URL(context.proxyUrl)
  original.hash = ''
  target.searchParams.set('url', original.toString())
  return withCurrentToken(target, context.token).toString()
}

/** srcset 中的 URL 可以包含逗号（例如 data URL），因此按空白分隔 URL 与描述符。 */
const resolveEdgeImageSrcset = (source: string): string => {
  let index = 0
  let result = ''

  while (index < source.length) {
    const prefixStart = index
    while (index < source.length && /[\s,]/.test(source[index])) index += 1
    result += source.slice(prefixStart, index)
    if (index >= source.length) break

    const urlStart = index
    while (index < source.length && !/\s/.test(source[index])) index += 1
    const urlWithDelimiter = source.slice(urlStart, index)
    const trailingCommas = urlWithDelimiter.match(/,+$/)?.[0] || ''
    const url = trailingCommas
      ? urlWithDelimiter.slice(0, -trailingCommas.length)
      : urlWithDelimiter
    result += resolveEdgeImageUrl(url) + trailingCommas

    if (trailingCommas) continue

    const descriptorStart = index
    let parenthesisDepth = 0
    while (index < source.length) {
      const char = source[index]
      if (char === '(') parenthesisDepth += 1
      if (char === ')') parenthesisDepth = Math.max(0, parenthesisDepth - 1)
      index += 1
      if (char === ',' && parenthesisDepth === 0) break
    }
    result += source.slice(descriptorStart, index)
  }

  return result
}

const rewriteExistingImages = (root: Node) => {
  if (root instanceof HTMLImageElement) {
    const src = root.getAttribute('src')
    if (src) {
      const next = resolveEdgeImageUrl(src)
      if (next !== src) root.setAttribute('src', next)
    }
    const srcset = root.getAttribute('srcset')
    if (srcset) {
      const next = resolveEdgeImageSrcset(srcset)
      if (next !== srcset) root.setAttribute('srcset', next)
    }
  }

  if (root instanceof Element) {
    root.querySelectorAll('img').forEach(rewriteExistingImages)
  }
}

/** 在页面启动时统一代理 img、a-image 渲染出的 img，以及 new Image()。 */
export const installEdgeImageProxy = (): void => {
  if (installed || !getEdgeImageContext()) return

  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
  const srcset = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'srcset')
  if (src?.set && src.configurable) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      ...src,
      set(value: string) {
        src.set!.call(this, resolveEdgeImageUrl(String(value)))
      },
    })
  }

  if (srcset?.set && srcset.configurable) {
    Object.defineProperty(HTMLImageElement.prototype, 'srcset', {
      ...srcset,
      set(value: string) {
        srcset.set!.call(this, resolveEdgeImageSrcset(String(value)))
      },
    })
  }

  const setAttribute = HTMLImageElement.prototype.setAttribute
  HTMLImageElement.prototype.setAttribute = function(name: string, value: string) {
    const attribute = name.toLowerCase()
    const next = attribute === 'src'
      ? resolveEdgeImageUrl(String(value))
      : attribute === 'srcset'
        ? resolveEdgeImageSrcset(String(value))
        : value
    setAttribute.call(this, name, next)
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        rewriteExistingImages(record.target)
      } else {
        record.addedNodes.forEach(rewriteExistingImages)
      }
    }
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset'],
  })
  rewriteExistingImages(document.documentElement)
  installed = true
}
