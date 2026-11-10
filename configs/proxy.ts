import type { ClientRequest, IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import type { ProxyOptions } from 'vite'

/** 将握手和升级后的连接作为一对资源回收，避免页面重载留下上游连接。 */
function bindWebSocketLifecycle(proxyReq: ClientRequest, socket: Socket): void {
  let upstreamSocket: Socket | undefined

  // 仅移除本配置的监听器，保留代理和 Vite 自带的错误处理与日志。
  const releaseListeners = () => {
    socket.off('close', onDownstreamClose)
    socket.off('end', onError)
    socket.off('error', onError)
    proxyReq.off('error', onError)
    upstreamSocket?.off('close', onUpstreamClose)
    upstreamSocket?.off('error', onError)
  }

  // destroy 本身幂等；握手尚未升级时也必须销毁 ClientRequest。
  const onDownstreamClose = () => {
    releaseListeners()
    proxyReq.destroy()
    upstreamSocket?.destroy()
  }

  const onError = () => {
    onDownstreamClose()
    socket.destroy()
  }

  // 正常关闭先刷新已转发的 WebSocket close 帧，避免被误报为异常断线。
  const onUpstreamClose = () => {
    releaseListeners()
    socket.destroySoon()
  }

  const onRequestClose = () => {
    // 保留到请求真正关闭，确保握手期间取消也能移除尚未触发的 upgrade 监听。
    proxyReq.off('upgrade', onUpgrade)
    if (!upstreamSocket) {
      // 非 101 响应由代理转发；请求结束后同样关闭下游并刷新待发送正文。
      releaseListeners()
      socket.destroySoon()
    }
  }

  const onUpgrade = (_response: IncomingMessage, peer: Socket) => {
    upstreamSocket = peer
    // 下游关闭与升级可能相邻发生，迟到的 socket 不能逃过回收。
    if (socket.destroyed) {
      peer.destroy()
      releaseListeners()
      return
    }
    peer.once('close', onUpstreamClose)
    peer.once('error', onError)
  }

  socket.once('close', onDownstreamClose)
  // HTTP upgrade socket 允许半关闭；页面断开可能只触发 end，不会触发 close。
  socket.once('end', onError)
  socket.once('error', onError)
  proxyReq.once('error', onError)
  proxyReq.once('close', onRequestClose)
  proxyReq.once('upgrade', onUpgrade)

  if (socket.destroyed) onDownstreamClose()
}

/** 补齐开发代理的异常断线传播，不改变正常响应、流式传输或业务重连策略。 */
export const configureProxyLifecycle: NonNullable<ProxyOptions['configure']> = (proxy) => {
  proxy.on('proxyReqWs', (proxyReq, _request, socket) => {
    bindWebSocketLifecycle(proxyReq, socket)
  })

  proxy.on('proxyRes', (proxyRes, _request, response) => {
    // 响应头发出后不能另写错误响应；销毁下游才能报告正文截断并释放连接池。
    const onClose = () => {
      if (!proxyRes.complete) response.destroy()
      proxyRes.off('error', onError)
    }
    const onError = () => response.destroy()

    proxyRes.once('error', onError)
    proxyRes.once('close', onClose)
  })
}
