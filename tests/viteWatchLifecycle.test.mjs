import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, realpath, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { transform } from 'esbuild'
import { createServer } from 'vite'

const source = await readFile(new URL('../configs/plugin/dedupe-watch.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'node22' })
const { dedupeWatchPlugin } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

async function waitFor(predicate, message) {
  const deadline = Date.now() + 4000
  while (!predicate()) {
    assert.ok(Date.now() < deadline, message)
    await delay(10)
  }
}

// 计数仅用于捕获依赖里的资源累积；生产适配不读取这些私有字段。
const count = (server, file) => server.watcher._closers.get(file)?.length || 0

async function fixture(t, options = {}) {
  const workspace = await realpath(await mkdtemp(path.join(tmpdir(), 'vite-watch-lifecycle-')))
  const root = path.join(workspace, 'core')
  const outside = path.join(workspace, 'modules', 'feature')
  const file = path.join(outside, 'entry.js')
  await mkdir(root, { recursive: true })
  await mkdir(outside, { recursive: true })
  await writeFile(path.join(root, 'index.html'), '<!doctype html><title>watch fixture</title>')
  const content = value => `export const value = ${value}; if (import.meta.hot) import.meta.hot.accept();\n`
  await writeFile(file, content(1))
  const messages = []
  const sockets = new Set()
  let server
  t.after(async () => {
    for (const socket of sockets) socket.close()
    await server?.close()
    await rm(workspace, { recursive: true, force: true })
  })
  server = await createServer({
    root, configFile: false, envFile: false, logLevel: 'silent',
    cacheDir: path.join(workspace, 'cache'),
    plugins: [...(options.before || []), ...(options.enabled === false ? [] : [dedupeWatchPlugin()])],
    server: {
      host: '127.0.0.1', port: 0,
      fs: { allow: [workspace] },
      watch: { atomic: false, ...(options.watchCwd ? { cwd: workspace } : {}), ...options.watch },
    },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  await server.listen()
  const base = () => `http://127.0.0.1:${server.httpServer.address().port}`
  const url = `/@fs/${file}`
  const fetchModule = async () => {
    const response = await fetch(base() + url, { headers: { connection: 'close' }, signal: AbortSignal.timeout(4000) })
    assert.equal(response.status, 200)
    return response.text()
  }
  const change = async (value, target = file) => {
    const changed = new Promise(resolve => {
      const listener = changedFile => {
        const resolved = path.resolve(server.watcher.options.cwd || process.cwd(), changedFile)
        if (resolved !== target) return
        server.watcher.off('change', listener)
        resolve()
      }
      server.watcher.on('change', listener)
    })
    await writeFile(target, content(value))
    await Promise.race([changed, delay(4000).then(() => { throw new Error(`missing change: ${target}`) })])
  }
  const connect = async () => {
    const ws = new WebSocket(`${base().replace('http:', 'ws:')}/?token=${server.config.webSocketToken}`, 'vite-hmr')
    sockets.add(ws)
    ws.addEventListener('message', event => messages.push(JSON.parse(event.data)))
    await once(ws, 'open')
    await waitFor(() => messages.some(message => message.type === 'connected'), 'HMR did not connect')
    return ws
  }
  return { server, workspace, outside, file, content, base, url, fetchModule, change, connect, messages }
}

test('默认 FSEvents 会为重复文件 add 累积回调（反例）', { skip: process.platform !== 'darwin' }, async t => {
  const f = await fixture(t, { enabled: false })
  assert.equal(f.server.watcher.options.useFsEvents, true)
  f.server.watcher.add(f.file)
  await waitFor(() => count(f.server, f.file) === 1, 'initial registration missing')
  for (let i = 0; i < 200; i++) f.server.watcher.add(f.file)
  await waitFor(() => count(f.server, f.file) === 201, 'baseline did not reproduce the leak')
})

test('2,000 次重复注册及相对/绝对路径共用一次文件监听，HMR 和 HTTP 正常', async t => {
  const f = await fixture(t)
  await f.connect()
  assert.match(await f.fetchModule(), /value = 1/)
  await waitFor(() => count(f.server, f.file) > 0, 'initial registration missing')
  const initial = count(f.server, f.file)
  for (let i = 0; i < 2000; i++) {
    f.server.watcher.add([f.file, path.relative(process.cwd(), f.file), path.join(f.outside, '..', 'feature', 'entry.js')])
  }
  await delay(100)
  assert.equal(count(f.server, f.file), initial)
  await f.change(2)
  await waitFor(() => f.messages.some(message => message.type === 'update' && message.updates.some(update => update.path === f.url)), 'external module HMR missing')
  assert.match(await f.fetchModule(), /value = 2/)
  const response = await fetch(f.base() + '/@vite/client', { signal: AbortSignal.timeout(4000) })
  assert.equal(response.status, 200)
  await response.text()
})

test('尚未完成首次异步注册时，同一批及并发调用也不会叠加', async t => {
  const f = await fixture(t)
  const first = f.server.watcher.add([f.file, f.file])
  assert.equal(first, f.server.watcher)
  await Promise.all(Array.from({ length: 100 }, () => Promise.resolve().then(() => f.server.watcher.add(f.file))))
  await waitFor(() => count(f.server, f.file) > 0, 'registration missing')
  await delay(100)
  assert.equal(count(f.server, f.file), 1)
  await f.change(3)
})

test('2,000 个不同外部文件重复加入 5 批后规模稳定，文件事件和 HTTP 仍可用', async t => {
  const f = await fixture(t)
  const files = Array.from({ length: 2000 }, (_, index) => path.join(f.outside, `scale-${index}.js`))
  for (let index = 0; index < files.length; index += 64) {
    await Promise.all(files.slice(index, index + 64).map(file => writeFile(file, f.content(1))))
  }
  f.server.watcher.add(files)
  const total = () => files.reduce((sum, file) => sum + count(f.server, file), 0)
  await waitFor(() => total() === files.length, 'scale registrations missing')
  for (let batch = 0; batch < 5; batch++) f.server.watcher.add(files)
  await delay(100)
  assert.equal(total(), files.length)
  await f.change(2, files[997])
  const response = await fetch(f.base() + '/@vite/client', { signal: AbortSignal.timeout(4000) })
  assert.equal(response.status, 200)
  await response.text()
  await f.server.close()
  assert.equal(f.server.watcher._closers.size, 0)
})

test('删除重建和原子保存后仍有文件事件，监听数量保持稳定', async t => {
  const f = await fixture(t)
  await f.fetchModule()
  await waitFor(() => count(f.server, f.file) > 0, 'registration missing')
  const initial = count(f.server, f.file)
  for (let i = 0; i < 3; i++) {
    await delay(120)
    const removed = once(f.server.watcher, 'unlink')
    await unlink(f.file)
    await removed
    f.server.watcher.add(f.file)
    const added = once(f.server.watcher, 'add')
    await writeFile(f.file, f.content(10 + i))
    await added
    f.server.watcher.add(f.file)
    await delay(100)
    assert.equal(count(f.server, f.file), initial)
    assert.match(await f.fetchModule(), new RegExp(`value = ${10 + i}`))
  }
  const { rename } = await import('node:fs/promises')
  await writeFile(f.file + '.tmp', f.content(20))
  const changed = once(f.server.watcher, 'change')
  await rename(f.file + '.tmp', f.file)
  await changed
  f.server.watcher.add(f.file)
  assert.equal(count(f.server, f.file), initial)
  assert.match(await f.fetchModule(), /value = 20/)
})

test('显式取消文件再加入时回收旧监听并恢复事件', async t => {
  const f = await fixture(t)
  f.server.watcher.add(f.file)
  await waitFor(() => count(f.server, f.file) > 0, 'registration missing')
  assert.equal(f.server.watcher.unwatch(f.file), f.server.watcher)
  assert.equal(count(f.server, f.file), 0)
  f.server.watcher.add(f.file)
  await waitFor(() => count(f.server, f.file) === 1, 're-registration missing')
  await f.change(4)
})

test('目录取消后重新加入能恢复子文件事件，反复操作不会叠加文件监听', async t => {
  const f = await fixture(t)
  const second = path.join(f.outside, 'second.js')
  const sibling = path.join(f.outside + '-sibling.js')
  await writeFile(second, f.content(1))
  await writeFile(sibling, f.content(1))
  f.server.watcher.add([f.file, second, sibling])
  await waitFor(() => [f.file, second, sibling].every(file => count(f.server, file) > 0), 'registrations missing')
  f.server.watcher.unwatch(f.outside)
  // FSEvents 的目录取消仅屏蔽子文件事件，显式子文件注册仍有效。
  const retained = f.server.watcher.options.useFsEvents ? 1 : 0
  assert.equal(count(f.server, f.file), retained)
  assert.equal(count(f.server, second), retained)
  assert.equal(count(f.server, sibling), 1)
  f.server.watcher.add(f.outside)
  await delay(150)
  await f.change(5)
  f.server.watcher.add([f.file, second])
  await waitFor(() => count(f.server, f.file) === 1 && count(f.server, second) === 1, 'child registrations missing')
  await f.change(6, second)
  await f.change(6, sibling)
  for (let i = 0; i < 5; i++) {
    f.server.watcher.unwatch(f.outside)
    f.server.watcher.add(f.outside)
    f.server.watcher.add([f.file, second])
    await delay(100)
    assert.equal(count(f.server, f.file), 1)
    assert.equal(count(f.server, second), 1)
  }
  await f.change(7)
})

test('cwd 路径按 watcher 的配置解析', async t => {
  const f = await fixture(t, { watchCwd: true })
  f.server.watcher.add(path.relative(f.workspace, f.file))
  f.server.watcher.add(f.file)
  await waitFor(() => count(f.server, f.file) > 0, 'registration missing')
  assert.equal(count(f.server, f.file), 1)
  await f.change(6)
  f.server.watcher.emit('error', new Error('unrelated cwd fixture error'))
  f.server.watcher.add(f.file)
  await delay(100)
  assert.equal(count(f.server, f.file), 1)
  f.server.watcher.unwatch(path.relative(f.workspace, f.file))
  assert.equal(count(f.server, f.file), 0)
})

test('缺失文件和否定输入保留原生创建/重新启用行为', async t => {
  const f = await fixture(t)
  const missing = path.join(f.outside, 'new.js')
  f.server.watcher.add(missing)
  await delay(100)
  const added = once(f.server.watcher, 'add')
  await writeFile(missing, f.content(1))
  await added
  f.server.watcher.add(missing)
  await delay(100)
  const initial = count(f.server, missing)
  for (let i = 0; i < 100; i++) f.server.watcher.add(missing)
  await delay(100)
  assert.equal(count(f.server, missing), initial)
  f.server.watcher.add('!' + missing)
  f.server.watcher.add(missing)
  await waitFor(() => count(f.server, missing) === 1, 're-enabled registration missing')
  await f.change(2, missing)
})

test('原生注册同步失败后可重新注册；无关异步错误不清除健康注册', async t => {
  let fail = true
  const f = await fixture(t, { before: [{
    name: 'registration-failure-fixture', enforce: 'pre',
    configureServer({ watcher }) {
      const add = watcher.add
      watcher.add = function (paths, ...rest) {
        if (fail && JSON.stringify(paths).includes('entry.js')) {
          fail = false
          throw new Error('fixture registration failed')
        }
        return Reflect.apply(add, this, [paths, ...rest])
      }
    },
  }] })
  assert.throws(() => f.server.watcher.add(f.file), /fixture registration failed/)
  f.server.watcher.add(f.file)
  await waitFor(() => count(f.server, f.file) === 1, 'retry missing')
  f.server.watcher.emit('error', new Error('unrelated fixture error'))
  f.server.watcher.add(f.file)
  await delay(100)
  assert.equal(count(f.server, f.file), 1)
  await f.change(7)
  const error = Object.assign(new Error('file registration fixture error'), { path: f.file })
  f.server.watcher.emit('error', error)
  if (f.server.watcher.options.useFsEvents) assert.equal(count(f.server, f.file), 0)
  f.server.watcher.add(f.file)
  await waitFor(() => count(f.server, f.file) === 1, 'async retry missing')
  await f.change(8)
})

test('重启后使用全新的注册记录，旧 watcher 的监听全部释放', async t => {
  const f = await fixture(t)
  await f.fetchModule()
  await waitFor(() => count(f.server, f.file) > 0, 'registration missing')
  const old = f.server.watcher
  await f.server.restart()
  assert.notEqual(f.server.watcher, old)
  assert.equal(old._closers.size, 0)
  await f.fetchModule()
  await waitFor(() => count(f.server, f.file) > 0, 'new registration missing')
  for (let i = 0; i < 100; i++) f.server.watcher.add(f.file)
  await delay(100)
  assert.equal(count(f.server, f.file), 1)
  await f.change(8)
})

test('显式启用 glob 或动态忽略函数时保留原生匹配和重新筛选', async t => {
  const glob = await fixture(t, { watch: { disableGlobbing: false } })
  glob.server.watcher.add(path.join(glob.outside, '*.js'))
  await delay(150)
  await glob.change(9)
  let ignore = true
  const dynamic = await fixture(t, { watch: { ignored: file => ignore && file.endsWith('/entry.js') } })
  dynamic.server.watcher.add(dynamic.file)
  await delay(100)
  ignore = false
  dynamic.server.watcher.add(dynamic.file)
  await waitFor(() => count(dynamic.server, dynamic.file) > 0, 'dynamic registration missing')
  await dynamic.change(9)
})
