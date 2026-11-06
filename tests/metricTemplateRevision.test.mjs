import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, ref } from 'vue'
import { resolve } from 'node:path'
import { createMetricLoader, flush, sourceRoot } from './helpers/metricRuntime.mjs'
const load = createMetricLoader({ [resolve(sourceRoot, 'components/Metric/api.ts')]: { metricApi: {} } })
const { useTemplateUpdates } = load('components/Metric/template/useTemplateUpdates.ts')
const { useMetricTemplates } = load('components/Metric/template/useMetricTemplates.ts')
const { localizedTemplate } = load('components/Metric/template/text.ts')
const template = { id: 'power', version: '1', name: '能耗', inputDefinitions: [{ id: 'reading', name: '读数' }],
  parameterDefinitions: [{ id: 'factor', name: '系数' }], parameters: { factor: 1 }, definitions: [{ id: 'usage', name: '用量', expression: 'reading * params.factor' }],
  outputs: [{ metricId: 'usage', label: '用量' }], options: { custom: true, i18nMessages: { name: { en: 'Energy' }, 'input.reading.name': { en: 'Reading' }, 'parameter.factor.name': { en: 'Factor' }, 'rule.usage.name': { en: 'Consumption' }, 'output.usage.label': { en: 'Usage' } } } }
const entity = { id: 'key', name: '能耗', released: true, revision: 2, editRevision: 4, template }
const config = id => ({ id, name: id, revision: 3, templateRevision: 1, state: 'enabled' })
function setup(api) {
  const scope = effectScope(), selected = ref(entity), editable = ref(true)
  return { scope, selected, editable, updates: scope.run(() => useTemplateUpdates(selected, editable, api)) }
}

test('语言切换仅生成展示视图，公式和来源标识保留且原模板可往返', () => {
  const before = JSON.stringify(template)
  const en = localizedTemplate(template, 'en-US')
  assert.equal(en.name, 'Energy'); assert.equal(en.inputDefinitions[0].name, 'Reading')
  assert.equal(en.parameterDefinitions[0].name, 'Factor'); assert.equal(en.outputs[0].label, 'Usage')
  assert.equal(en.definitions[0].expression, 'reading * params.factor')
  assert.equal(en.inputDefinitions[0].id, 'reading')
  assert.equal(localizedTemplate(template, 'zh-CN').name, '能耗')
  assert.equal(JSON.stringify(template), before)
})

test('已发布模板保存/发布携带编辑修订，撤销恢复发布内容且完整模式锁定身份', async () => {
  const scope = effectScope(), editable = ref(true)
  const calls = []
  const pending = { ...entity, editRevision: 5, draft: { ...template, definitions: [{ id: 'usage', expression: 'reading + 1' }] } }
  const view = scope.run(() => useMetricTemplates(editable, {
    queryTemplates: async () => ({ data: [], total: 0 }),
    saveTemplate: async (value, revision) => { calls.push(['save', revision]); return pending },
    releaseTemplate: async (id, revision) => { calls.push(['release', revision]); return { ...pending, draft: null, revision: 3, editRevision: 6, template: pending.draft } },
    discardTemplateDraft: async (id, revision) => { calls.push(['discard', revision]); return { ...entity, editRevision: 6 } },
  }))
  try {
    view.open(entity); assert.equal(view.readOnly.value, false)
    view.switchMode('full'); view.fullText.value = view.fullText.value.replace('id: power', 'id: other')
    await view.save(); assert.equal(calls.length, 0); assert.match(view.error.value, /ID and version/)
    view.open(pending); await view.discardDraft()
    assert.equal(view.draft.value.definitions[0].expression, 'reading * params.factor')
    assert.deepEqual(calls, [['discard', 5]])
    view.open(entity); await view.release()
    assert.deepEqual(calls.slice(1), [['save', 4], ['release', 5]])
    assert.equal(view.selected.value.revision, 3)
    view.open(pending); view.newVersion()
    assert.equal(view.draft.value.definitions[0].expression, 'reading + 1')
    assert.equal(view.draft.value.version, ''); assert.equal(view.selected.value, undefined)
    editable.value = false; await view.discardDraft(); assert.equal(calls.length, 3)
  } finally { scope.stop() }
})

