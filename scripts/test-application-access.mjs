import assert from 'node:assert/strict'

import {
  APPLICATION_ACCESS_BOOTSTRAP_QUERY_KEY,
  consumeApplicationAccessBootstrap,
  createApplicationAccessDisplayUrl,
  prepareApplicationAccess,
} from '../src/utils/application-access.ts'

const projectStorage = {
  token: 'project-token',
  apiUrl: 'https://api.example.com',
  domain: 'project-code',
  runtime: 'runtime-service',
  id: 'project-id',
  name: 'Project name',
  projectName: 'Project name',
}

assert.equal(
  createApplicationAccessDisplayUrl('application-a', '', 'https://cloud.example.com'),
  'https://cloud.example.com/application-a',
)
assert.equal(
  createApplicationAccessDisplayUrl(
    'application-a',
    'https://application.example.com/custom/path',
    'https://cloud.example.com',
  ),
  'https://application.example.com/application-a',
)

const createDependencies = (initial = new Map([['project-code', projectStorage]])) => {
  const values = new Map(initial)
  const writes = []

  return {
    values,
    writes,
    dependencies: {
      getProjectStorage: code => values.get(code),
      setProjectStorage: (code, value) => {
        writes.push({ code, value })
        values.set(code, value)
      },
      createProjectRuntimeHref: (code, path) => `/${encodeURIComponent(code)}/#${path}`,
      isProjectStorageEnabled: () => true,
    },
  }
}

{
  // 独立部署从根页面进入应用，凭证来自当前登录，不要求先创建项目会话。
  const { dependencies, writes, values } = createDependencies(new Map())
  const accessContext = { token: 'standalone-token', apiUrl: '/api' }
  const result = prepareApplicationAccess({
    applicationId: 'application-a',
    applicationName: 'Application A',
    accessContext,
    location: { origin: 'https://standalone.example.com', pathname: '/' },
  }, dependencies)

  assert.equal(result.success, true)
  assert.equal(result.url, 'https://standalone.example.com/application-a/#/?applicationScope=application-a')
  assert.equal(writes.length, 1)
  assert.equal(values.get('application-a').token, accessContext.token)
  assert.equal(values.get('application-a').scope, 'application-a')
  assert.equal(values.get('application-a').domain, undefined)
  assert.equal(values.get('application-a').id, undefined)
  assert.equal(new URLSearchParams(new URL(result.url).hash.split('?')[1]).has(APPLICATION_ACCESS_BOOTSTRAP_QUERY_KEY), false)
  assert.deepEqual(accessContext, { token: 'standalone-token', apiUrl: '/api' })
}

{
  // 已有项目会话仍优先于备用登录上下文，避免替换项目内的凭证和域名。
  const { dependencies, values } = createDependencies()
  prepareApplicationAccess({
    applicationId: 'application-a',
    accessContext: { token: 'standalone-token', apiUrl: '/api' },
    location: { origin: 'https://cloud.example.com', pathname: '/project-code/' },
  }, dependencies)
  assert.equal(values.get('application-a').token, projectStorage.token)
  assert.equal(values.get('application-a').domain, projectStorage.domain)
}

{
  const { dependencies, writes } = createDependencies(new Map())
  const result = prepareApplicationAccess({
    applicationId: 'application-a',
    accessContext: { token: '', apiUrl: '/api' },
    location: { origin: 'https://standalone.example.com', pathname: '/' },
  }, dependencies)
  assert.deepEqual(result, { success: false, reason: 'invalid-project-storage' })
  assert.equal(writes.length, 0)
}

