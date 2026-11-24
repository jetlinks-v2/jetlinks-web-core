import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { createComponentLoader } from './helpers/componentRuntime.mjs'

test('真实共享客户端复用连接，重连只恢复有效订阅，单项失败和取消互不影响', () => {
  const require = createRequire(import.meta.url)
  const path = resolve(dirname(require.resolve('@jetlinks-web/core/package.json')), 'src/websocket.ts')
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const sockets = [], timers = new Map()
  let sequence = 0
  class Socket {
    readyState = 0
    sent = []
    constructor() { sockets.push(this) }
    open() { this.readyState = 1; this.onopen?.({}) }
    send(text) { this.sent.push(JSON.parse(text)) }
    receive(message) { this.onmessage?.({ data: JSON.stringify(message) }) }
    close() { this.readyState = 3; this.onclose?.({ wasClean: true, code: 1000 }) }
    drop() { this.readyState = 3; this.onclose?.({ wasClean: false, code: 1006 }) }
  }
  const original = globalThis.WebSocket
  globalThis.WebSocket = Socket
  let client
  try {
    const module = { exports: {} }
    vm.runInNewContext(source, { module, exports: module.exports,
      require: id => id === 'ant-design-vue' ? { notification: { error: () => assert.fail('error must reach its subscriber') } } : require(id),
      console: { log() {}, error() {} }, Date,
      window: { navigator: { onLine: true }, addEventListener() {},
        setTimeout(callback) { const id = ++sequence; timers.set(id, callback); return id }, clearTimeout(id) { timers.delete(id) } },
    }, { filename: path })
    client = module.exports.wsClient
    const { subscribeSocketTopic, dispatchSocketSubscriptionError } = createComponentLoader({ '@jetlinks-web/core': { wsClient: client } })('utils/websocket-subscriptions.ts')
    client.setOptions({ onError: dispatchSocketSubscriptionError }); client.initWebSocket('ws://example.test/messaging'); client.connect()
    const received = [], failures = []
    const a = subscribeSocketTopic('a', '/metric/configs/results', { configId: 'a' }).subscribe(value => received.push(['a', value]))
    const b = subscribeSocketTopic('b', '/metric/configs/results', { configId: 'b' }).subscribe({ next: value => received.push(['b', value]), error: error => failures.push(error.message) })
    assert.equal(sockets.length, 1); sockets[0].open()
    assert.deepEqual(sockets[0].sent.filter(message => message.type === 'sub').map(message => message.id).sort(), ['a', 'b'])
    sockets[0].receive({ type: 'result', requestId: 'a', payload: { kind: 'ready' } })
    a.unsubscribe(); sockets[0].drop()
    assert.equal(timers.size, 1)
    const resume = [...timers.values()][0]; timers.clear(); resume()
    assert.equal(sockets.length, 2); sockets[1].open()
    assert.deepEqual(sockets[1].sent.filter(message => message.type === 'sub').map(message => message.id), ['b'])
    for (const kind of ['reset', 'history', 'ready', 'latest']) sockets[1].receive({ type: 'result', requestId: 'b', payload: { kind } })
    assert.deepEqual(received.map(([id, frame]) => [id, frame.kind]), [['a', 'ready'], ['b', 'reset'], ['b', 'history'], ['b', 'ready'], ['b', 'latest']])
    sockets[1].receive({ type: 'error', requestId: 'b', message: 'Denied' })
    assert.deepEqual(failures, ['Denied']); assert.equal(b.closed, true)
    const c = subscribeSocketTopic('c', '/another/topic', {}).subscribe(value => received.push(['c', value]))
    assert.equal(sockets.length, 2)
    sockets[1].receive({ type: 'result', requestId: 'c', payload: 42 }); assert.deepEqual(received.at(-1), ['c', 42])
    c.unsubscribe()
  } finally { client?.disconnect(); globalThis.WebSocket = original }
})
