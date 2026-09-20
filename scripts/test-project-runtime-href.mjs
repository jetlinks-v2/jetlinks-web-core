import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// 直接打包生产 URL 生成器；仅隔离与 URL 无关的存储及请求依赖。
const scenarios = [
  { deployment: 'saas', scope: 'project', base: '/' },
  { deployment: 'saas', scope: 'auto', base: '/' },
  { deployment: undefined, scope: 'project', base: '/' },
  { deployment: 'private', scope: 'project', base: '/' },
  { deployment: 'private', scope: 'project', base: '/iot/' },
  { deployment: 'private', scope: 'auto', base: '/iot/' },
]
let assertions = 0
for (const scenario of scenarios) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/utils/project-runtime.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    define: {
      'import.meta.env': JSON.stringify({
        VITE_APP_DEPLOYMENT: scenario.deployment,
        VITE_APP_ENVIRONMENT: 'saas',
        VITE_APP_RUNTIME_SCOPE: scenario.scope,
        VITE_APP_PROJECT_CODE: 'fixed-project',
        BASE_URL: scenario.base,
      }),
    },
    plugins: [{
      name: 'isolate-unrelated-runtime-services',
      setup(builder) {
        builder.onResolve({ filter: /^\.\/(project-storage|request-context)$/ }, args => ({
          path: args.path, namespace: 'runtime-service-stub',
        }))
        builder.onLoad({ filter: /.*/, namespace: 'runtime-service-stub' }, () => ({
          contents: 'export const getProjectStorage = () => undefined; export const isProjectStorageEnabled = () => true; export const isFromCloud = () => false;',
        }))
      },
    }],
  })
  globalThis.window = { location: { pathname: '/current-project/' } }
  const { createProjectRuntimeHref, redirectLegacyProjectHash } = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
  )
  for (const project of ['p_p9m9b7', 'other-project', '', '项目 A']) {
    const prefix = scenario.deployment === 'private'
      ? scenario.base
      : project ? `/${encodeURIComponent(project)}/` : '/'
    for (const route of ['/visualization/ai-editor/draft', '/visualization/preview/draft']) {
      const query = '?aiPromptWorkflow=page&name=%E6%B5%8B%E8%AF%95'
      assert.equal(createProjectRuntimeHref(project, `${route}${query}`), `${prefix}#${route}${query}`)
      assert.equal(createProjectRuntimeHref(project, `/project/legacy${route}${query}`), `${prefix}#${route}${query}`)
      assertions += 2
    }
  }
  assert.equal(redirectLegacyProjectHash('#/project/old/visualization/preview/draft?mode=preview'), true)
  assert.equal(window.location.href, `${scenario.deployment === 'private' ? scenario.base : '/old/'}#/visualization/preview/draft?mode=preview`)
  assertions += 2
}
console.log(`project-runtime href: ${assertions} assertions passed across ${scenarios.length} deployment configurations`)
