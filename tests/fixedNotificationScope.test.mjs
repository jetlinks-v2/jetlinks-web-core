import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const loadEditor = async environment => {
  const { outputFiles } = await build({
    entryPoints: [fileURLToPath(new URL('../src/hooks/useMenuAssetPermissionEditor.ts', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node',
    define: { 'import.meta.env': JSON.stringify({ VITE_APP_ENVIRONMENT: environment }) },
  })
  return (await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)).useMenuAssetPermissionEditor
}
const access = (assetType, supportId, extra) => ({ assetType, supportId, ...extra })
const policy = (assetType, ...ids) => ({ assetType, accesses: ids.map(supportId => ({ supportId })) })
const menu = (assetType, ...ids) => ({ id: assetType, granted: true, assetTypes: [assetType],
  assetAccesses: ids.map(id => access(assetType, id, { name: id.toUpperCase() })) })

for (const [environment, expected, previous] of [['saas', 'tenant', 'ignore'], ['cloud', 'tenant', 'all'], ['', 'ignore', 'tenant']]) {
  test(`${environment || 'private'} locks notification scopes, excludes them from batch, and reloads the same payload`, async () => {
    const useEditor = await loadEditor(environment)
    const editor = useEditor()
    const menus = [menu('notifyConfig', 'tenant', 'ignore', 'all', 'org'), menu('notifyTemplate', 'tenant', 'ignore', 'all', 'org'), menu('device', 'org', 'creator')]
    const assetAccesses = [policy('notifyConfig', previous), policy('notifyTemplate', previous, 'org')]
    const before = structuredClone({ menus, assetAccesses })
    editor.reset({ menus, assetAccesses })
    const fixed = () => editor.visibleAssets.value.filter(row => row.fixedScope)
    assert.deepEqual(fixed().map(row => row.selectedSupportId), [expected, expected])
    assert.ok(fixed().every(row => row.accesses.length === 1 && row.accesses[0].disabled))
    assert.deepEqual(fixed().map(row => row.previousScopeLabels), [[previous.toUpperCase()], [previous.toUpperCase(), 'ORG']])
    assert.deepEqual(editor.batchAssetOptions.value.map(option => option.value), ['org', 'creator'])
    editor.setAssetAccess('notifyConfig', previous)
    editor.applyAssetBatch('org')
    const snapshot = editor.getGrantSnapshot()
    assert.deepEqual(snapshot.assetAccesses, [policy('notifyConfig', expected), policy('notifyTemplate', expected), policy('device', 'org')])
    for (const item of snapshot.menus.slice(0, 2)) {
      assert.deepEqual(item.assetAccesses, [access(item.id, expected, { granted: true })])
    }
    assert.deepEqual({ menus, assetAccesses }, before)
    editor.reset({ menus, grantedMenus: snapshot.menus, assetAccesses: snapshot.assetAccesses })
    assert.ok(fixed().every(row => !row.previousScopeLabels))
    assert.deepEqual(editor.getGrantSnapshot(), snapshot)
  })
}

test('private deployment never treats a historical all as a grantable candidate, and permits revocation', async () => {
  const useEditor = await loadEditor('')
  const editor = useEditor()
  const menus = [menu('notifyConfig', 'tenant'), menu('user', 'org')]
  const grantedMenus = [menu('notifyConfig', 'all'), menus[1]]
  editor.reset({ menus, grantedMenus, assetAccesses: [policy('notifyConfig', 'all')] })
  assert.equal(editor.visibleAssets.value[0].selectedSupportId, undefined)
  assert.equal(editor.getGrantSnapshot(), undefined)
  editor.toggleMenu(editor.flatMenus.value[0], false)
  assert.deepEqual(editor.getGrantSnapshot().assetAccesses, [policy('user', 'org')])
})

test('explicit limits and disabled scopes do not elevate; SaaS preserves a valid server alias', async () => {
  const useEditor = await loadEditor('saas')
  const editor = useEditor()
  const menus = [menu('notifyConfig', 'tenant', 'tenant_member', 'all')]
  const assetAccesses = [policy('notifyConfig', 'tenant_member')]
  const fixedAssetGrantable = [{ assetType: 'notifyConfig', accesses: [
    access('notifyConfig', 'tenant', { disabled: true }), access('notifyConfig', 'tenant_member'),
  ] }]
  editor.reset({ menus, fixedAssetGrantable, assetAccesses })
  assert.deepEqual(editor.getGrantSnapshot().assetAccesses, assetAccesses)
  assert.equal(editor.getGrantSnapshot([]), undefined)
  editor.reset({ menus, fixedAssetGrantable: [], assetAccesses })
  assert.deepEqual(editor.visibleAssets.value[0].accesses, [])
  assert.equal(editor.getGrantSnapshot(), undefined)
  menus[0].assetAccesses[1].disabled = true
  editor.reset({ menus, fixedAssetGrantable, assetAccesses })
  assert.equal(editor.getGrantSnapshot(), undefined)
})


test('private deployment accepts the all alias only when provided by the server', async () => {
  const useEditor = await loadEditor('')
  const editor = useEditor()
  editor.reset({ menus: [menu('notifyTemplate', 'all')] })
  assert.deepEqual(editor.getGrantSnapshot().assetAccesses, [policy('notifyTemplate', 'all')])
  editor.reset({ menus: [menu('notifyTemplate', 'tenant')], assetAccesses: [policy('notifyTemplate', 'ignore')] })
  assert.equal(editor.getGrantSnapshot(), undefined)
})

for (const [environment, expected] of [['', 'ignore'], ['saas', 'tenant']]) {
  test(`${environment || 'private'} global role selects its deployment scope on first grant and upgrades legacy values on save`, async () => {
    const useEditor = await loadEditor(environment)
    const editor = useEditor({ notificationScopeMode: 'deployment' })
    const menus = [{ ...menu('notifyConfig'), granted: false }, menu('notifyTemplate', 'creator')]
    const assetAccesses = [policy('notifyTemplate', 'creator')]
    editor.reset({ menus, assetAccesses })
    const draft = () => editor.getGrantSnapshot([])
    assert.deepEqual(draft().assetAccesses, [policy('notifyTemplate', expected)])
    assert.deepEqual(editor.visibleAssets.value[0].previousScopeLabels, ['CREATOR'])
    editor.toggleMenu(editor.flatMenus.value[0], true)
    assert.deepEqual(editor.visibleAssets.value.map(row => [row.selectedSupportId, row.accesses[0].disabled]),
      [[expected, true], [expected, true]])
    const snapshot = draft()
    assert.deepEqual(snapshot.assetAccesses, [policy('notifyConfig', expected), policy('notifyTemplate', expected)])
    assert.deepEqual(snapshot.menus.map(item => item.assetAccesses), snapshot.menus.map(item => [access(item.id, expected, { granted: true })]))
    assert.deepEqual(assetAccesses, [policy('notifyTemplate', 'creator')])
    editor.reset({ menus, grantedMenus: snapshot.menus, assetAccesses: snapshot.assetAccesses })
    assert.deepEqual(draft(), snapshot)
    assert.ok(editor.visibleAssets.value.every(row => !row.previousScopeLabels))
    editor.toggleMenu(editor.flatMenus.value[0], false)
    assert.deepEqual(draft().assetAccesses, [policy('notifyTemplate', expected)])
  })
}

test('deployment mode preserves a supported tenant alias even with a stale grantable directory', async () => {
  const useEditor = await loadEditor('saas')
  const editor = useEditor({ notificationScopeMode: 'deployment' })
  const menus = [menu('notifyConfig', 'tenant_member')]
  editor.reset({ menus, fixedAssetGrantable: [], assetAccesses: [policy('notifyConfig', 'creator')] })
  assert.equal(editor.visibleAssets.value[0].selectedSupportId, 'tenant_member')
  assert.deepEqual(editor.getGrantSnapshot([])?.assetAccesses, [policy('notifyConfig', 'tenant_member')])
})
