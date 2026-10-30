import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const frames = new Map()
let frameId = 0
let instanceId = 0
let observers
globalThis.window = {
  requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId },
  cancelAnimationFrame(id) { frames.delete(id) },
}
globalThis.getComputedStyle = element => ({
  paddingLeft: `${element.layout.paddingLeft}px`, paddingRight: `${element.layout.paddingRight}px`,
  lineHeight: `${element.layout.lineHeight}px`,
})

// 执行生产 Hook 和 Vue 调度器；仅用确定性布局、浏览器帧和观察回调替代浏览器边界。
const load = name => {
  const filename = resolve(import.meta.dirname, '../src/components/SlantedTabs', name)
  const module = { exports: {} }
  const { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' })
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return { ...vue, useId: () => `tabs-${++instanceId}` }
    if (id === '@vueuse/core') return {
      useElementVisibility: () => (observers.visible = vue.ref(false)),
      useResizeObserver: (_target, callback) => observers.resize.push(callback),
      useMutationObserver: (_target, callback) => observers.mutation.push(callback),
    }
    return require(id)
  }, module, module.exports)
  return module.exports
}
const { useSlantedTabs } = load('useSlantedTabs.ts')
const { useSlantedTabsOverflow } = load('useSlantedTabsOverflow.ts')

async function settle() {
  for (let turn = 0; turn < 20; turn++) {
    await vue.nextTick()
    if (!frames.size) return
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback())
  }
  assert.fail('layout updates did not settle')
}

function wheel(api, delta) {
  const event = {
    deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, cancelable: true, defaultPrevented: false,
    ...delta,
    preventDefault() { this.defaultPrevented = true },
  }
  api.onWheel(event)
  return event
}

function fixture(t, { width = 300, options, activeKey = 'a', echo = true } = {}) {
  observers = { resize: [], mutation: [] }
  const observation = observers
  const props = vue.reactive({ options: options ?? 'abcdef'.split('').map(key => ({ key, label: key })), activeKey, state: {} })
  const layout = { width, paddingLeft: 0, paddingRight: 0, lineHeight: 20, widths: new Map() }
  const events = []
  const scope = vue.effectScope()
  let selection, api, scrollLeft = 0
  const totalWidth = () => props.options.reduce((total, option) => total + (layout.widths.get(option.key) ?? 100), 0)
  const document = {
    activeElement: null,
    getElementById(id) {
      if (id === api.moreTriggerId) return trigger
      const index = props.options.findIndex(option => selection.tabId(option.key) === id)
      return index < 0 ? undefined : button(props.options[index].key)
    },
  }
  const focusable = () => ({ focus() { document.activeElement = this } })
  const trigger = focusable()
  const buttons = new Map()
  const button = key => {
    if (!buttons.has(key)) buttons.set(key, {
      ...focusable(), key,
      getBoundingClientRect() {
        const index = props.options.findIndex(option => option.key === key)
        const left = props.options.slice(0, index).reduce((sum, option) => sum + (layout.widths.get(option.key) ?? 100), 100) - scroll.scrollLeft
        return { left, right: left + (layout.widths.get(key) ?? 100) }
      },
    })
    return buttons.get(key)
  }
  const scroll = {
    layout,
    ownerDocument: document,
    get clientWidth() { return Math.max(0, layout.width - layout.paddingLeft - layout.paddingRight - (api.hasOverflow.value ? 40 : 0)) },
    get scrollWidth() { return totalWidth() },
    get scrollLeft() { return Math.min(scrollLeft, Math.max(0, this.scrollWidth - this.clientWidth)) },
    set scrollLeft(value) { scrollLeft = Math.max(0, Math.min(value, this.scrollWidth - this.clientWidth)) },
    getBoundingClientRect() { return { left: 100, right: 100 + this.clientWidth } },
  }
  scope.run(() => {
    selection = useSlantedTabs(props, (event, key) => {
      events.push([event, key])
      if (echo && event === 'update:activeKey') props.activeKey = key
    })
    api = useSlantedTabsOverflow(props, selection.selectedKey, selection.select, selection.tabId)
    api.containerRef.value = { layout, get clientWidth() { return layout.width } }
    api.scrollRef.value = scroll
    api.listRef.value = { get scrollWidth() { return totalWidth() } }
  })
  t.after(() => scope.stop())
  return {
    api, selection, props, events, scroll, layout, document, button, observation, stop: () => scope.stop(),
    hidden: () => api.hiddenOptions.value.map(option => option.key),
    resize(width) { layout.width = width; observation.resize.forEach(callback => callback()) },
    mutate() { observation.mutation.forEach(callback => callback()) },
  }
}

