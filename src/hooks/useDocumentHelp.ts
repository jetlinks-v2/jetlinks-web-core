import { readonly, ref, shallowRef, watchPostEffect, type ComponentPublicInstance, type InjectionKey, type Ref } from 'vue'

/** 业务正文和管理预览的 Markdown 卡片关闭当前所属的气泡。 */
export const closeDocumentHelpKey: InjectionKey<() => void> = Symbol('closeDocumentHelp')

const request = shallowRef<{ url: string }>()
/** 顶栏文档浮窗订阅此指令，业务组件不依赖 auth 模块内部实现。 */
export const documentRequest = readonly(request)

/** 每次都发送新指令，使相同文章关闭后仍可再次打开。地址校验由浮窗接收方执行。 */
export function openDocument(url: string) {
  request.value = { url }
}

/** 弹层避开视口边缘后，以实际卡片为坐标系，让箭头继续指向当前入口。 */
export function useDocumentHelpArrow(open: Ref<boolean>) {
  const trigger = shallowRef<ComponentPublicInstance>()
  const content = shallowRef<HTMLElement>()

  watchPostEffect(onCleanup => {
    if (!open.value || typeof window === 'undefined') return
    const button: HTMLElement | undefined = trigger.value?.$el
    const card = content.value?.closest<HTMLElement>('.ant-popover-content')
    const popup = card?.closest<HTMLElement>('.document-help-popover')
    if (!button || !card || !popup) return

    const align = () => {
      const anchor = button.getBoundingClientRect()
      const bounds = card.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const x = (anchor.left + anchor.width / 2 - bounds.left) / bounds.width
      const y = (anchor.top + anchor.height / 2 - bounds.top) / bounds.height
      card.style.setProperty('--help-arrow-x', `${x * 100}%`)
      card.style.setProperty('--help-arrow-y', `${y * 100}%`)
    }
    const position = new MutationObserver(align)
    position.observe(popup, { attributes: true, attributeFilter: ['style', 'class'] })
    const size = new ResizeObserver(align)
    size.observe(card)
    size.observe(button)
    window.addEventListener('resize', align)
    window.addEventListener('scroll', align, true)
    align()
    onCleanup(() => {
      position.disconnect()
      size.disconnect()
      window.removeEventListener('resize', align)
      window.removeEventListener('scroll', align, true)
    })
  })

  return { trigger, content }
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
