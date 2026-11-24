import { Observable } from 'rxjs'
import { wsClient } from '@jetlinks-web/core'

export interface SocketSubscriptionError { requestId?: string; message?: string }
const errors = new Map<string, (cause: Error) => void>()

/** 由平台客户端的公开 onError 回调分发；单项失败交给所属订阅，不影响同连接的其他功能。 */
export function dispatchSocketSubscriptionError(message: SocketSubscriptionError): boolean {
  const fail = message.requestId && errors.get(message.requestId)
  if (!fail) return false
  fail(new Error(message.message || 'WebSocket subscription failed'))
  return true
}

/** 复用平台单例连接与重连重放，只补齐公开错误回调到 Observable 的生命周期。 */
export function subscribeSocketTopic<T>(id: string, topic: string, parameter: Record<string, unknown>): Observable<T> {
  return new Observable(observer => {
    errors.set(id, cause => observer.error(cause))
    const subscription = wsClient.getWebSocket(id, topic, parameter).subscribe({
      next: message => observer.next(message.payload as T),
      error: cause => observer.error(cause),
      complete: () => observer.complete(),
    })
    return () => { errors.delete(id); subscription.unsubscribe() }
  })
}
