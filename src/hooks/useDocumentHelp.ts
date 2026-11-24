import { readonly, ref, shallowRef, type InjectionKey } from 'vue'

/** 业务正文和管理预览的 Markdown 卡片关闭当前所属的气泡。 */
export const closeDocumentHelpKey: InjectionKey<() => void> = Symbol('closeDocumentHelp')

const request = shallowRef<{ url: string }>()
/** 顶栏文档浮窗订阅此指令，业务组件不依赖 auth 模块内部实现。 */
export const documentRequest = readonly(request)

/** 每次都发送新指令，使相同文章关闭后仍可再次打开。地址校验由浮窗接收方执行。 */
export function openDocument(url: string) {
  request.value = { url }
}

export function useDocumentHelp(getDocument: () => string | undefined) {
  const open = ref(false)

  function close() {
    open.value = false
  }

  /** 内容插槽内的文章链接与默认链接共用打开和关闭行为。 */
  function openHelpDocument(path: string) {
    const url = path.trim()
    if (!url) return
    openDocument(url)
    close()
  }

  function openHelp() {
    openHelpDocument(getDocument() ?? '')
  }

  return { open, openHelp, openDocument: openHelpDocument, close }
}
