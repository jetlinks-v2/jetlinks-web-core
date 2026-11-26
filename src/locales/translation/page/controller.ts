import { pairKey, type LanguagePair } from '../models'
import { displayAttributes, excludedElement, readSlot, translatableElement, visibleElement, writeSlot, type DisplayAttribute, type TextSlot } from './dom'
import { excludedText, usableTranslation } from './source'

interface PageTranslationOptions {
  root: HTMLElement
  route: (text: string, hint?: string) => readonly LanguagePair[] | undefined
  isReady: (route: readonly LanguagePair[]) => boolean
  translate: (route: readonly LanguagePair[], text: string, signal: AbortSignal) => Promise<string | undefined>
}

type TranslationSlot = TextSlot & { route?: readonly LanguagePair[] }

const MAX_TRACKED = 5000
const MAX_ORIGINAL_CHARACTERS = 1_000_000
const MAX_ACTIVE = 4

/** 分片处理可见的文本节点和展示属性，不替换节点或回写 Vue/业务数据。 */
export class PageTranslationController {
  private readonly slots = new Set<TranslationSlot>()
  private readonly byNode = new WeakMap<Node, Map<string, TranslationSlot>>()
  private readonly byElement = new Map<Element, Set<TranslationSlot>>()
  private readonly visible = new Set<Element>()
  private readonly roots = new Set<Node>()
  private readonly walkers: TreeWalker[] = []
  private readonly inFlight = new Set<string>()
  private readonly cache = new Map<string, string>()
  private readonly mutations: MutationObserver
  private readonly visibility: IntersectionObserver
  private timer?: ReturnType<typeof setTimeout>
  private stopped = false
  private originalCharacters = 0
  private cacheCharacters = 0

