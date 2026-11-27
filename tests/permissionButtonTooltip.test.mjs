import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)

function bundlePermissionModule(entryRelativePath, stubs = {}) {
  const source = buildSync({
    entryPoints: [resolve(import.meta.dirname, entryRelativePath)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vue', 'ant-design-vue', 'lodash-es', '@jetlinks-web/hooks'],
    write: false,
  }).outputFiles[0].text

  const mod = { exports: {} }
  new Function('require', 'module', 'exports', source)(
    (id) => (id in stubs ? stubs[id] : require(id)),
    mod,
    mod.exports,
  )
  return mod.exports
}

const { resolveTooltipPlacement } = bundlePermissionModule(
  '../src/components/PermissionButton/tooltipPlacement.ts',
)

test('resolveTooltipPlacement switches near-right-edge trigger to topRight without shifting when gap >= 8px', () => {
  const result = resolveTooltipPlacement({
    triggerRect: { left: 1764.89, right: 1874, width: 109.11 },
    viewportWidth: 1902,
  })
  assert.equal(result.placement, 'topRight')
  assert.deepEqual(result.align, {
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveTooltipPlacement adds negative horizontal offset when right-edge trigger is flush with viewport', () => {
  const result = resolveTooltipPlacement({
    triggerRect: { left: 1800, right: 1902, width: 102 },
    viewportWidth: 1902,
  })
  assert.equal(result.placement, 'topRight')
  assert.deepEqual(result.align, {
    offset: [-8, -4],
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveTooltipPlacement switches near-left-edge trigger to topLeft without shifting when gap >= 8px', () => {
  const result = resolveTooltipPlacement({
    triggerRect: { left: 16, right: 100, width: 84 },
    viewportWidth: 1902,
  })
  assert.equal(result.placement, 'topLeft')
  assert.deepEqual(result.align, {
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveTooltipPlacement adds positive horizontal offset when left-edge trigger is flush with viewport', () => {
  const result = resolveTooltipPlacement({
    triggerRect: { left: 0, right: 80, width: 80 },
    viewportWidth: 1902,
  })
  assert.equal(result.placement, 'topLeft')
  assert.deepEqual(result.align, {
    offset: [8, -4],
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveTooltipPlacement keeps top placement for centered/middle trigger', () => {
  const result = resolveTooltipPlacement({
    triggerRect: { left: 200, right: 424, width: 224 },
    viewportWidth: 1902,
  })
  assert.equal(result.placement, 'top')
  assert.deepEqual(result.align, {
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveTooltipPlacement falls back to top with alwaysByViewport on very narrow viewports', () => {
  const result = resolveTooltipPlacement({
    triggerRect: { left: 140, right: 230, width: 90 },
    viewportWidth: 240,
  })
  assert.equal(result.placement, 'top')
  assert.deepEqual(result.align, {
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveTooltipPlacement preserves explicit caller placement without overwriting offset', () => {
  const result = resolveTooltipPlacement({
    triggerRect: { left: 1764.89, right: 1874, width: 109.11 },
    viewportWidth: 1902,
    preferredPlacement: 'bottomRight',
  })
  assert.equal(result.placement, 'bottomRight')
  assert.deepEqual(result.align, {
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('usePermissionButton handles permitted popConfirm + popConfirmBefore without mutating caller objects', async (t) => {
  const confirmCalls = []
  let openCalls = []
  const hasPermRef = vue.ref(true)

  const { usePermissionButton } = bundlePermissionModule(
    '../src/components/PermissionButton/usePermissionButton.ts',
    {
      vue: {
        ...vue,
        inject: () => ({}),
        getCurrentInstance: () => null,
        onMounted: () => {},
      },
      '@jetlinks-web/hooks': {
        usePermission: () => ({ hasPerm: hasPermRef }),
      },
      'ant-design-vue': {
        Modal: {
          confirm: (cfg) => confirmCalls.push(cfg),
        },
      },
    },
  )

  const callerTooltip = {
    title: '删除提示',
    onOpenChange: (open) => openCalls.push(open),
  }
  const callerPopConfirm = {
    title: '原标题',
    content: '原内容',
    onConfirm: async (arg) => `ok:${arg}`,
    onCancel: () => {},
  }

  let state
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  scope.run(() => {
    state = usePermissionButton({
      hasPermission: vue.ref('resource:delete'),
      disabled: vue.ref(false),
      tooltip: vue.ref(callerTooltip),
      noPermissionTitle: vue.ref(undefined),
      popConfirm: vue.ref(callerPopConfirm),
      popConfirmBefore: vue.ref(async () => ({
        title: '动态标题',
        content: '动态内容',
        onConfirm: async (arg) => `dynamic:${arg}`,
      })),
    })
  })

  assert.equal(state.hasAccess.value, true)
  assert.equal(state.isDisabled.value, false)
  assert.equal(state.hasTooltip.value, true)
  assert.equal(state.tooltipProps.value.title, '删除提示')

  state.handleOpenChange(true)
  assert.deepEqual(openCalls, [true])
  assert.deepEqual(Object.keys(callerTooltip), ['title', 'onOpenChange'])

  await state.handleConfirmClick()
  assert.equal(confirmCalls.length, 1)
  assert.equal(confirmCalls[0].title, '动态标题')
  assert.equal(confirmCalls[0].content, '动态内容')
  assert.equal(await confirmCalls[0].onOk('done'), 'dynamic:done')
  assert.equal(callerPopConfirm.title, '原标题')
})

test('usePermissionButton handles denied permission locale fallback, disabled confirm, and right-edge placement', async (t) => {
  const confirmCalls = []
  const hasPermRef = vue.ref(false)
  let injectedLocale = 'No permission, please contact the administrator'

  const { usePermissionButton } = bundlePermissionModule(
    '../src/components/PermissionButton/usePermissionButton.ts',
    {
      vue: {
        ...vue,
        inject: () => ({
          antLocale: {
            PermissionButton: {
              get hasPermission() {
                return injectedLocale
              },
            },
          },
        }),
        getCurrentInstance: () => null,
        onMounted: () => {},
      },
      '@jetlinks-web/hooks': {
        usePermission: () => ({ hasPerm: hasPermRef }),
      },
      'ant-design-vue': {
        Modal: {
          confirm: (cfg) => confirmCalls.push(cfg),
        },
      },
    },
  )

  const noPermissionTitle = vue.ref(undefined)
  let state
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  scope.run(() => {
    state = usePermissionButton({
      hasPermission: vue.ref('resource:add'),
      disabled: vue.ref(false),
      tooltip: vue.ref({ title: '业务提示', open: true }),
      noPermissionTitle,
      popConfirm: vue.ref({ title: '确认', onConfirm: () => {} }),
      popConfirmBefore: vue.ref(undefined),
    })
  })

  assert.equal(state.hasAccess.value, false)
  assert.equal(state.isDisabled.value, true)
  assert.equal(state.hasTooltip.value, true)
  assert.equal(state.tooltipProps.value.title, 'No permission, please contact the administrator')
  assert.equal('open' in state.tooltipProps.value, false)

  noPermissionTitle.value = '自定义无权限提示'
  assert.equal(state.tooltipProps.value.title, '自定义无权限提示')

  noPermissionTitle.value = undefined
  injectedLocale = undefined
  assert.equal(state.tooltipProps.value.title, '暂无权限，请联系管理员')

  await state.handleConfirmClick()
  assert.equal(confirmCalls.length, 0)

  state.setTriggerRef({
    nodeType: 1,
    closest: () => null,
    getBoundingClientRect: () => ({ left: 1764.89, right: 1874, width: 109.11, height: 32 }),
    ownerDocument: { documentElement: { clientWidth: 1902 } },
  })
  state.handleOpenChange(true)
  assert.equal(state.placement.value, 'topRight')
  assert.equal(state.tooltipProps.value.placement, 'topRight')
})
