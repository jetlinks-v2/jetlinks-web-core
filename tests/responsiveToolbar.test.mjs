import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'
import { createComponentRenderer, walk } from './helpers/componentRuntime.mjs'

test('toolbar changes search layout without remounting its editor or selection context', async t => {
  const width = ref(1200), selection = ref(false)
  let sizes = 0
  const load = createDashboardLoader({ '@vueuse/core': { useElementSize: () => ({ width: ++sizes === 1 ? width : ref(0) }) } })
  const Toolbar = load('components/ResponsiveToolbar/index.vue').default
  let mounted = 0
  const Search = defineComponent({ props: { compact: Boolean }, setup(props) {
    mounted++
    const draft = ref('未提交草稿')
    return () => h('input', { value: draft.value, 'data-compact': props.compact })
  } })
  const view = createComponentRenderer()
  const app = view.renderer.createApp({ setup: () => () => h(Toolbar, {}, {
    leading: () => h('span', 'status'), search: ({ stacked }) => h(Search, { compact: !stacked }),
    actions: () => h('button', 'create'), ...(selection.value ? { selection: () => h('button', 'selected') } : {}),
  }) })
  app.mount(view.root); t.after(() => app.unmount())
  const input = () => walk(view.root, node => node.type === 'input')[0]
  const original = input()
  assert.equal(original.props['data-compact'], true)
  width.value = 600; selection.value = true; await nextTick()
  assert.equal(input(), original)
  assert.equal(input().props['data-compact'], false)
  assert.equal(input().props.value, '未提交草稿')
  width.value = 1100; await nextTick()
  assert.equal(mounted, 1)
  assert.equal(input().props['data-compact'], true)
})

test('docking moves the same editor between regions, using result width rather than toolbar width', async t => {
  const toolbarWidth = ref(1200), resultWidth = ref(1200)
  let measurements = 0, mounts = 0
  const load = createDashboardLoader({ '@vueuse/core': { useElementSize: () => ({ width: ++measurements === 1 ? toolbarWidth : measurements === 2 ? resultWidth : ref(0) }) } })
  const Toolbar = load('components/ResponsiveToolbar/index.vue').default
  const view = createComponentRenderer(), destination = createComponentRenderer().root, states = []
  const Search = defineComponent({ setup() { mounts++; return () => h('input', { value: '草稿' }) } })
  const app = view.renderer.createApp({ render: () => h(Toolbar, { class: 'page-toolbar', 'aria-label': 'Page actions', dockTarget: destination, referenceElement: destination, onDockedChange: value => states.push(value) }, { search: () => h(Search) }) })
  app.mount(view.root); t.after(() => app.unmount())
  const findInput = root => walk(root, node => node.type === 'input')[0]
  const editor = findInput(destination)
  assert.ok(editor)
  const toolbar = () => walk(destination, node => node.props?.class?.includes('page-toolbar'))[0] || walk(view.root, node => node.props?.class?.includes('page-toolbar'))[0]
  assert.equal(toolbar().props['aria-label'], 'Page actions')
  assert.equal(findInput(view.root), undefined)
  resultWidth.value = 600; await nextTick()
  assert.equal(findInput(view.root), editor)
  assert.ok(toolbar().props.class.includes('page-toolbar'))
  assert.equal(findInput(destination), undefined)
  resultWidth.value = 1200; await nextTick()
  assert.equal(findInput(destination), editor)
  assert.equal(mounts, 1)
  assert.deepEqual(states, [true, false, true])
})

test('localized group widths can prevent docking even beyond the baseline breakpoint', async t => {
  const sizes = [ref(1200), ref(1000), ref(400), ref(260), ref(160), ref(32)]
  let index = 0
  const load = createDashboardLoader({ '@vueuse/core': { useElementSize: () => ({ width: sizes[index++] }) } })
  const Toolbar = load('components/ResponsiveToolbar/index.vue').default
  const view = createComponentRenderer(), target = createComponentRenderer().root, changes = []
  const app = view.renderer.createApp({ render: () => h(Toolbar, { dockTarget: target, referenceElement: target, onDockedChange: state => changes.push(state) }, {
    context: () => h('span', 'scope'), leading: () => h('span', 'localized statuses'), search: () => h('input'), actions: () => h('button', 'localized action'), utilities: () => h('button', { 'aria-label': 'refresh' }),
  }) })
  app.mount(view.root); t.after(() => app.unmount())
  assert.equal(changes.at(-1), false)
  const utility = () => walk(view.root, node => node.props?.class?.includes('responsive-toolbar__utilities'))[0]
  assert.equal(utility().props['aria-hidden'], true)
  sizes[1].value = 1099; await nextTick()
  assert.equal(changes.at(-1), false)
  sizes[1].value = 1120; await nextTick()
  assert.equal(changes.at(-1), true)
  const dockedUtility = walk(target, node => node.props?.class?.includes('responsive-toolbar__utilities'))[0]
  assert.equal(dockedUtility.props['aria-hidden'], undefined)
  sizes[5].value = 80; await nextTick()
  assert.equal(changes.at(-1), false)
  sizes[1].value = 1200; await nextTick()
  assert.equal(changes.at(-1), true)
  sizes[2].value = 560; await nextTick()
  assert.equal(changes.at(-1), false)
})

test('small targets use content width and preserve the same controls while crossing their fit boundary', async t => {
  const toolbarWidth = ref(527), targetWidth = ref(278), leadingWidth = ref(83), actionsWidth = ref(151)
  const sizes = [toolbarWidth, targetWidth, leadingWidth, actionsWidth, ref(0), ref(0)]
  let index = 0, mounts = 0
  const load = createDashboardLoader({ '@vueuse/core': { useElementSize: () => ({ width: sizes[index++] }) } })
  const Toolbar = load('components/ResponsiveToolbar/index.vue').default
  const view = createComponentRenderer(), target = createComponentRenderer().root, changes = []
  const Control = defineComponent({ setup() { mounts++; return () => h('input', { value: 'Unsubmitted value' }) } })
  const app = view.renderer.createApp({ render: () => h(Toolbar, { stackBelow: 0, dockTarget: target, referenceElement: target, onDockedChange: value => changes.push(value) }, {
    leading: () => h(Control), actions: () => h('button', 'refresh'),
  }) })
  app.mount(view.root); t.after(() => app.unmount())
  const control = walk(target, node => node.type === 'input')[0]
  assert.ok(control)
  toolbarWidth.value = targetWidth.value; await nextTick()
  assert.deepEqual(changes, [true], 'moving into the narrower target must not change whether its controls fit')
  targetWidth.value = 240; toolbarWidth.value = 527; await nextTick()
  assert.equal(walk(view.root, node => node.type === 'input')[0], control)
  targetWidth.value = 278; await nextTick()
  assert.equal(walk(target, node => node.type === 'input')[0], control)
  assert.deepEqual(changes, [true, false, true])
  assert.equal(mounts, 1)
})
