import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { transform } from 'esbuild'
import { createLogger, createServer } from 'vite'

// 只转译被测配置，HTTP、TCP、WebSocket 和 Vite 均使用真实实现。
const source = await readFile(new URL('../configs/proxy.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'node22' })
const { configureProxyLifecycle } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

/** 等待可观测的连接状态，超时只属于测试，不给被测代理增加超时。 */
async function waitFor(predicate, message) {
  const deadline = Date.now() + 1500
  while (!predicate()) {
    assert.ok(Date.now() < deadline, message)
    await delay(10)
  }
}

/** 本地最小 WebSocket echo 对端：处理测试使用的短文本帧与正常 close 帧。 */
function acceptWebSocket(request, socket) {
  const accept = createHash('sha1')
    .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64')
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
  let pending = Buffer.alloc(0)
  socket.on('data', chunk => {
    pending = Buffer.concat([pending, chunk])
    while (pending.length >= 6) {
      const length = pending[1] & 0x7f
      assert.ok(length < 126, 'fixture only accepts short frames')
      if (pending.length < 6 + length) return
      const opcode = pending[0] & 0x0f
      const payload = Buffer.from(pending.subarray(6, 6 + length))
      for (let i = 0; i < length; i += 1) payload[i] ^= pending[2 + (i % 4)]
      pending = pending.subarray(6 + length)
      const frame = Buffer.concat([Buffer.from([0x80 | opcode, length]), payload])
      if (opcode === 8) socket.end(frame)
      else socket.write(frame)
    }
  })
}

/** 每例独立创建真实 Vite 代理和上游，失败时也回收全部测试 socket。 */
async function fixture(t, handlers = {}) {
  const upstreamSockets = new Set()
  const downstreamSockets = new Set()
  const clients = new Set()
  const upgrades = []
  const errors = []
  const upstream = http.createServer(handlers.request || ((_request, response) => response.end('ok')))
  upstream.on('connection', socket => {
    upstreamSockets.add(socket)
    socket.on('error', () => {})
    socket.once('close', () => upstreamSockets.delete(socket))
  })
  upstream.on('upgrade', (request, socket, head) => {
    upgrades.push(socket)
    handlers.upgrade?.(request, socket, head)
    // 对端读入 FIN 并正常结束写端，避免把测试服务自身的半关闭算作代理泄漏。
    socket.once('end', () => socket.end())
    socket.resume()
  })
  let vite
  t.after(async () => {
    for (const client of clients) client.destroy()
    for (const socket of downstreamSockets) socket.destroy()
    for (const socket of upstreamSockets) socket.destroy()
    await vite?.close()
    await new Promise(resolve => upstream.close(resolve))
  })
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  const logger = createLogger('silent')
  logger.error = message => errors.push(message)
  vite = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    envFile: false,
    customLogger: logger,
    server: {
      host: '127.0.0.1', port: 0, hmr: false, watch: null,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${upstream.address().port}`,
          changeOrigin: true,
          ws: true,
          rewrite: path => path.replace(/^\/api/, ''),
          configure: configureProxyLifecycle,
        },
      },
    },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  vite.httpServer.on('connection', socket => {
    downstreamSockets.add(socket)
    socket.once('close', () => downstreamSockets.delete(socket))
  })
  await vite.listen()
  const port = vite.httpServer.address().port

  const openHttp = (path, agent = false) => {
    const request = http.get({ host: '127.0.0.1', port, path, agent })
    clients.add(request)
    request.once('close', () => clients.delete(request))
    const response = once(request, 'response').then(([value]) => value)
    // 同时注册完成与异常监听，避免读取响应前已经发生 reset 而漏掉事件。
    const completed = response.then(res => new Promise(resolve => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      const finish = event => resolve({ event, status: res.statusCode, body: Buffer.concat(chunks).toString() })
      res.once('end', () => finish('end'))
      res.once('aborted', () => finish('aborted'))
      res.once('error', () => finish('error'))
    }), error => ({ event: 'request-error', code: error.code }))
    return { request, response, completed }
  }

  const openRawWebSocket = path => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(`GET /api/${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`)
    })
    clients.add(socket)
    socket.on('error', () => {})
    socket.once('close', () => clients.delete(socket))
    socket.resume()
    return socket
  }

  const openWebSocket = async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/socket`)
    t.after(() => { if (socket.readyState < WebSocket.CLOSING) socket.close() })
    await once(socket, 'open')
    return socket
  }

  return { upstreamSockets, downstreamSockets, upgrades, errors, openHttp, openRawWebSocket, openWebSocket }
}

test('normal HTTP responses retain status, headers and body', { timeout: 5000 }, async t => {
  const f = await fixture(t, { request: (_request, response) => {
    response.writeHead(201, { 'X-Proxy-Fixture': 'retained' })
    response.end('complete body')
  } })
  const pending = f.openHttp('/api/normal')
  const response = await pending.response
  assert.equal(response.headers['x-proxy-fixture'], 'retained')
  assert.deepEqual(await pending.completed, { event: 'end', status: 201, body: 'complete body' })
})

test('cancelling 12 pending WebSocket handshakes releases all upstream sockets', { timeout: 10000 }, async t => {
  const f = await fixture(t)
  for (let i = 0; i < 12; i += 1) {
    const socket = f.openRawWebSocket('waiting')
    await waitFor(() => f.upgrades.length === i + 1, 'upstream must receive the handshake')
    socket.destroy()
    await waitFor(() => f.upstreamSockets.size === 0, 'cancelled handshake leaked its upstream socket')
  }
  assert.equal((await f.openHttp('/api/normal').completed).event, 'end')
})

test('cancelling an established WebSocket closes the upstream peer', { timeout: 5000 }, async t => {
  const f = await fixture(t, { upgrade: acceptWebSocket })
  const socket = f.openRawWebSocket('socket')
  await once(socket, 'data')
  socket.destroy()
  await waitFor(() => f.upstreamSockets.size === 0, 'established peer leaked after downstream cancellation')
})

for (const established of [false, true]) {
  test(`downstream TCP reset ${established ? 'after upgrade' : 'during handshake'} releases the upstream`, { timeout: 5000 }, async t => {
    const f = await fixture(t, { upgrade: established ? acceptWebSocket : undefined })
    const socket = f.openRawWebSocket('socket')
    if (established) await once(socket, 'data')
    else await waitFor(() => f.upgrades.length === 1, 'upstream must receive the handshake')
    socket.resetAndDestroy()
    await waitFor(() => f.upstreamSockets.size === 0, 'reset left an upstream socket')
    assert.ok(f.errors.some(error => error.includes('ws proxy socket error')))
    assert.equal((await f.openHttp('/api/normal').completed).status, 200)
  })
}

test('normal WebSocket messages and close handshake remain intact', { timeout: 5000 }, async t => {
  const f = await fixture(t, { upgrade: acceptWebSocket })
  const socket = await f.openWebSocket()
  const message = once(socket, 'message')
  socket.send('hello through proxy')
  assert.equal((await message)[0].data, 'hello through proxy')
  const closed = once(socket, 'close')
  socket.close(1000, 'finished')
  const [event] = await closed
  assert.equal(event.code, 1000)
  assert.equal(event.reason, 'finished')
  await waitFor(() => f.upstreamSockets.size === 0, 'normal close must release the upstream socket')
})

test('repeated upstream WebSocket resets keep errors visible and HTTP usable', { timeout: 10000 }, async t => {
  const f = await fixture(t, { upgrade: acceptWebSocket })
  for (let i = 0; i < 12; i += 1) {
    const socket = await f.openWebSocket()
    const closed = once(socket, 'close')
    f.upgrades[i].resetAndDestroy()
    assert.equal((await closed)[0].code, 1006)
    await waitFor(() => f.upstreamSockets.size === 0, 'reset left an upstream socket')
  }
  assert.ok(f.errors.some(error => error.includes('ws proxy error')))
  assert.equal((await f.openHttp('/api/normal').completed).status, 200)
  assert.equal((await f.openHttp('/@vite/client').completed).status, 200)
})

test('a rejected WebSocket handshake retains its HTTP response', { timeout: 5000 }, async t => {
  const f = await fixture(t, { upgrade: (_request, socket) => {
    socket.end('HTTP/1.1 401 Unauthorized\r\nContent-Length: 6\r\nConnection: close\r\n\r\ndenied')
  } })
  const socket = f.openRawWebSocket('rejected')
  const chunks = []
  socket.on('data', chunk => chunks.push(chunk))
  await once(socket, 'close')
  const response = Buffer.concat(chunks).toString()
  assert.match(response, /^HTTP\/1.1 401 Unauthorized/)
  assert.ok(response.endsWith('denied'))
  await waitFor(() => f.upstreamSockets.size === 0, 'rejected handshake must release the upstream socket')
})

test('partial HTTP response reset promptly aborts the downstream response', { timeout: 5000 }, async t => {
  let upstreamResponse
  const f = await fixture(t, { request: (request, response) => {
    if (request.url === '/normal') {
      response.end('ok')
      return
    }
    upstreamResponse = response
    response.writeHead(200, { 'Content-Length': 100 })
    response.write('part')
  } })
  const pending = f.openHttp('/api/partial')
  await pending.response
  upstreamResponse.socket.resetAndDestroy()
  const result = await pending.completed
  assert.equal(result.event, 'aborted')
  assert.equal(result.body, 'part')
  assert.deepEqual(await f.openHttp('/api/normal').completed, { event: 'end', status: 200, body: 'ok' })
})

test('six interrupted responses release the origin pool for subsequent Vite requests', { timeout: 5000 }, async t => {
  const f = await fixture(t, { request: (_request, response) => {
    response.writeHead(200, { 'Content-Length': 100 })
    response.write('part')
    setTimeout(() => response.socket?.resetAndDestroy(), 20)
  } })
  const agent = new http.Agent({ keepAlive: true, maxSockets: 6 })
  t.after(() => agent.destroy())
  const interrupted = Array.from({ length: 6 }, (_, index) => f.openHttp(`/api/partial-${index}`, agent))
  await Promise.all(interrupted.map(pending => pending.response))
  const client = f.openHttp('/@vite/client', agent)
  const results = await Promise.all(interrupted.map(pending => pending.completed))
  assert.ok(results.every(result => result.event === 'aborted'))
  const result = await client.completed
  assert.equal(result.event, 'end')
  assert.equal(result.status, 200)
  assert.ok(result.body.includes('WebSocket'))
})

for (const contentType of ['text/event-stream', 'application/x-ndjson']) {
  test(`healthy ${contentType} streams remain open until the upstream ends`, { timeout: 5000 }, async t => {
    let upstreamResponse
    const f = await fixture(t, { request: (_request, response) => {
      upstreamResponse = response
      response.writeHead(200, { 'Content-Type': contentType })
      response.write('first\n')
    } })
    const pending = f.openHttp('/api/stream')
    const response = await pending.response
    await delay(40)
    assert.equal(response.destroyed, false)
    const secondChunk = once(response, 'data')
    upstreamResponse.write('second\n')
    await secondChunk
    upstreamResponse.end('last\n')
    assert.deepEqual(await pending.completed, { event: 'end', status: 200, body: 'first\nsecond\nlast\n' })
  })
}

test('cancelling a streaming HTTP response releases its upstream connection', { timeout: 5000 }, async t => {
  const f = await fixture(t, { request: (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
    response.write('first\n')
  } })
  const pending = f.openHttp('/api/stream')
  const response = await pending.response
  response.destroy()
  await waitFor(() => f.upstreamSockets.size === 0, 'cancelled HTTP stream leaked its upstream socket')
})
