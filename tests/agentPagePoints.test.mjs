import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const workspace = fileURLToPath(new URL('../../', import.meta.url))
const core = resolve(workspace, 'jetlinks-web-core/src')
const inspection = resolve(workspace, 'modules/jetlinks-inspection-ui')
const modal = resolve(workspace, 'modules/jetlinks-ai-agent-ui/views/agentDevelopment/applicationList/manage/components/AgentPagePointDeployModal.vue')
const builtinIds = ['visualizationComponentGenerator', 'projectAiSearchHub', 'iotHome', 'deviceDetailChat', 'ruleEditorChat', 'productDetailChat', 'knowledgeAISearch']

// 执行真实模块入口、宿主收集器、保存 API 和弹窗脚本，仅替换 Vite glob、登录传输与 UI 环境。
function setup(extraModules = {}, includeInspection = true) {
  const cache = new Map()
  const messages = Object.fromEntries(['zh', 'en', 'ja'].map(lang => [lang, {
    ...JSON.parse(readFileSync(resolve(core, `locales/lang/${lang}.json`), 'utf8')),
    ...JSON.parse(readFileSync(resolve(inspection, `locales/lang/${lang}.json`), 'utf8')),
  }]))
  let language = 'zh'
  let saveFailure
  const calls = []
  const persisted = new Map([['external-entry', { clientId: 'external-entry', expands: { type: 'button' } }]])
  const request = { post: async (url, data) => {
    calls.push({ url, data })
    assert.equal(url, '/ai/agent/deploy/client/pagePoint/_save')
    if (saveFailure === 'throw') throw new Error('AI service unavailable')
    if (saveFailure === 'reject') return { success: false }
    for (const entry of data) persisted.set(entry.clientId, entry)
    return { success: true }
  } }
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename)
    const exports = {}
    cache.set(filename, exports)
    let source = readFileSync(filename, 'utf8')
    if (filename.endsWith('.vue')) source = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
    const code = ts.transpileModule(source.replaceAll('import.meta.glob', '__glob'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    const result = new Function('require', 'exports', '__glob', 'defineProps', 'withDefaults', 'defineEmits', code + (filename === modal
      ? '\nreturn { fetchPagePointList, visiblePagePointList, formState, loading };' : ''))(id => {
      if (id === 'vue') return vue
      if (id === 'vue-i18n') return { useI18n: () => ({ t: key => messages[language][key] ?? key }) }
      if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => messages[language][key] ?? key } } }
      if (id === '@jetlinks-web/core') return { request }
      if (id === '@jetlinks-web/utils') return { getModuleRoutesMap: () => ({}), getToken: () => undefined }
      if (id === '@jetlinks-web/constants') return {}
      if (id === '@jetlinks-web-core/store') return {}
      if (id === '@jetlinks-web-core/utils/module-registry') return { moduleRegistry: { register() {} } }
      if (id === '@jetlinks-web-core/utils/file-url') return { resolveFileUrl: () => undefined }
      if (id === '@jetlinks-web-core/utils/request-context') return { getBaseApi: () => '/api' }
      if (id === './share-authorization') return {}
      if (id === './register' && filename === resolve(inspection, 'index.ts')) return { __esModule: true, default: {} }
      if (id === './package.json') return { name: 'jetlinks-inspection-ui' }
      if (id.endsWith('.less')) return {}
      if (id === '@jetlinks-ai-agent-ui/api/agent') return {
        pagePoint: async data => {
          calls.push({ url: '/ai/agent/deploy/client/_query/no-paging', data })
          return { success: true, result: [...persisted.values()] }
        },
        addDeploy: () => { throw new Error('Registration must not deploy agents') },
      }
      const base = id.startsWith('@jetlinks-web-core/')
        ? resolve(core, id.slice('@jetlinks-web-core/'.length))
        : id.startsWith('.') ? resolve(dirname(filename), id) : undefined
      return base ? load(`${base}.ts`) : require(id)
    }, exports, () => filename === resolve(core, 'utils/modules.ts') ? {
      ...(includeInspection ? { '../../../modules/jetlinks-inspection-ui/index.ts': load(resolve(inspection, 'index.ts')) } : {}),
      ...extraModules,
    } : {}, () => ({ open: false }), (props, defaults) => ({ ...defaults, ...props }), () => () => {})
    if (result) Object.assign(exports, result)
    return exports
  }
  return {
    collect: () => load(resolve(core, 'utils/agent-page-points.ts')).getAgentPagePointDeclarations(),
    modal: () => load(modal),
    calls, persisted,
    setLanguage: value => { language = value },
    setSaveFailure: value => { saveFailure = value },
  }
}

