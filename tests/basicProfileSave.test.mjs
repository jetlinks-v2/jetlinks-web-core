import assert from 'node:assert/strict'
import test from 'node:test'
import { reactive } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'

function profile({ write = async () => ({ success: true }), read = async () => {} } = {}) {
  const writes = [], notices = []
  const user = reactive({ userInfo: { name: 'Saved', avatar: 'old.png' }, isSubAccount: false,
    setUserInfo(value) { this.userInfo = value }, getUserInfo: read,
  })
  const { useBasicProfile } = createDashboardLoader({
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@jetlinks-web/utils': { onlyMessage: (...notice) => notices.push(notice) },
    '@jetlinks-web-core/store/user': { useUserStore: () => user },
    '@jetlinks-web-core/api/account/center': { updateMeInfo_api: async patch => { writes.push(patch); return write() } },
  })('views/account/center/components/useBasicProfile.ts')
  return { state: useBasicProfile(() => ({ canEdit: true, items: [] })), user, writes, notices }
}

test('a confirmed name or avatar write establishes its baseline even if refreshing fails', async () => {
  for (const [method, field, value] of [['saveName', 'name', 'New name'], ['saveAvatar', 'avatar', 'new.png']]) {
    const view = profile({ read: async () => { throw new Error('offline') } })
    assert.equal(await view.state[method](value), true)
    assert.equal(view.user.userInfo[field], value)
    assert.equal(view.state.saveError.value, false)
    assert.deepEqual(view.notices, [['PersonalCenter.savedRefreshFailed', 'warning']])
    assert.equal(await view.state[method](value), true)
    assert.equal(view.writes.length, 1)
  }
})

test('a failed write retains the saved baseline and does not perform a refresh', async () => {
  let reads = 0
  const view = profile({ write: async () => ({ success: false }), read: async () => { reads++ } })
  assert.equal(await view.state.saveName('Rejected'), false)
  assert.equal(view.user.userInfo.name, 'Saved')
  assert.equal(view.state.saveError.value, true)
  assert.equal(reads, 0)
})

test('profile writes remain serialized across name and avatar operations', async () => {
  let finish
  const view = profile({ write: () => new Promise(resolve => { finish = resolve }) })
  const first = view.state.saveName('New')
  assert.equal(await view.state.saveAvatar('new.png'), false)
  finish({ success: true }); assert.equal(await first, true)
  assert.equal(view.writes.length, 1)
  assert.equal(view.state.saving.value, false)
})