test('initial overflow offers clipped and offscreen tabs, with only a right shadow', async t => {
  const f = fixture(t)
  await settle()
  assert.equal(f.api.hasOverflow.value, true)
  assert.deepEqual(f.hidden(), ['c', 'd', 'e', 'f'])
  assert.deepEqual([f.api.canScrollLeft.value, f.api.canScrollRight.value], [false, true])
  assert.deepEqual(f.events, [])
})

test('manual middle and end scrolling updates both sides without changing selection', async t => {
  const f = fixture(t)
  await settle()
  f.scroll.scrollLeft = 150
  f.api.onScroll()
  await settle()
  assert.deepEqual(f.hidden(), ['a', 'b', 'e', 'f'])
  assert.deepEqual([f.api.canScrollLeft.value, f.api.canScrollRight.value], [true, true])
  f.scroll.scrollLeft = 1000
  f.api.onScroll()
  await settle()
  assert.deepEqual(f.hidden(), ['a', 'b', 'c', 'd'])
  assert.deepEqual([f.api.canScrollLeft.value, f.api.canScrollRight.value], [true, false])
  assert.equal(f.selection.selectedKey.value, 'a')
  assert.deepEqual(f.events, [])
})

test('vertical mouse wheel moves tabs in both directions and blocks page scrolling at either edge', async t => {
  const f = fixture(t)
  await settle()
  assert.equal(wheel(f.api, { deltaY: 150 }).defaultPrevented, true)
  await settle()
  assert.equal(f.scroll.scrollLeft, 150)
  assert.deepEqual(f.hidden(), ['a', 'b', 'e', 'f'])
  assert.deepEqual([f.api.canScrollLeft.value, f.api.canScrollRight.value], [true, true])
  assert.equal(wheel(f.api, { deltaY: 300 }).defaultPrevented, true)
  await settle()
  assert.equal(f.scroll.scrollLeft, 340)
  assert.deepEqual([f.api.canScrollLeft.value, f.api.canScrollRight.value], [true, false])
  for (let i = 0; i < 3; i++) {
    assert.equal(wheel(f.api, { deltaY: 60 }).defaultPrevented, true)
    assert.equal(wheel(f.api, { deltaX: 60 }).defaultPrevented, true)
    assert.equal(f.scroll.scrollLeft, 340)
  }
  assert.equal(wheel(f.api, { deltaY: -80 }).defaultPrevented, true)
  assert.equal(f.scroll.scrollLeft, 260)
  assert.equal(wheel(f.api, { deltaY: -1000 }).defaultPrevented, true)
  await settle()
  assert.equal(f.scroll.scrollLeft, 0)
  assert.deepEqual([f.api.canScrollLeft.value, f.api.canScrollRight.value], [false, true])
  for (let i = 0; i < 3; i++) {
    assert.equal(wheel(f.api, { deltaY: -60 }).defaultPrevented, true)
    assert.equal(wheel(f.api, { deltaX: -60 }).defaultPrevented, true)
    assert.equal(f.scroll.scrollLeft, 0)
  }
  assert.equal(f.selection.selectedKey.value, 'a')
  assert.deepEqual(f.events, [])
})

test('trackpad wheel uses the dominant axis once and cancels native duplicate scrolling', async t => {
  const f = fixture(t)
  await settle()
  assert.equal(wheel(f.api, { deltaX: 80, deltaY: 20 }).defaultPrevented, true)
  assert.equal(f.scroll.scrollLeft, 80)
  assert.equal(wheel(f.api, { deltaX: -30, deltaY: -3 }).defaultPrevented, true)
  assert.equal(f.scroll.scrollLeft, 50)
  assert.equal(wheel(f.api, { deltaX: 5, deltaY: 80 }).defaultPrevented, true)
  assert.equal(f.scroll.scrollLeft, 130)
  await settle()
})

