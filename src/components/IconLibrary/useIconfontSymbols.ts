import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

const containsSymbol = (node: Node): boolean => node instanceof Element && (
  node.matches('symbol') || node.querySelector('symbol') !== null
)

/** 读取 AIcon 可引用的已加载 SVG symbol，列表随弹窗生命周期同步，不依赖图标项目编号或名称前缀。 */
export function useIconfontSymbols() {
  const symbols = shallowRef<string[]>([])
  let observer: MutationObserver | undefined

  const refresh = () => {
    const ids = [...new Set(Array.from(
      document.querySelectorAll<SVGSymbolElement>('svg symbol[id]'),
      symbol => symbol.id
    ).filter(Boolean))]
    if (ids.length !== symbols.value.length || ids.some((id, index) => id !== symbols.value[index])) {
      symbols.value = ids
    }
  }

  onMounted(() => {
    observer = new MutationObserver(records => {
      // 只处理 symbol 的增删与 ID 变化，避免弹窗搜索、切换分类等 DOM 更新引起重复扫描。
      const changed = records.some(record => record.type === 'attributes'
        ? record.target instanceof Element && record.target.matches('symbol')
        : Array.from(record.addedNodes).some(containsSymbol) || Array.from(record.removedNodes).some(containsSymbol)
      )
      if (changed) refresh()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id']
    })
    // 先订阅再扫描，同时覆盖已加载资源和打开弹窗后才完成的异步注入。
    refresh()
  })

  onBeforeUnmount(() => observer?.disconnect())

  return symbols
}
