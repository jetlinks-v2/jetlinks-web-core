import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
const require = createRequire(import.meta.url)
const vue = require('vue')
const compiled = await build({
  stdin: {
    contents:
      "export * from './src/components/AssetRelationEditor/useAssetRelationEditor'; export * from './src/components/AssetRelationEditor/useRelationObjectCandidates'; export * from './src/utils/object-relation-registry'; export * from './src/api/asset-bindings'",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    loader: 'ts'
  },
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  external: ['vue', '@jetlinks-web/core'],
  plugins: [
    {
      name: 'dimension-registry',
      setup(builder) {
        builder.onResolve({ filter: /\.vue$/ }, (args) => ({ path: args.path, external: true }))
        builder.onResolve({ filter: /(^|\/)module-registry$/ }, () => ({ path: 'module-registry', external: true }))
        builder.onResolve({ filter: /AssetOwnershipCondition\/registry$/ }, () => ({
          path: 'dimension-registry',
          external: true
        }))
      }
    }
  ]
})
const flush = async () => {
  await vue.nextTick()
  await new Promise((resolve) => setImmediate(resolve))
  await vue.nextTick()
}
const declaration = { provider: 'asset:org', assetType: 'testAsset', assetIdProperty: 'assetId', dimensionType: 'org' }
function fixture(
  settings = {
    multiple: true,
    permissionSupported: true,
    permissions: [
      { id: 'read', name: 'Read' },
      { id: 'save', name: 'Save' }
    ]
  }
) {
  const calls = [],
    events = [],
    deltas = []
  let objects = [],
    related = [],
    providers = new Map()
  const page = (rows, query) => {
    let result = rows
    for (const term of query.terms || []) {
      if (term.termType === 'in') result = result.filter((row) => term.value.includes(row[term.column]))
      if (term.termType === 'eq') result = result.filter((row) => row[term.column] === term.value)
      if (term.termType === 'like') result = result.filter((row) => row.name.includes(term.value.slice(1, -1)))
    }
    return {
      data: result.slice(query.pageIndex * query.pageSize, (query.pageIndex + 1) * query.pageSize),
      total: result.length
    }
  }
  let details = [],
    failure = '',
    permissionFailure = '',
    denyDetails = false,
    detailsGate
  const request = {
    get: async (url) => ({ status: 200, result: settings }),
    post: async (url, data) => {
      calls.push({ method: 'post', url, data })
      if (url === '/relation/objects/_query' || url === '/relation/objects/related/_query') {
        if (detailsGate) await detailsGate
        if (denyDetails) throw new Error('denied')
        return { status: 200, result: page(url.includes('/related/') ? related : objects, data.query) }
      }
      if (url.includes('target/_query')) {
        if (detailsGate) await detailsGate
        if (denyDetails) throw new Error('denied')
        return { status: 200, result: details }
      }
      if (failure) throw new Error(failure)
      return { status: 200 }
    },
    put: async (url, data) => {
      calls.push({ method: 'put', url, data })
      if (permissionFailure || failure) throw new Error(permissionFailure || failure)
      return { status: 200 }
    }
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(
    (name) => {
      if (name === '@jetlinks-web/core') return { request }
      if (name === 'module-registry') return { moduleRegistry: { getAllModules: () => providers } }
      if (name === 'dimension-registry')
        return {
          resolveAssetDimensionFilter: () => ({
            createSelector: () => ({
              options: [
                { value: 'A', label: 'Organization A' },
                { value: 'B', label: 'Organization B' }
              ]
            })
          })
        }
      return require(name)
    },
    module,
    module.exports
  )
  const scope = vue.effectScope()
  const context = vue.ref({
    subject: { typeId: 'device', id: 'D', name: 'Device', data: { assetId: 'mapped-D' } },
    relation: { id: 'asset-binding', name: 'Assigned', targetType: 'org' },
    maintenance: declaration
  })
  const editor = scope.run(() =>
    module.exports.useAssetRelationEditor(() => context.value, {
      changed: (change) => {
        events.push('changed')
        deltas.push(change)
      },
      close: () => events.push('close'),
      busy: (value) => events.push(value)
    })
  )
  return {
    editor,
    calls,
    events,
    deltas,
    scope,
    context,
    setObjects: (value) => {
      objects = value
    },
    setRelated: (value) => {
      related = value
    },
    setProviders: (value) => {
      providers = value
    },
    resolveMaintainer: module.exports.resolveObjectRelationMaintainer,
    candidates: (input, report) => scope.run(() => module.exports.useRelationObjectCandidates(input, report)),
    setDetails: (value) => {
      details = value
    },
    fail: (value) => {
      failure = value
    },
    failPermissions: (value) => {
      permissionFailure = value
    },
    denyDetails: (value) => {
      denyDetails = value
    },
    delayDetails: (value) => {
      detailsGate = value
    }
  }
}

test('multiple targets keep independent permissions and use the mapped asset identity without allPermission', async () => {
  const f = fixture()
  await flush()
  await f.editor.select(['A', 'B'])
  f.editor.drafts.value[0].permissions = ['read']
  f.editor.drafts.value[1].permissions = ['read', 'save']
  await f.editor.save()
  const bind = f.calls.find((call) => call.url === '/assets/bind/testAsset')
  assert.deepEqual(
    bind.data.map((row) => [row.targetId, row.permission, row.assetIdList, row.allPermission]),
    [
      ['A', ['read'], ['mapped-D'], false],
      ['B', ['read', 'save'], ['mapped-D'], false]
    ]
  )
  assert.deepEqual(f.events, [true, 'changed', false, 'close'])
  f.scope.stop()
})

test('single target and no permission support come from settings; switching never broadly unbinds', async () => {
  const f = fixture({ multiple: false, permissionSupported: false, permissions: [] })
  await flush()
  await f.editor.select(['A', 'B'])
  assert.deepEqual([...f.editor.ids.value], ['B'])
  f.editor.setPermissions(f.editor.drafts.value[0], ['save'])
  await f.editor.save()
  const bind = f.calls.find((call) => call.url === '/assets/bind/testAsset')
  assert.deepEqual(bind.data[0].permission, [])
  assert.equal(
    f.calls.some((call) => call.url.includes('unbind') || call.url.includes('_all')),
    false
  )
  f.scope.stop()
})

test('a save combining new targets and existing permission changes notifies once after all writes', async () => {
  const f = fixture()
  await flush()
  f.setDetails([{ targetId: 'A', grantedPermissions: ['read'] }])
  await f.editor.select(['A', 'B'])
  f.editor.drafts.value[0].permissions = ['read', 'save']
  f.editor.drafts.value[1].permissions = ['read']
  await f.editor.save()
  assert.equal(f.calls.filter((call) => call.url === '/assets/bind/testAsset').length, 1)
  assert.equal(f.calls.filter((call) => call.method === 'put').length, 1)
  assert.deepEqual(f.events, [true, 'changed', false, 'close'])
  f.scope.stop()
})

test('a partial save notifies once and retries remaining permissions without binding again', async () => {
  const f = fixture()
  await flush()
  f.setDetails([{ targetId: 'A', grantedPermissions: ['read'] }])
  await f.editor.select(['A', 'B'])
  f.editor.setPermissions(f.editor.drafts.value[0], ['save'])
  f.editor.drafts.value[1].permissions = ['read']
  f.failPermissions('permission update failed')
  await f.editor.save()
  assert.equal(f.editor.error.value, 'permission update failed')
  assert.deepEqual(f.events, [true, 'changed', false])
  assert.deepEqual([...f.editor.drafts.value[0].permissions], ['read', 'save'])
  assert.deepEqual([...f.editor.drafts.value[0].original.grantedPermissions], ['read'])
  assert.deepEqual([...f.editor.drafts.value[1].original.grantedPermissions], ['read'])
  f.failPermissions('')
  await f.editor.retry()
  await f.editor.save()
  assert.equal(f.calls.filter((call) => call.url === '/assets/bind/testAsset').length, 1)
  assert.equal(f.calls.filter((call) => call.method === 'put').length, 2)
  assert.deepEqual(f.events, [true, 'changed', false, true, 'changed', false, 'close'])
  f.scope.stop()
})

test('existing custom role is preserved and permissions update only its target; owner is read only', async () => {
  const f = fixture()
  await flush()
  f.setDetails([
    { targetId: 'A', relation: 'owner', grantedPermissions: ['read', 'save'] },
    { targetId: 'B', relation: 'operator', grantedPermissions: ['read'] }
  ])
  await f.editor.select(['A', 'B'])
  f.editor.drafts.value[0].permissions = []
  f.editor.setPermissions(f.editor.drafts.value[1], ['save'])
  await f.editor.save()
  assert.deepEqual(
    f.calls.filter((call) => call.method === 'put'),
    [{ method: 'put', url: '/assets/permission/testAsset/mapped-D/org/B', data: ['read', 'save'] }]
  )
  assert.equal(
    f.calls.some((call) => call.url === '/assets/bind/testAsset'),
    false
  )
  await f.editor.save(f.editor.drafts.value[0])
  assert.equal(
    f.calls.some((call) => call.url.includes('unbind')),
    false
  )
  f.scope.stop()
})

test('denied lookup cannot become a new binding; failed save retains drafts for explicit retry', async () => {
  const f = fixture()
  await flush()
  f.denyDetails(true)
  await f.editor.select(['A'])
  await f.editor.save()
  assert.equal(
    f.calls.some((call) => call.url === '/assets/bind/testAsset'),
    false
  )
  f.denyDetails(false)
  await f.editor.retry()
  f.editor.drafts.value[0].permissions = ['read']
  f.fail('forbidden')
  await f.editor.save()
  assert.equal(f.editor.error.value, 'forbidden')
  assert.deepEqual([...f.editor.drafts.value[0].permissions], ['read'])
  assert.equal(f.events.includes('close'), false)
  f.fail('')
  f.editor.retry()
  await f.editor.save()
  assert.equal(f.events.includes('changed'), true)
  assert.equal(f.events.at(-1), 'close')
  f.scope.stop()
})

test('copying permissions changes only selected editable drafts and keeps arrays independent', async () => {
  const f = fixture()
  await flush()
  f.setDetails([{ targetId: 'A', relation: 'owner', grantedPermissions: ['read', 'save'] }])
  await f.editor.select(['A', 'B', 'C'])
  const [owner, source, target] = f.editor.drafts.value
  source.permissions = ['read']
  f.editor.applyPermissions(source)
  assert.deepEqual([...owner.permissions], ['read', 'save'])
  assert.deepEqual([...target.permissions], ['read'])
  source.permissions.push('save')
  assert.deepEqual([...target.permissions], ['read'])
  assert.equal(
    f.calls.some((call) => !call.url.includes('target/_query')),
    false
  )
  f.scope.stop()
})

test('a binding lookup completing after disposal cannot update drafts or emit changes', async () => {
  const f = fixture()
  await flush()
  let release
  f.delayDetails(
    new Promise((resolve) => {
      release = resolve
    })
  )
  const pending = f.editor.select(['A'])
  f.scope.stop()
  f.setDetails([{ targetId: 'A', relation: 'operator', grantedPermissions: ['save'] }])
  release()
  await pending
  assert.notEqual(f.editor.drafts.value[0].resolved, true)
  assert.deepEqual([...f.editor.drafts.value[0].permissions], ['read'])
  assert.equal(f.events.includes('changed'), false)
})

test('visible targets restore source bindings without a write; owner stays checked and unselected targets stay unknown', async () => {
  const f = fixture()
  await flush()
  f.setDetails([{ targetId: 'A', relation: 'owner', grantedPermissions: ['read'] }])
  await f.editor.resolveTargets(['A', 'B'])
  assert.deepEqual([...f.editor.ids.value], ['A'])
  assert.equal(f.editor.known.value.has('B'), true)
  assert.equal(f.editor.known.value.has('C'), false)
  assert.equal(f.editor.dirty.value, false)
  await f.editor.save()
  assert.equal(f.calls.filter((call) => !call.url.includes('target/_query')).length, 0)
  await f.editor.select([])
  assert.deepEqual([...f.editor.ids.value], ['A'])
  assert.equal(f.editor.dirty.value, false)
  assert.equal(f.editor.selectorOptions.value.find((row) => row.value === 'A').disabled, true)
  f.scope.stop()
})

test('unchecking an existing binding stages only that removal and can be undone before confirmation', async () => {
  const f = fixture()
  await flush()
  f.setDetails([{ targetId: 'A', relation: 'operator', grantedPermissions: ['read'] }])
  await f.editor.resolveTargets(['A'])
  await f.editor.select([])
  assert.equal(f.editor.changes.value.removed.length, 1)
  assert.equal(
    f.calls.some((call) => call.url.includes('unbind')),
    false
  )
  f.editor.undo(f.editor.drafts.value[0])
  assert.deepEqual([...f.editor.ids.value], ['A'])
  assert.equal(f.editor.dirty.value, false)
  await f.editor.select([])
  await f.editor.save()
  const writes = f.calls.filter((call) => !call.url.includes('target/_query'))
  assert.equal(writes.length, 1)
  assert.equal(writes[0].url, '/assets/unbind/testAsset')
  assert.deepEqual(writes[0].data[0].targetId, 'A')
  assert.equal(f.editor.drafts.value.length, 0)
  f.scope.stop()
})

test('visible binding reads use bounded batches and newly saved targets are reported for source revalidation', async () => {
  const f = fixture()
  await flush()
  await f.editor.resolveTargets(Array.from({ length: 125 }, (_, index) => `T${index}`))
  const reads = f.calls.filter((call) => call.url.includes('target/_query'))
  assert.deepEqual(
    reads.map((call) => call.data.length),
    [50, 50, 25]
  )
  assert.equal(f.editor.drafts.value.length, 0)
  await f.editor.select(['A'])
  await f.editor.save()
  assert.deepEqual(f.deltas, [{ added: ['A'] }])
  f.scope.stop()
})

const inverse = (f) => {
  f.context.value = {
    subject: { typeId: 'division', id: 'G', name: 'Division', data: { id: 'G' } },
    relation: { id: 'asset-binding', name: 'Assigned assets', targetType: 'machine' },
    maintenance: { ...declaration, dimensionType: 'division' },
    reverse: true
  }
}
const linked = (id, role, permissions = []) => ({
  id,
  name: `Machine ${id}`,
  assetId: `asset-${id}`,
  $metadata: {
    relations: [
      {
        relationId: 'asset-binding',
        related: { type: 'division', id: 'G' },
        reverse: false,
        attributes: { relation: role, permissions }
      }
    ]
  }
})

test('new bindings default to required read in both directions and explicit edits cannot remove it', async () => {
  for (const reverse of [false, true]) {
    const f = fixture()
    if (reverse) {
      inverse(f)
      f.setObjects([linked('A')])
    }
    await flush()
    await f.editor.select(['A'])
    const row = f.editor.drafts.value[0]
    assert.deepEqual([...row.permissions], ['read'])
    f.editor.setPermissions(row, ['save', 'save'])
    assert.deepEqual([...row.permissions], ['read', 'save'])
    f.editor.setPermissions(row, [])
    assert.deepEqual([...row.permissions], ['read'])
    assert.equal(
      f.calls.some((call) => call.url === '/assets/bind/testAsset'),
      false
    )
    await f.editor.save()
    const binding = f.calls.find((call) => call.url === '/assets/bind/testAsset').data[0]
    assert.deepEqual(binding.permission, ['read'])
    assert.equal(binding.targetId, reverse ? 'G' : 'A')
    assert.deepEqual(binding.assetIdList, [reverse ? 'asset-A' : 'mapped-D'])
    f.scope.stop()
  }
})

test('sources without declared read or permission editing receive no invented default permission', async () => {
  for (const settings of [
    { multiple: true, permissionSupported: true, permissions: [{ id: 'inspect', name: 'Read' }] },
    { multiple: true, permissionSupported: false, permissions: [{ id: 'read', name: 'Read' }] }
  ]) {
    const f = fixture(settings)
    await flush()
    await f.editor.select(['A'])
    const row = f.editor.drafts.value[0]
    assert.deepEqual([...row.permissions], [])
    f.editor.setPermissions(row, ['inspect'])
    await f.editor.save()
    const binding = f.calls.find((call) => call.url === '/assets/bind/testAsset').data[0]
    assert.deepEqual(binding.permission, settings.permissionSupported ? ['inspect'] : [])
    f.scope.stop()
  }
})

test('loading legacy grants or adding another target never silently grants read to existing bindings', async () => {
  const f = fixture()
  await flush()
  f.setDetails([
    { targetId: 'A', relation: 'operator', grantedPermissions: [] },
    { targetId: 'B', relation: 'owner', grantedPermissions: ['read', 'save'] }
  ])
  await f.editor.resolveTargets(['A', 'B', 'C'])
  const [legacy, owner] = f.editor.drafts.value
  assert.deepEqual([...legacy.permissions], [])
  assert.equal(f.editor.dirty.value, false)
  await f.editor.select(['A', 'B', 'C'])
  await f.editor.save()
  assert.equal(f.calls.filter((call) => call.method === 'put').length, 0)
  assert.deepEqual(
    f.calls.find((call) => call.url === '/assets/bind/testAsset').data.map((row) => row.targetId),
    ['C']
  )
  f.editor.setPermissions(owner, [])
  assert.deepEqual([...owner.permissions], ['read', 'save'])
  f.editor.setPermissions(legacy, ['save'])
  assert.deepEqual([...legacy.permissions], ['read', 'save'])
  f.editor.undo(legacy)
  assert.deepEqual([...legacy.permissions], [])
  assert.equal(f.editor.dirty.value, false)
  f.editor.setPermissions(legacy, [])
  assert.equal(f.calls.filter((call) => call.method === 'put').length, 0)
  await f.editor.save()
  assert.deepEqual(
    f.calls.filter((call) => call.method === 'put').map((call) => [call.url, call.data]),
    [['/assets/permission/testAsset/mapped-D/org/A', ['read']]]
  )
  f.scope.stop()
})

test('explicit permission copying includes read while protecting owner and pending removals', async () => {
  const f = fixture()
  await flush()
  f.setDetails([
    { targetId: 'A', relation: 'operator', grantedPermissions: [] },
    { targetId: 'B', relation: 'owner', grantedPermissions: ['read', 'save'] },
    { targetId: 'C', grantedPermissions: ['save'] }
  ])
  await f.editor.select(['A', 'B', 'C', 'D'])
  const [source, owner, removed, target] = f.editor.drafts.value
  f.editor.remove(removed)
  f.editor.applyPermissions(source)
  assert.deepEqual([...source.permissions], ['read'])
  assert.deepEqual([...target.permissions], ['read'])
  assert.deepEqual([...owner.permissions], ['read', 'save'])
  assert.deepEqual([...removed.permissions], ['save'])
  assert.equal(
    f.calls.some((call) => call.method === 'put' || call.url === '/assets/bind/testAsset'),
    false
  )
  f.scope.stop()
})

test('inverse maintenance keeps one canonical binding, mapped asset identities and zero-permission roles', async () => {
  const f = fixture({ multiple: false, permissionSupported: true, permissions: [] })
  inverse(f)
  f.setObjects(['A', 'B', 'C'].map((id) => linked(id)))
  f.setRelated([linked('A', 'operator'), linked('B', 'owner', ['read'])])
  await flush()
  await f.editor.resolveTargets(['A', 'B', 'C'])
  assert.equal(f.editor.multiple.value, true, 'per-asset dimension cardinality does not constrain inverse asset count')
  assert.equal(f.editor.known.value.get('A').relation, 'operator')
  assert.equal(f.editor.known.value.has('C'), true)
  assert.equal(f.editor.known.value.get('C'), undefined)
  await f.editor.select(['A', 'B', 'C'])
  f.editor.drafts.value.find((row) => row.id === 'A').permissions = ['save']
  await f.editor.save()
  const bind = f.calls.find((row) => row.url === '/assets/bind/testAsset')
  assert.deepEqual(bind.data, [
    {
      assetType: 'testAsset',
      assetIdList: ['asset-C'],
      targetType: 'division',
      targetId: 'G',
      permission: [],
      allPermission: false
    }
  ])
  assert.deepEqual(
    f.calls.filter((row) => row.method === 'put').map((row) => row.url),
    ['/assets/permission/testAsset/asset-A/division/G']
  )
  assert.deepEqual(f.deltas, [{ added: ['C'] }], 'refresh identifiers remain object identities')
  f.scope.stop()
})

test('inverse removal affects only the explicit asset and preserves unloaded bindings and owner', async () => {
  const f = fixture()
  inverse(f)
  f.setObjects([linked('A'), linked('B')])
  f.setRelated([linked('A', 'operator'), linked('B', 'owner')])
  await flush()
  await f.editor.resolveTargets(['A', 'B'])
  await f.editor.select([])
  assert.deepEqual([...f.editor.ids.value], ['B'])
  await f.editor.save()
  const unbind = f.calls.find((row) => row.url.includes('/assets/unbind/'))
  assert.deepEqual(unbind.data, [
    { assetType: 'testAsset', assetIdList: ['asset-A'], targetType: 'division', targetId: 'G' }
  ])
  f.scope.stop()
})

test('inverse reads fail closed for denied objects or missing relation semantics', async () => {
  const f = fixture()
  inverse(f)
  await flush()
  f.denyDetails(true)
  await f.editor.select(['A'])
  await f.editor.save()
  assert.match(f.editor.error.value, /denied/)
  assert.equal(
    f.calls.some((row) => row.url.startsWith('/assets/bind/')),
    false
  )
  f.denyDetails(false)
  f.setObjects([linked('A')])
  f.setRelated([{ id: 'A', name: 'Missing semantics' }])
  await f.editor.retry()
  assert.match(f.editor.error.value, /semantics unavailable/)
  f.setRelated([linked('A', 'operator')])
  await f.editor.retry()
  assert.equal(f.editor.error.value, '')
  assert.equal(f.editor.dirty.value, false, 'retry restores real zero-permission binding instead of creating it')
  f.scope.stop()
})

test('relation candidates page the registered object source and query all direct associations on review', async () => {
  const f = fixture()
  inverse(f)
  const rows = Array.from({ length: 125 }, (_, i) => linked(String(i)))
  f.setObjects(rows)
  f.setRelated(rows.slice(0, 75))
  const input = vue.ref({ context: f.context.value, selectedOnly: false, reviewValues: ['120'] })
  const batches = []
  const picker = f.candidates(
    () => input.value,
    (values) => batches.push(values)
  )
  await flush()
  assert.equal(picker.rows.value.length, 50)
  await picker.load()
  assert.equal(picker.rows.value.length, 100)
  assert.deepEqual(
    batches.map((batch) => batch.length),
    [50, 50]
  )
  await picker.load()
  assert.equal(picker.hasMore.value, false)
  input.value.selectedOnly = true
  await flush()
  assert.equal(picker.rows.value.length, 51, 'review includes a pending object and a bounded source page')
  await picker.load()
  assert.equal(picker.rows.value.length, 76, 'unvisited existing associations are loaded from source')
  await picker.search('Machine 7')
  assert.equal(picker.rows.value.length, 6)
  const query = f.calls.filter((row) => row.url === '/relation/objects/related/_query').at(-1).data
  assert.deepEqual(query.subject, { type: 'division', id: 'G' })
  assert.equal(query.relatedType, 'machine')
  assert.equal(query.reverse, true)
  assert.equal(query.query.pageSize, 50)
  f.scope.stop()
})

test('maintenance direction is opt-in and duplicate providers cannot widen it', () => {
  const f = fixture()
  const provider = { component: {}, directions: ['forward', 'reverse'] }
  f.setProviders(new Map([['one', { objectRelationMaintainers: { 'asset:org': provider } }]]))
  assert.equal(f.resolveMaintainer(declaration, true), provider)
  delete provider.directions
  assert.equal(f.resolveMaintainer(declaration, true), undefined)
  assert.equal(f.resolveMaintainer(declaration), provider)
  f.setProviders(
    new Map([
      ['one', { objectRelationMaintainers: { 'asset:org': provider } }],
      ['two', { objectRelationMaintainers: { 'asset:org': provider } }]
    ])
  )
  assert.equal(f.resolveMaintainer(declaration), undefined)
  f.scope.stop()
})

test('a delayed candidate search cannot overwrite newer search results', async () => {
  const f = fixture()
  inverse(f)
  f.setObjects([linked('A'), linked('B')])
  const input = vue.ref({ context: f.context.value })
  const picker = f.candidates(
    () => input.value,
    () => {}
  )
  await flush()
  let release
  f.delayDetails(
    new Promise((resolve) => {
      release = resolve
    })
  )
  const old = picker.search('Machine A')
  f.delayDetails(undefined)
  await picker.search('Machine B')
  release()
  await old
  assert.deepEqual(
    picker.rows.value.map((row) => row.id),
    ['B']
  )
  assert.equal(picker.loading.value, false)
  f.scope.stop()
})
