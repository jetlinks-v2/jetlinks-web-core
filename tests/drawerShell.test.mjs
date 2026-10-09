import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/components/JlDrawerShell/index.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const compiled = compileScript(descriptor, { id: 'drawer-shell-test', inlineTemplate: true })
const { code } = transformSync(compiled.content, { loader: 'ts', format: 'cjs' })

test('shared shell keeps the drawer width during unmasked exit and responsive changes', async () => {
    const listeners = new Map()
    const windowStub = {
        innerWidth: 1024,
        addEventListener: (name, callback) => listeners.set(name, callback),
        removeEventListener: name => listeners.delete(name),
    }
    const module = { exports: {} }
    new Function('require', 'module', 'exports', 'ref', 'computed', 'onMounted', 'onBeforeUnmount', 'window', code)(
        require, module, module.exports, vue.ref, vue.computed, vue.onMounted, vue.onBeforeUnmount, windowStub,
    )
    const state = vue.reactive({ open: true, width: 560, mask: false })
    const snapshots = []
    const renderer = vue.createRenderer({
        createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
        insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
        parentNode: () => null, nextSibling: () => null,
    })
    const drawer = vue.defineComponent({
        props: ['open', 'width', 'contentWrapperStyle'],
        inheritAttrs: false,
        setup(props) {
            return () => {
                snapshots.push({ open: props.open, width: props.width, style: { ...props.contentWrapperStyle } })
                return null
            }
        },
    })
    const app = renderer.createApp({
        setup: () => () => vue.h(module.exports.default, {
            ...state, hideHead: true, contentWrapperStyle: { width: '900px', opacity: 0.9 },
        }),
    })
    app.component('a-drawer', drawer)
    app.component('AIcon', { render: () => null })
    app.mount({})
    try {
        assert.equal(snapshots.at(-1).style.width, '560px')
        state.open = false
        await vue.nextTick()
        assert.deepEqual(snapshots.at(-1), { open: false, width: 560, style: { width: '560px', opacity: 0.9 } })
        state.open = true
        windowStub.innerWidth = 400
        listeners.get('resize')()
        await vue.nextTick()
        assert.equal(snapshots.at(-1).width, 368)
        assert.equal(snapshots.at(-1).style.width, '368px')
        state.open = false
        await vue.nextTick()
        assert.equal(snapshots.at(-1).style.width, '368px')
        state.mask = true
        state.width = 330
        await vue.nextTick()
        assert.equal(snapshots.at(-1).style.width, '330px')
    } finally { app.unmount() }
    assert.equal(listeners.size, 0)
})
