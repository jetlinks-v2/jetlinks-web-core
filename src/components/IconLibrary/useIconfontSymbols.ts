import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

const symbols = shallowRef<string[]>([])
let consumers = 0
let observer: MutationObserver | undefined

const containsSymbol = (node: Node): boolean => node instanceof Element && (
  node.matches('symbol') || node.querySelector('symbol') !== null
)

/** 共享 AIcon 可引用的已加载 symbol；首个消费者挂载时监听，最后一个卸载时释放。 */
export function useIconfontSymbols() {
  let mounted = false

  onMounted(() => {
    mounted = true
    // 多张卡片和选择弹窗共用一次扫描与监听；DOM 读取留在挂载阶段以兼容 SSR。
    if (consumers++ > 0) return
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

  onBeforeUnmount(() => {
    if (!mounted || --consumers > 0) return
    observer?.disconnect()
    observer = undefined
    symbols.value = []
  })

  return symbols
}

/** 仅在 symbol 变化时重建列表，普通 DOM 更新不触发扫描或响应式通知。 */
function refresh() {
  const ids = [...new Set(Array.from(
    document.querySelectorAll<SVGSymbolElement>('svg symbol[id]'),
    symbol => symbol.id
  ).filter(Boolean))]
  if (ids.length !== symbols.value.length || ids.some((id, index) => id !== symbols.value[index])) {
    symbols.value = ids
  }
}