test('without business modules the seven built-in declarations are preserved', () => {
  assert.deepEqual(setup({}, false).collect().map(item => item.clientId), builtinIds)
})

test('the real inspection module exports a unique declaration matching the backend contract', () => {
  const entries = setup().collect()
  assert.deepEqual(entries.slice(0, 7).map(item => item.clientId), builtinIds)
  assert.equal(entries.length, 8)
  const declaration = entries.find(item => item.clientId === 'inspection-config-assistant')
  const [reference] = JSON.parse(readFileSync(resolve(workspace, '../modules/jetlinks-inspection/inspection-manager/src/main/resources/inspection/assistant-page-point.json'), 'utf8'))
  for (const key of ['clientType', 'clientId', 'maxAgentSize', 'metadata', 'order']) assert.deepEqual(declaration[key], reference[key])
  assert.equal(declaration.expands.type, 'chatBubbles')
})

test('module factories resolve current zh/en/ja translations without caching the first language', () => {
  const env = setup()
  for (const [language, name] of [['zh', '巡检配置助手'], ['en', 'Inspection Configuration Assistant'], ['ja', '巡検設定アシスタント']]) {
    env.setLanguage(language)
    const entry = env.collect().find(item => item.clientId === 'inspection-config-assistant')
    assert.equal(entry.name, name)
    for (const value of [entry.description, entry.searchCode, entry.expands.menuName]) {
      assert.ok(value)
      assert.ok(!value.startsWith('inspection.agentPagePoint.'))
    }
  }
})

test('filtered modules contribute no declarations', () => {
  const env = setup({ filtered: { default: { filter: true, getAgentPagePoints: () => { throw new Error('Must not execute') } } } })
  assert.equal(env.collect().length, 8)
})

test('duplicate client IDs are sent once and higher module priority wins', t => {
  const warnings = []
  const original = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))
  t.after(() => { console.warn = original })
  const entry = name => ({ clientType: 'pagePoint', clientId: 'iotHome', name, maxAgentSize: 1, expands: { type: 'chatMenu' } })
  const env = setup({
    high: { default: { priority: 20, getAgentPagePoints: () => [entry('high')] } },
    low: { default: { priority: 10, getAgentPagePoints: () => [entry('low')] } },
  })
  const entries = env.collect()
  assert.equal(entries.length, 8)
  assert.equal(entries.find(item => item.clientId === 'iotHome').name, 'high')
  assert.equal(warnings.length, 2)
})

test('the deployment dialog saves declarations before querying and shows inspection in chat bubbles', async () => {
  const env = setup()
  const dialog = env.modal()
  await dialog.fetchPagePointList()
  assert.deepEqual(env.calls.map(call => call.url), ['/ai/agent/deploy/client/pagePoint/_save', '/ai/agent/deploy/client/_query/no-paging'])
  assert.equal(env.calls[0].data.length, 8)
  assert.ok(env.persisted.has('external-entry'), 'incremental save keeps declarations registered elsewhere')
  assert.ok(dialog.visiblePagePointList.value.some(item => item.clientId === 'inspection-config-assistant'))
  dialog.formState.slotType = 'button'
  assert.ok(!dialog.visiblePagePointList.value.some(item => item.clientId === 'inspection-config-assistant'))
  assert.ok(dialog.visiblePagePointList.value.some(item => item.clientId === 'knowledgeAISearch'))
  assert.equal(dialog.loading.value, false)
})

for (const failure of ['throw', 'reject']) {
  test(`declaration sync failure (${failure}) preserves persisted choices and retries on next query`, async t => {
    const original = console.warn
    const warnings = []
    console.warn = (...args) => warnings.push(args)
    t.after(() => { console.warn = original })
    const env = setup()
    env.setSaveFailure(failure)
    const dialog = env.modal()
    await dialog.fetchPagePointList()
    assert.equal(env.calls.length, 2)
    assert.equal(env.persisted.size, 1)
    assert.equal(dialog.loading.value, false)
    env.setSaveFailure(undefined)
    await dialog.fetchPagePointList()
    assert.equal(env.calls.length, 4)
    assert.ok(dialog.visiblePagePointList.value.some(item => item.clientId === 'inspection-config-assistant'))
    assert.equal(warnings.length, failure === 'throw' ? 1 : 0)
  })
}

test('menu initialization uses the same collector as deployment and does not read the static list', () => {
  const source = readFileSync(resolve(core, 'views/init-home/Menu/index.vue'), 'utf8')
  assert.match(source, /saveAgentList\(getAgentPagePointDeclarations\(\)\)/)
  assert.match(source, /from ['"]@jetlinks-web-core\/utils\/agent-page-points['"]/)
  assert.doesNotMatch(source, /import.*agentData/)
})