test('wheel line and page units use the line height and visible width while pixels retain precision', async t => {
  const f = fixture(t)
  await settle()
  wheel(f.api, { deltaY: 2, deltaMode: 1 })
  assert.equal(f.scroll.scrollLeft, 40)
  wheel(f.api, { deltaY: 1, deltaMode: 2 })
  assert.equal(f.scroll.scrollLeft, 300)
  wheel(f.api, { deltaY: -1, deltaMode: 2 })
  assert.equal(f.scroll.scrollLeft, 40)
  wheel(f.api, { deltaY: 0.5 })
  assert.equal(f.scroll.scrollLeft, 40.5)
  await settle()
})

test('wheel preserves zoom, already handled or uncancelable events, and non-overflowing navigation', async t => {
  const f = fixture(t)
  await settle()
  assert.equal(wheel(f.api, { deltaY: 100, ctrlKey: true }).defaultPrevented, false)
  wheel(f.api, { deltaY: 100, defaultPrevented: true })
  assert.equal(wheel(f.api, { deltaY: 100, cancelable: false }).defaultPrevented, false)
  assert.equal(wheel(f.api, {}).defaultPrevented, false)
  assert.equal(f.scroll.scrollLeft, 0)
  f.resize(600)
  await settle()
  assert.equal(wheel(f.api, { deltaY: 100 }).defaultPrevented, false)
  assert.equal(f.scroll.scrollLeft, 0)
})

test('growing to exactly fit removes the menu and shadows without a width feedback loop', async t => {
  const f = fixture(t)
  await settle()
  f.api.moreOpen.value = true
  f.resize(600)
  await settle()
  assert.equal(f.api.hasOverflow.value, false)
  assert.equal(f.api.moreOpen.value, false)
  assert.deepEqual(f.hidden(), [])
  assert.deepEqual([f.api.canScrollLeft.value, f.api.canScrollRight.value], [false, false])
  assert.equal(frames.size, 0)
  f.resize(599)
  await settle()
  assert.equal(f.api.hasOverflow.value, false)
  f.resize(598)
  await settle()
  assert.equal(f.api.hasOverflow.value, true)
})

test('navigation padding is excluded from the space available to tabs', async t => {
  const f = fixture(t, { width: 616 })
  f.layout.paddingLeft = f.layout.paddingRight = 16
  await settle()
  assert.equal(f.api.hasOverflow.value, true)
  f.resize(632)
  await settle()
  assert.equal(f.api.hasOverflow.value, false)
})

test('menu selection reveals and focuses the target, and reselecting emits no duplicate events', async t => {
  const f = fixture(t)
  await settle()
  f.api.moreOpen.value = true
  await f.api.selectOverflow('f')
  await settle()
  assert.equal(f.selection.selectedKey.value, 'f')
  assert.equal(f.scroll.scrollLeft, 340)
  assert.equal(f.document.activeElement, f.button('f'))
  assert.equal(f.api.moreOpen.value, false)
  assert.deepEqual(f.events, [['update:activeKey', 'f'], ['change', 'f']])
  f.scroll.scrollLeft = 0
  await f.api.selectOverflow('f')
  await settle()
  assert.equal(f.scroll.scrollLeft, 340)
  assert.equal(f.events.length, 2)
})

test('disabled, loading and missing menu options cannot change the active tab', async t => {
  const f = fixture(t)
  f.props.options[5].disabled = true
  await settle()
  await f.api.selectOverflow('f')
  await f.api.selectOverflow('missing')
  f.props.state.loading = true
  await f.api.selectOverflow('e')
  await settle()
  assert.deepEqual(f.events, [])
  assert.equal(f.selection.selectedKey.value, 'a')
})

test('externally controlled selection scrolls into view without emitting a change', async t => {
  const f = fixture(t)
  await settle()
  f.props.activeKey = 'f'
  await settle()
  assert.equal(f.scroll.scrollLeft, 340)
  assert.deepEqual(f.events, [])
  f.scroll.scrollLeft = 120
  f.api.onScroll()
  await settle()
  assert.equal(f.scroll.scrollLeft, 120)
})

test('number and string keys remain distinct, and rejected controlled updates preserve the active tab', async t => {
  const f = fixture(t, { options: [1, '1', 'last'].map(key => ({ key, label: String(key) })), activeKey: 1, width: 150, echo: false })
  await settle()
  await f.api.selectOverflow('1')
  await settle()
  assert.notEqual(f.selection.tabId(1), f.selection.tabId('1'))
  assert.equal(f.selection.selectedKey.value, 1)
  assert.equal(f.document.activeElement, f.button(1))
  assert.deepEqual(f.events, [['update:activeKey', '1'], ['change', '1']])
})