test('按引用分页应用，沿用配置CAS，反馈读取失败不误报保存失败', async () => {
  const rows = Array.from({ length: 35 }, (_, i) => config(String(i).padStart(2, '0'))), applied = [], cursors = []
  const state = setup({
    templateRevisions: async () => [{ revision: 2, publishedAt: 1 }],
    templateReferences: async (_key, cursor) => { cursors.push(cursor); return rows.filter(item => !cursor || item.id > cursor).slice(0, 32) },
    applyTemplateRevision: async (id, revision, expected) => { applied.push([id, revision, expected]); return { ...config(id), templateRevision: revision, revision: expected + 1 } },
    latest: async () => { throw new Error('Feedback unavailable') },
  })
  try {
    await state.updates.load(); assert.equal(state.updates.references.value.length, 32)
    await state.updates.apply(true)
    assert.equal(applied.length, 35); assert.deepEqual(applied[0], ['00', 2, 3])
    assert.deepEqual(cursors, [undefined, undefined, '31'])
    assert.deepEqual(state.updates.summary.value, { saved: 35, failed: 0 })
    assert.equal(Object.keys(state.updates.outcomes.value).length, 32)
    assert.equal(state.updates.references.value[0].revision, 4)
    assert.match(state.updates.outcomes.value['00'].error, /Feedback unavailable/)
  } finally { state.scope.stop() }
})

test('保存或装载失败读取实际配置，重试使用最新CAS且切换不回填旧引用', async () => {
  const applied = []
  let fail = true, releaseRead
  const state = setup({
    templateRevisions: async () => [], templateReferences: async () => [config('c')],
    applyTemplateRevision: async (_id, revision, expected) => { applied.push(expected); if (fail) throw new Error('Load failed'); return { ...config('c'), revision: 5, templateRevision: revision } },
    getConfig: async () => ({ ...config('c'), revision: 4, templateRevision: 2 }), latest: async () => [],
  })
  try {
    await state.updates.load(); state.updates.selectedIds.value = ['c']; await state.updates.apply(false)
    assert.deepEqual(state.updates.summary.value, { saved: 0, failed: 1 })
    assert.equal(state.updates.references.value[0].revision, 4)
    fail = false; await state.updates.apply(false); assert.deepEqual(applied, [3, 4])
    state.selected.value = { ...entity, id: 'other' }
    assert.deepEqual(state.updates.selectedIds.value, []); assert.equal(state.updates.references.value.length, 0)
  } finally { state.scope.stop() }
})

test('异步读取和撤权保护：旧页面不回填、批量不继续、修订按游标读取', async () => {
  let finish, writes = 0
  const pending = new Promise(resolve => { finish = resolve })
  const state = setup({
    templateReferences: async () => pending,
    templateRevisions: async (_key, before) => before ? [{ revision: 2, publishedAt: 1 }] : Array.from({ length: 32 }, (_, i) => ({ revision: 34 - i, publishedAt: 1 })),
    applyTemplateRevision: async () => { writes++; state.editable.value = false; return { ...config('a'), state: 'disabled' } },
  })
  try {
    const reading = state.updates.load(); state.selected.value = { ...entity, id: 'next' }
    finish([config('old')]); await reading
    assert.equal(state.updates.references.value.length, 0)
    await state.updates.load(); assert.equal(state.updates.hasMoreRevisions.value, true)
    await state.updates.loadRevisions(); assert.equal(state.updates.revisions.value.at(-1).revision, 2)
    assert.equal(state.updates.hasMoreRevisions.value, false)
    state.updates.references.value = [config('a'), config('b')]; state.updates.selectedIds.value = ['a', 'b']
    await state.updates.apply(false); assert.equal(writes, 1); assert.equal(state.updates.applying.value, false)
    await state.updates.apply(false); assert.equal(writes, 1)
  } finally { state.scope.stop() }
})

test('引用读取失败不反显为没有引用，重试成功后才确定空态', async () => {
  let fail = true
  const state = setup({ templateRevisions: async () => [], templateReferences: async () => { if (fail) throw new Error('timeout'); return [] } })
  try {
    await state.updates.load()
    assert.equal(state.updates.referencesLoaded.value, false); assert.match(state.updates.error.value, /timeout/)
    fail = false; await state.updates.load()
    assert.equal(state.updates.referencesLoaded.value, true); assert.equal(state.updates.error.value, '')
  } finally { state.scope.stop() }
})
