import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { transformSync } from 'esbuild'

const require = createRequire(import.meta.url)
const filename = new URL('../src/components/AssetRelationEditor/index.vue', import.meta.url).pathname
const permissionRules = { exports: {} }
new Function(
  'module',
  'exports',
  transformSync(
    readFileSync(new URL('../src/components/AssetRelationEditor/permissions.ts', import.meta.url), 'utf8'),
    { loader: 'ts', format: 'cjs' }
  ).code
)(permissionRules, permissionRules.exports)

function mount(supportsOptionExtra, owner = false) {
  const rows = [{ id: 'A', permissions: ['read'], original: owner ? { relation: 'owner' } : undefined }]
  const selector = {
    supportsOptionExtra,
    component: vue.defineComponent({
      props: ['selectedOnly'],
      setup:
        (props, { slots }) =>
        () =>
          vue.h('div', { class: 'picker', 'data-review': props.selectedOnly }, [
            vue.h('span', 'Organization A'),
            slots['option-extra']?.({ option: { value: 'A', label: 'Organization A' } })
          ])
    })
  }
  const model = {
    multiple: vue.ref(true),
    reviewIds: vue.ref(['A']),
    settings: vue.ref({ multiple: true, permissionSupported: true, permissions: [{ id: 'read', name: 'Read' }] }),
    selector: vue.shallowRef(selector),
    options: vue.ref([]),
    selectorOptions: vue.ref([]),
    known: vue.ref(new Map([['A', owner ? { relation: 'owner' } : undefined]])),
    changes: vue.ref({ added: [], updated: [], removed: [] }),
    dirty: vue.ref(false),
    drafts: vue.ref(rows),
    ids: vue.ref(['A']),
    labels: vue.ref(new Map([['A', 'Organization A']])),
    loading: vue.ref(false),
    saving: vue.ref(false),
    error: vue.ref(''),
    select() {},
    save() {},
    retry() {},
    resolveTargets() {},
    remove() {},
    undo() {},
    applyPermissions() {},
    setPermissions(row, permissions) {
      row.permissions = permissionRules.exports.assetBindingPermissions(model.settings.value, permissions)
    }
  }
  function compileComponent(file) {
    const descriptor = parse(readFileSync(file, 'utf8'), { filename: file }).descriptor
    const script = compileScript(descriptor, { id: 'asset-binding', inlineTemplate: true })
    const compiled = { exports: {} }
    new Function('require', 'module', 'exports', transformSync(script.content, { loader: 'ts', format: 'cjs' }).code)(
      (id) =>
        id === './permissions'
          ? permissionRules.exports
          : id === './useAssetRelationEditor'
            ? { useAssetRelationEditor: () => model }
            : id === 'vue-i18n'
              ? { useI18n: () => ({ t: (key) => key }) }
              : id === './AssetBindingActions.vue'
                ? {
                    __esModule: true,
                    default: compileComponent(
                      new URL('../src/components/AssetRelationEditor/AssetBindingActions.vue', import.meta.url).pathname
                    )
                  }
                : id.endsWith('.vue')
                  ? { default: { render: () => null } }
                  : require(id),
      compiled,
      compiled.exports
    )
    return compiled.exports.default
  }
  const renderer = vue.createRenderer({
    createElement: (tag) => ({ tag, children: [], attrs: {} }),
    createText: (text) => ({ text }),
    createComment: (text) => ({ comment: text }),
    insert: (child, parent, anchor) => {
      if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
      child.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      if (index < 0) parent.children.push(child)
      else parent.children.splice(index, 0, child)
    },
    remove: (child) => {
      if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
    },
    setText: (el, text) => {
      el.text = text
    },
    setElementText: (el, text) => {
      el.text = text
      el.children = []
    },
    patchProp: (el, name, _, value) => {
      el.attrs[name] = value
    },
    parentNode: (el) => el.parent,
    nextSibling: (el) => el.parent?.children[el.parent.children.indexOf(el) + 1]
  })
  const app = renderer.createApp(compileComponent(filename), {
    context: { subject: { name: 'Source' }, relation: { name: 'Assigned', targetType: 'test' } }
  })
  const passthrough = {
    setup:
      (_, { slots }) =>
      () =>
        vue.h('div', slots.default?.())
  }
  for (const name of ['a-avatar', 'a-alert', 'a-spin', 'a-tree-select', 'a-checkbox', 'a-popconfirm', 'a-dropdown'])
    app.component(name, passthrough)
  app.component('a-popover', {
    props: ['open'],
    emits: ['open-change'],
    setup:
      (props, { slots, emit }) =>
      () =>
        vue.h('div', { 'data-popover': true, onOpen: () => emit('open-change', true) }, [
          slots.default?.(),
          props.open ? slots.content?.() : null
        ])
  })
  app.component('a-checkbox-group', {
    props: ['value', 'disabled'],
    emits: ['update:value'],
    setup:
      (props, { slots, emit }) =>
      () =>
        vue.h(
          'div',
          {
            'data-permissions': true,
            'data-disabled': props.disabled,
            onChoose: (ids) => emit('update:value', ids)
          },
          slots.default?.()
        )
  })
  app.component('a-button', {
    setup:
      (_, { slots }) =>
      () =>
        vue.h('button', slots.default?.())
  })
  const root = { children: [] }
  app.mount(root)
  const find = (predicate, node = root) =>
    [node, ...(node.children || []).flatMap((child) => find(predicate, child))].filter(predicate)
  return { app, model, find }
}