// 本地项目会话可能只有凭证；复制时仍需保留当前请求解析出的租户域名。
for (const storedDomain of [undefined, '', '   ']) {
  for (const targetDomain of [undefined, 'https://application.example.com']) {
    const sourceStorage = { ...projectStorage, domain: storedDomain }
    const source = createDependencies(new Map([['project-code', sourceStorage]]))
    const result = prepareApplicationAccess({
      applicationId: 'application-a',
      domain: targetDomain,
      accessContext: { token: 'fallback-token', apiUrl: '/api', domain: 'project-code' },
      location: { origin: 'https://cloud.example.com', pathname: '/project-code/' },
    }, source.dependencies)
    assert.equal(result.success, true)
    assert.equal(result.projectStorage.domain, 'project-code')
    assert.equal(result.projectStorage.token, projectStorage.token)
    assert.equal(result.projectStorage.apiUrl, projectStorage.apiUrl)
    assert.equal(sourceStorage.domain, storedDomain)

    if (targetDomain) {
      const target = createDependencies(new Map())
      const consumed = consumeApplicationAccessBootstrap(new URL(result.url), {
        state: null, replaceState() {},
      }, target.dependencies)
      assert.equal(consumed.status, 'applied')
      assert.equal(target.values.get('application-a').domain, 'project-code')
    } else {
      assert.equal(source.values.get('application-a').domain, 'project-code')
    }
  }
}

{
  const source = createDependencies(new Map())
  const result = prepareApplicationAccess({
    applicationId: 'application-a',
    domain: 'application.example.com',
    accessContext: { token: 'standalone-token', apiUrl: 'https://api.example.com' },
    location: { origin: 'https://standalone.example.com', pathname: '/' },
  }, source.dependencies)
  assert.equal(result.success, true)
  assert.equal(source.writes.length, 0)
  const target = createDependencies(new Map())
  let cleanedUrl = ''
  const consumed = consumeApplicationAccessBootstrap(new URL(result.url), {
    state: null,
    replaceState: (_state, _unused, url) => { cleanedUrl = String(url) },
  }, target.dependencies)
  assert.equal(consumed.status, 'applied')
  assert.equal(target.values.get('application-a').scope, 'application-a')
  assert.equal(target.values.get('application-a').token, 'standalone-token')
  assert.equal(cleanedUrl, '/application-a/#/?applicationScope=application-a')
}

{
  const { dependencies, writes } = createDependencies()
  const result = prepareApplicationAccess({
    applicationId: 'application-a',
    applicationName: 'Application A',
    currentProjectCode: 'project-code',
    path: '/device/list',
    location: {
      origin: 'https://cloud.example.com',
      pathname: '/project-code/',
    },
  }, dependencies)

  assert.equal(result.success, true)
  assert.equal(result.crossOrigin, false)
  assert.equal(
    result.url,
    'https://cloud.example.com/application-a/#/device/list?applicationScope=application-a',
  )
  assert.deepEqual(writes, [{
    code: 'application-a',
    value: {
      ...projectStorage,
      name: 'Application A',
      scope: 'application-a',
    },
  }])
}

{
  const { dependencies, writes } = createDependencies(new Map([['application-a', projectStorage]]))
  const result = prepareApplicationAccess({
    applicationId: 'application-b',
    applicationName: 'Application B',
    location: {
      origin: 'https://cloud.example.com',
      pathname: '/application-a/',
    },
  }, dependencies)

  assert.equal(result.success, true)
  assert.equal(writes[0].code, 'application-b')
  assert.equal(writes[0].value.id, 'project-id')
  assert.equal(writes[0].value.domain, 'project-code')
  assert.equal(writes[0].value.scope, 'application-b')
}

{
  const source = createDependencies()
  const result = prepareApplicationAccess({
    applicationId: 'application-cross-origin',
    applicationName: 'Cross origin application',
    domain: 'application.example.com',
    currentProjectCode: 'project-code',
    location: {
      origin: 'https://cloud.example.com',
      pathname: '/project-code/',
    },
  }, source.dependencies)

  assert.equal(result.success, true)
  assert.equal(result.crossOrigin, true)
  assert.equal(source.writes.length, 0)

  const targetUrl = new URL(result.url)
  assert.equal(targetUrl.origin, 'https://application.example.com')
  assert.equal(targetUrl.pathname, '/application-cross-origin/')
  const targetHashQuery = new URLSearchParams(targetUrl.hash.split('?')[1])
  assert.equal(targetHashQuery.get('applicationScope'), 'application-cross-origin')
  assert.ok(targetHashQuery.has(APPLICATION_ACCESS_BOOTSTRAP_QUERY_KEY))

  const target = createDependencies(new Map())
  let cleanedUrl = ''
  const consumed = consumeApplicationAccessBootstrap(
    targetUrl,
    {
      state: { source: 'test' },
      replaceState: (_state, _unused, url) => {
        cleanedUrl = String(url)
      },
    },
    target.dependencies,
  )

  assert.equal(consumed.status, 'applied')
  assert.deepEqual(target.writes, [{
    code: 'application-cross-origin',
    value: {
      ...projectStorage,
      name: 'Cross origin application',
      scope: 'application-cross-origin',
    },
  }])
  assert.equal(
    cleanedUrl,
    '/application-cross-origin/#/?applicationScope=application-cross-origin',
  )
}

