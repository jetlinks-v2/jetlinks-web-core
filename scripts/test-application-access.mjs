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
  const invalidStorage = { ...projectStorage, apiUrl: '' }
  const { dependencies } = createDependencies(new Map([['project-code', invalidStorage]]))
  const result = prepareApplicationAccess({
    applicationId: 'application-a',
    currentProjectCode: 'project-code',
    location: {
      origin: 'https://cloud.example.com',
      pathname: '/project-code/',
    },
  }, dependencies)

  assert.deepEqual(result, { success: false, reason: 'invalid-project-storage' })
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