  constructor(private readonly options: PageTranslationOptions) {
    this.visibility = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) this.visible.add(entry.target)
        else {
          this.visible.delete(entry.target)
          for (const slot of this.byElement.get(entry.target) ?? []) this.cancel(slot)
        }
      }
      this.schedule()
    })
    this.mutations = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(node => this.roots.add(node))
        else this.roots.add(record.target)
      }
      this.schedule()
    })
    this.mutations.observe(options.root, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: [...displayAttributes, 'class', 'style', 'hidden', 'translate', 'contenteditable',
        'data-translate', 'data-no-translate', 'data-translation-source', 'role'],
    })
    this.roots.add(options.root)
    this.schedule()
  }

  stop(): void {
    this.stopped = true
    clearTimeout(this.timer)
    this.mutations.disconnect()
    this.visibility.disconnect()
    for (const slot of this.slots) {
      this.cancel(slot)
      this.restore(slot)
    }
    this.slots.clear()
    this.byElement.clear()
    this.visible.clear()
    this.roots.clear()
    this.walkers.length = 0
    this.cache.clear()
  }

  /** 模型就绪时继续处理尚未翻译的可见文本。 */
  refresh(): void {
    this.schedule()
  }

  private schedule(): void {
    if (this.stopped || this.timer) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.scan()
      this.pump()
    }, 24)
  }

  private scan(): void {
    const { root } = this.options
    for (const slot of this.slots) {
      if (!root.contains(slot.node) || !translatableElement(slot.element)) this.remove(slot)
    }
    for (const node of this.roots) {
      if (!root.contains(node)) continue
      this.inspect(node)
      // 未标记的容器仍可能有标记后代，仅剪去明确排除的子树。
      if (node instanceof Element && !excludedElement(node)) {
        this.walkers.push(document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
          acceptNode: child => child instanceof Element && excludedElement(child) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
        }))
      }
    }
    this.roots.clear()
    const deadline = performance.now() + 6
    while (this.walkers.length && performance.now() < deadline) {
      const walker = this.walkers[0]
      const node = root.contains(walker.root) ? walker.nextNode() : null
      if (node) this.inspect(node)
      else this.walkers.shift()
    }
    if (this.walkers.length) this.schedule()
  }

  private inspect(node: Node): void {
    if (node instanceof Text) {
      const element = node.parentElement
      // 不碰原生选项文本：未声明 value 的 option 会从文字推导提交值。
      if (element && translatableElement(element) && !element.closest('input,textarea,select,option')) {
        this.track({ node, element, original: node.data, written: node.data, attempted: false })
      }
    } else if (node instanceof Element && translatableElement(node)) {
      for (const attribute of displayAttributes) {
        const value = node.getAttribute(attribute)
        if (value !== null) this.track({ node, element: node, attribute, original: value, written: value, attempted: false })
        else {
          const previous = this.byNode.get(node)?.get(attribute)
          if (previous) this.remove(previous)
        }
      }
    }
  }

  private track(next: TranslationSlot): void {
    const key = next.attribute ?? 'text'
    const records = this.byNode.get(next.node) ?? new Map<string, TranslationSlot>()
    const existing = records.get(key)
    next.hint = next.element.closest('[data-translation-source]')?.getAttribute('data-translation-source') || undefined
    if (existing) {
      if (next.written === existing.written && next.hint === existing.hint) return
      this.remove(existing)
      // 仅源语言提示变化时，跟踪的仍应当是恢复后的原文，而不是刚才的译文。
      next.original = next.written = readSlot(next)
    }
    if (excludedText(next.original.trim()) || this.slots.size >= MAX_TRACKED
      || this.originalCharacters + next.original.length > MAX_ORIGINAL_CHARACTERS) return
    records.set(key, next)
    this.byNode.set(next.node, records)
    this.slots.add(next)
    this.originalCharacters += next.original.length
    let entries = this.byElement.get(next.element)
    if (!entries) {
      this.byElement.set(next.element, entries = new Set())
      this.visibility.observe(next.element)
    }
    entries.add(next)
  }

  private remove(slot: TextSlot): void {
    this.cancel(slot)
    this.restore(slot)
    this.slots.delete(slot)
    this.originalCharacters -= slot.original.length
    this.byNode.get(slot.node)?.delete(slot.attribute ?? 'text')
    const entries = this.byElement.get(slot.element)
    entries?.delete(slot)
    if (!entries?.size) {
      this.byElement.delete(slot.element)
      this.visible.delete(slot.element)
      this.visibility.unobserve(slot.element)
    }
  }

  private cancel(slot: TextSlot): void {
    if (slot.controller) slot.attempted = false
    slot.controller?.abort()
    slot.controller = undefined
  }

  private restore(slot: TextSlot): void {
    if (slot.written !== slot.original && readSlot(slot) === slot.written) writeSlot(slot, slot.original)
  }

  private pump(): void {
    for (const element of this.visible) {
      if (this.inFlight.size >= MAX_ACTIVE) return
      if (!visibleElement(element)) continue
      for (const slot of this.byElement.get(element) ?? []) {
        if (slot.attempted || slot.controller || readSlot(slot) !== slot.written) continue
        if (this.inFlight.size >= MAX_ACTIVE) return
        this.translate(slot)
      }
    }
  }

  private translate(slot: TranslationSlot): void {
    const text = slot.original.trim()
    const route = slot.route ??= this.options.route(text, slot.hint)
    if (!route?.length) {
      slot.attempted = true
      return
    }
    if (!this.options.isReady(route)) return
    // 相同的汉字可能按不同语种处理。正文和标题只在语言路径也相同时共享译文。
    const key = JSON.stringify([route.map(pairKey), text])
    if (this.inFlight.has(key)) return
    slot.attempted = true
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      this.apply(slot, cached)
      return
    }
    const controller = new AbortController()
    slot.controller = controller
    this.inFlight.add(key)
    void this.options.translate(route, text, controller.signal).then(result => {
      if (this.stopped || slot.controller !== controller || controller.signal.aborted
        || readSlot(slot) !== slot.written || !this.options.root.contains(slot.node)) return
      if (!this.visible.has(slot.element) || !visibleElement(slot.element)) {
        slot.attempted = false
        return
      }
      if (result !== undefined && usableTranslation(text, result)) {
        this.remember(key, result)
        this.apply(slot, result)
      }
      if (result === undefined && !this.options.isReady(route)) slot.attempted = false
    }, () => { /* 保留原文；同批其它内容可以继续翻译。 */ }).finally(() => {
      this.inFlight.delete(key)
      if (slot.controller === controller) slot.controller = undefined
      this.schedule()
    })
  }

  private apply(slot: TextSlot, translated: string): void {
    const prefix = slot.original.match(/^\s*/)?.[0] ?? ''
    const suffix = slot.original.match(/\s*$/)?.[0] ?? ''
    const text = `${prefix}${translated.trim()}${suffix}`
    if (text !== slot.written) writeSlot(slot, text)
  }

  private remember(key: string, result: string): void {
    this.cache.set(key, result)
    this.cacheCharacters += key.length + result.length
    while (this.cache.size > 256 || this.cacheCharacters > 300_000) {
      const oldest = this.cache.entries().next().value
      if (!oldest) break
      this.cache.delete(oldest[0])
      this.cacheCharacters -= oldest[0].length + oldest[1].length
    }
  }
}