{
  const source = createDependencies()
  const result = prepareApplicationAccess({
    applicationId: 'application-a',
    applicationName: 'Application A',
    currentProjectCode: 'project-code',
    path: '/device/list',
    location: {
      origin: 'https://project.example.com',
      pathname: '/project/',
    },
  }, {
    ...source.dependencies,
    createProjectRuntimeHref: (_code, path) => `/project/#${path}`,
    isProjectStorageEnabled: () => false,
  })

  assert.equal(result.success, true)
  assert.equal(result.crossOrigin, false)
  assert.equal(
    result.url,
    'https://project.example.com/project/#/device/list?applicationScope=application-a',
  )
  assert.equal(source.writes.length, 0)
}

{
  const source = createDependencies()
  const result = prepareApplicationAccess({
    applicationId: 'application-a',
    applicationName: 'Application A',
    domain: 'application.example.com',
    currentProjectCode: 'project-code',
    location: {
      origin: 'https://project.example.com',
      pathname: '/project/',
    },
  }, {
    ...source.dependencies,
    createProjectRuntimeHref: (_code, path) => `/project/#${path}`,
    isProjectStorageEnabled: () => false,
  })

  assert.deepEqual(result, { success: false, reason: 'missing-project-storage' })
  assert.equal(source.writes.length, 0)
}

{
  const { dependencies, writes } = createDependencies(new Map())
  const result = prepareApplicationAccess({
    applicationId: 'application-a',
    currentProjectCode: 'missing-project',
    location: {
      origin: 'https://cloud.example.com',
      pathname: '/missing-project/',
    },
  }, dependencies)

  assert.deepEqual(result, { success: false, reason: 'missing-project-storage' })
  assert.equal(writes.length, 0)
}

{
  const invalidStorage = { ...projectStorage, token: '' }
  const { dependencies, writes } = createDependencies(new Map([['project-code', invalidStorage]]))
  const result = prepareApplicationAccess({
    applicationId: 'application-a',
    currentProjectCode: 'project-code',
    location: {
      origin: 'https://cloud.example.com',
      pathname: '/project-code/',
    },
  }, dependencies)

  assert.deepEqual(result, { success: false, reason: 'invalid-project-storage' })
  assert.equal(writes.length, 0)
}

{
  // API 地址允许留空，此时由统一请求层使用部署配置中的默认地址。
  const defaultApiStorage = { ...projectStorage, apiUrl: '' }
  const { dependencies } = createDependencies(new Map([['project-code', defaultApiStorage]]))
  const result = prepareApplicationAccess({
    applicationId: 'application-a',
    currentProjectCode: 'project-code',
    location: {
      origin: 'https://cloud.example.com',
      pathname: '/project-code/',
    },
  }, dependencies)

  assert.equal(result.success, true)
  assert.equal(result.projectStorage.apiUrl, '')
}

{
  const target = createDependencies(new Map())
  const url = new URL('https://application.example.com/another-application/?applicationScope=application-a#/')
  url.searchParams.set(APPLICATION_ACCESS_BOOTSTRAP_QUERY_KEY, JSON.stringify({
    version: 1,
    applicationCode: 'application-a',
    applicationId: 'application-a',
    projectStorage,
  }))
  let cleanedUrl = ''
  const consumed = consumeApplicationAccessBootstrap(
    url,
    {
      state: null,
      replaceState: (_state, _unused, nextUrl) => {
        cleanedUrl = String(nextUrl)
      },
    },
    target.dependencies,
  )

  assert.deepEqual(consumed, { status: 'invalid', reason: 'application-code-mismatch' })
  assert.equal(target.writes.length, 0)
  assert.equal(cleanedUrl, '/another-application/?applicationScope=application-a#/')
}

console.log('application access tests passed')
