import { parseJsonWithPrecision } from './index'

interface SocketMessage {
  type: string
  requestId?: string
  payload?: unknown
  [key: string]: unknown
}

/** 仅采集点位的结果消息启用无损解析，保留其他订阅的数值类型。 */
export const deserializeCollectorMessage = (event: MessageEvent<string>): SocketMessage => {
  const message: SocketMessage = JSON.parse(event.data)
  if (message.type === 'result' && /^collector-.+-.+-data-/.test(message.requestId ?? '')) {
    return parseJsonWithPrecision(event.data) as SocketMessage
  }
  return message
}