test('title slot width changes and removing options refresh the overflow state', async t => {
  const f = fixture(t, { width: 600 })
  await settle()
  f.layout.widths.set('f', 220)
  f.mutate()
  await settle()
  assert.equal(f.api.hasOverflow.value, true)
  f.props.options.splice(2)
  await settle()
  assert.equal(f.api.hasOverflow.value, false)
  f.props.options = []
  f.api.containerRef.value = f.api.scrollRef.value = f.api.listRef.value = undefined
  await settle()
  assert.deepEqual(f.hidden(), [])
  assert.deepEqual([f.api.canScrollLeft.value, f.api.canScrollRight.value], [false, false])
})

test('scroll updates are batched and pending work is cancelled when the scope is destroyed', async t => {
  const f = fixture(t)
  await settle()
  for (let i = 0; i < 100; i++) f.api.onScroll()
  assert.equal(frames.size, 1)
  f.stop()
  assert.equal(frames.size, 0)
  f.api.onScroll()
  assert.equal(frames.size, 0)
})

test('keyboard opening waits for a visible popup, and Escape returns focus to its trigger', async t => {
  const f = fixture(t)
  await settle()
  const first = { focus() { f.document.activeElement = this } }
  const menu = { ownerDocument: f.document, querySelectorAll: () => [first] }
  f.api.onMoreKeydown({ key: 'ArrowDown', preventDefault() {} })
  f.api.menuRef.value = menu
  await settle()
  assert.equal(f.document.activeElement, null)
  f.observation.visible.value = true
  await settle()
  assert.equal(f.document.activeElement, first)
  f.api.onMenuKeydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} })
  await settle()
  assert.equal(f.api.moreOpen.value, false)
  assert.equal(f.document.activeElement, f.document.getElementById(f.api.moreTriggerId))
})

test('keyboard focus waits through hidden popup measurement and cancels pending work on close or unmount', async t => {
  const f = fixture(t)
  await settle()
  let displayed = false
  const first = { focus() { if (displayed) f.document.activeElement = this } }
  f.api.menuRef.value = { ownerDocument: f.document, querySelectorAll: () => [first] }
  f.observation.visible.value = true
  f.api.onMoreKeydown({ key: 'ArrowDown', preventDefault() {} })
  await vue.nextTick()
  await vue.nextTick()
  assert.equal(f.document.activeElement, null)
  assert.equal(frames.size, 1)
  displayed = true
  await settle()
  assert.equal(f.document.activeElement, first)
  assert.equal(frames.size, 0)

  f.api.closeMore()
  await settle()
  displayed = false
  f.api.onMoreKeydown({ key: 'ArrowDown', preventDefault() {} })
  await vue.nextTick()
  await vue.nextTick()
  assert.equal(frames.size, 1)
  f.api.closeMore()
  await vue.nextTick()
  assert.equal(frames.size, 0)

  f.api.onMoreKeydown({ key: 'ArrowDown', preventDefault() {} })
  await vue.nextTick()
  await vue.nextTick()
  assert.equal(frames.size, 1)
  f.stop()
  assert.equal(frames.size, 0)
})

test('menu arrows wrap among enabled items and Enter/Space activate the focused item once', async t => {
  const f = fixture(t)
  await settle()
  let activated = 0
  const items = [0, 1].map(() => ({ focus() { f.document.activeElement = this }, click() { activated++ } }))
  f.api.menuRef.value = { ownerDocument: f.document, querySelectorAll: () => items }
  f.document.activeElement = items[0]
  const key = value => f.api.onMenuKeydown({ key: value, preventDefault() {}, stopPropagation() {} })
  key('ArrowUp')
  assert.equal(f.document.activeElement, items[1])
  key('ArrowDown')
  assert.equal(f.document.activeElement, items[0])
  key('End')
  assert.equal(f.document.activeElement, items[1])
  key('Home')
  assert.equal(f.document.activeElement, items[0])
  key('Enter')
  assert.equal(activated, 1)
  key(' ')
  assert.equal(activated, 2)
})
