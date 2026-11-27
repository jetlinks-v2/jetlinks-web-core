import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'

const require = createRequire(import.meta.url)

function loadUseNoPermissionTooltip() {
  const source = buildSync({
    entryPoints: [resolve(import.meta.dirname, '../src/components/PermissionButton/useNoPermissionTooltip.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vue', '@jetlinks-web/hooks', '@jetlinks-web/components/es/locale/zh-CN'],
    write: false,
  }).outputFiles[0].text

  const mod = { exports: {} }
  new Function('require', 'module', 'exports', source)(
    (id) => {
      if (id === '@jetlinks-web/hooks') return { usePermission: () => ({ hasPerm: { value: false } }) }
      if (id === '@jetlinks-web/components/es/locale/zh-CN') {
        return { PermissionButton: { hasPermission: '暂无权限，请联系管理员' } }
      }
      return require(id)
    },
    mod,
    mod.exports,
  )
  return mod.exports
}

const { resolveNoPermissionTooltipPlacement } = loadUseNoPermissionTooltip()

test('resolveNoPermissionTooltipPlacement switches near-right-edge trigger to topRight without shifting when gap >= 8px', () => {
  const result = resolveNoPermissionTooltipPlacement({
    triggerRect: { left: 1764.89, right: 1874, width: 109.11 },
    viewportWidth: 1902,
  })
  assert.equal(result.placement, 'topRight')
  assert.deepEqual(result.align, {
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveNoPermissionTooltipPlacement adds negative horizontal offset when right-edge trigger is flush with viewport', () => {
  const result = resolveNoPermissionTooltipPlacement({
    triggerRect: { left: 1800, right: 1902, width: 102 },
    viewportWidth: 1902,
  })
  assert.equal(result.placement, 'topRight')
  assert.deepEqual(result.align, {
    offset: [-8, -4],
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveNoPermissionTooltipPlacement switches near-left-edge trigger to topLeft without shifting when gap >= 8px', () => {
  const result = resolveNoPermissionTooltipPlacement({
    triggerRect: { left: 16, right: 100, width: 84 },
    viewportWidth: 1902,
  })
  assert.equal(result.placement, 'topLeft')
  assert.deepEqual(result.align, {
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveNoPermissionTooltipPlacement adds positive horizontal offset when left-edge trigger is flush with viewport', () => {
  const result = resolveNoPermissionTooltipPlacement({
    triggerRect: { left: 0, right: 80, width: 80 },
    viewportWidth: 1902,
  })
  assert.equal(result.placement, 'topLeft')
  assert.deepEqual(result.align, {
    offset: [8, -4],
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveNoPermissionTooltipPlacement keeps top placement for centered/middle trigger', () => {
  const result = resolveNoPermissionTooltipPlacement({
    triggerRect: { left: 200, right: 424, width: 224 },
    viewportWidth: 1902,
  })
  assert.equal(result.placement, 'top')
  assert.deepEqual(result.align, {
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveNoPermissionTooltipPlacement falls back to top with alwaysByViewport on very narrow viewports', () => {
  const result = resolveNoPermissionTooltipPlacement({
    triggerRect: { left: 140, right: 230, width: 90 },
    viewportWidth: 240,
  })
  assert.equal(result.placement, 'top')
  assert.deepEqual(result.align, {
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})

test('resolveNoPermissionTooltipPlacement preserves explicit caller placement without overwriting offset', () => {
  const result = resolveNoPermissionTooltipPlacement({
    triggerRect: { left: 1764.89, right: 1874, width: 109.11 },
    viewportWidth: 1902,
    preferredPlacement: 'bottomRight',
  })
  assert.equal(result.placement, 'bottomRight')
  assert.deepEqual(result.align, {
    overflow: { adjustX: 1, adjustY: 1, alwaysByViewport: true },
  })
})