test('declared row extension renders actions once in the picker and reviews selection through the footer', async () => {
  const h = mount(true)
  try {
    assert.equal(h.find((n) => n.attrs?.class === 'selected-bindings').length, 0)
    assert.equal(h.find((n) => n.attrs?.['aria-label'] === 'assetRelation.permissionsFor').length, 1)
    const review = h.find((n) => n.tag === 'button' && 'aria-pressed' in n.attrs)[0]
    review.attrs.onClick()
    await vue.nextTick()
    assert.equal(h.find((n) => n.attrs?.class === 'picker')[0].attrs['data-review'], true)
    review.attrs.onClick()
    await vue.nextTick()
    assert.equal(h.find((n) => n.attrs?.class === 'picker')[0].attrs['data-review'], false)
  } finally {
    h.app.unmount()
  }
})

test('selectors without the declaration retain the original selected-row fallback', () => {
  const h = mount(undefined)
  try {
    assert.equal(h.find((n) => n.attrs?.class === 'selected-bindings').length, 1)
    assert.equal(h.find((n) => n.attrs?.['aria-label'] === 'assetRelation.permissionsFor').length, 1)
    assert.equal(h.find((n) => n.tag === 'button' && 'aria-pressed' in n.attrs).length, 0)
  } finally {
    h.app.unmount()
  }
})

test('owner rows stay read only in the inline picker', () => {
  const h = mount(true, true)
  try {
    assert.equal(h.find((n) => n.attrs?.['aria-label'] === 'assetRelation.owner').length, 1)
    assert.equal(h.find((n) => n.attrs?.['aria-label'] === 'assetRelation.permissionsFor').length, 0)
    assert.equal(h.find((n) => n.attrs?.['aria-label'] === 'assetRelation.moreFor').length, 0)
  } finally {
    h.app.unmount()
  }
})

test('read is a locked selected option while legacy grants remain unchanged until explicit editing', async () => {
  const h = mount(true)
  try {
    h.model.settings.value.permissions.push({ id: 'save', name: 'Edit' })
    h.find((node) => node.attrs?.['data-popover'])[0].attrs.onOpen()
    await vue.nextTick()
    const read = () => h.find((node) => node.attrs?.value === 'read')[0]
    assert.equal(read().attrs.disabled, true)
    assert.equal(h.find((node) => node.attrs?.value === 'save')[0].attrs.disabled, false)
    assert.deepEqual([...h.model.drafts.value[0].permissions], ['read'])
    h.find((node) => node.attrs?.['data-permissions'])[0].attrs.onChoose([])
    await vue.nextTick()
    assert.deepEqual([...h.model.drafts.value[0].permissions], ['read'])
    h.model.drafts.value[0].original = { relation: 'operator', grantedPermissions: [] }
    h.model.drafts.value[0].permissions = []
    await vue.nextTick()
    assert.equal(read().attrs.disabled, false)
    assert.deepEqual([...h.model.drafts.value[0].permissions], [])
    h.find((node) => node.attrs?.['data-permissions'])[0].attrs.onChoose(['save'])
    await vue.nextTick()
    assert.deepEqual([...h.model.drafts.value[0].permissions], ['read', 'save'])
    assert.equal(read().attrs.disabled, true)
  } finally {
    h.app.unmount()
  }
})

test('permission summary uses source names and the same neutral fallback as the options', async () => {
  const h = mount(false)
  try {
    h.model.settings.value.permissions.push(
      { id: 'save', name: 'Source edit' },
      { id: 'schedule', name: 'Source schedule' }
    )
    h.model.drafts.value[0].permissions = ['read', 'save', 'schedule']
    await vue.nextTick()
    const summary = h.find((n) => n.attrs?.class === 'permission-summary')[0]
    assert.equal(summary.attrs.title, 'Read · Source edit · Source schedule')
    for (const icon of ['eye', 'edit', 'key']) {
      assert.equal(h.find((n) => n.attrs?.['data-icon'] === icon).length, 1)
    }
    h.find((n) => n.attrs?.['data-popover'])[0].attrs.onOpen()
    await vue.nextTick()
    for (const icon of ['eye', 'edit', 'key']) {
      assert.equal(h.find((n) => n.attrs?.['data-icon'] === icon).length, 2)
    }
    h.find((n) => n.attrs?.['data-permissions'])[0].attrs.onChoose(['schedule'])
    await vue.nextTick()
    assert.deepEqual([...h.model.drafts.value[0].permissions], ['read', 'schedule'])
    assert.equal(summary.attrs.title, 'Read · Source schedule')
    h.model.drafts.value[0].permissions = []
    await vue.nextTick()
    assert.equal(summary.attrs.title, 'assetRelation.noPermissions')
  } finally {
    h.app.unmount()
  }
})

test('inline permissions stay compact while preserving every source label in the title', async () => {
  const h = mount(true)
  try {
    h.model.settings.value.permissions.push(
      { id: 'save', name: 'Edit' },
      { id: 'schedule', name: 'Schedule' },
      { id: 'delete', name: 'Delete' }
    )
    h.model.drafts.value[0].permissions = ['read', 'save', 'schedule', 'delete']
    await vue.nextTick()
    const summary = h.find((n) => n.attrs?.class === 'permission-summary')[0]
    assert.equal(summary.attrs.title, 'Read · Edit · Schedule · Delete')
    assert.equal(h.find((n) => n.attrs?.['data-icon'] === 'eye').length, 1)
    assert.equal(h.find((n) => n.attrs?.['data-icon'] === 'edit').length, 1)
    assert.equal(h.find((n) => n.attrs?.['data-icon'] === 'key').length, 0)
    assert.equal(h.find((n) => n.attrs?.class === 'permission-summary-more')[0].text.trim(), '+2')
    h.model.drafts.value[0].permissions = []
    await vue.nextTick()
    assert.equal(summary.attrs.title, 'assetRelation.noPermissions')
    assert.equal(h.find((n) => n.attrs?.['data-icon'] === 'key').length, 1)
  } finally {
    h.app.unmount()
  }
})
