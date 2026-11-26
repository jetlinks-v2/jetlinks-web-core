import { request } from '@jetlinks-web/core'

export type NotificationRecipientType = 'org' | 'role'
export type NotificationRecipient = { type: NotificationRecipientType; id: string }
export type NotificationRecipientOption = { id: string; name: string }

/** 场景联动与视觉告警共用凭据能力判定，不能仅凭钉钉渠道类型区分机器人和工作通知。 */
export function notificationRecipientCapabilities(config?: { type?: unknown; provider?: unknown }) {
  if (config?.type === 'webhook' || (config?.type === 'dingTalk' && config.provider === 'dingTalkRobotWebHook')) {
    return { fixedRecipient: true }
  }
  if (config?.type === 'weixin' && config.provider === 'corpMessage') return { recipientTypes: ['org', 'role'] as NotificationRecipientType[] }
  if (config?.type === 'dingTalk' && config.provider === 'dingTalkMessage') return { recipientTypes: ['org'] as NotificationRecipientType[] }
  return {}
}

/** 凭据详情不可访问时保留人员模式，单条失败不阻断整个渠道目录。 */
export async function queryNotificationRecipientNotifier(id: string): Promise<Record<string, unknown> | undefined> {
  try {
    const response = await request.get(`/notifier/config/${encodeURIComponent(id)}`)
    if (response.success !== false) return response.result ?? response.data
  } catch { /* 未确认凭据能力时不推断固定目标或组织角色。 */ }
}

/** 仅返回当前身份可查询的组织、角色；组织保留完整路径用于重名区分。 */
export async function queryNotificationRecipientDirectory(type: NotificationRecipientType): Promise<NotificationRecipientOption[]> {
  const response = type === 'org'
    ? await request.post('/organization/_all/tree', {})
    : await request.get('/role/_query/no-paging?paging=false')
  const payload = response.result ?? response.data
  const rows = Array.isArray(payload) ? payload : payload?.data
  if (response.success === false || !Array.isArray(rows)) throw new Error('Notification recipient directory unavailable')
  const options = new Map<string, string>()
  function visit(row: Record<string, unknown>, parent?: string) {
    const id = typeof row.id === 'string' ? row.id.trim() : ''
    const name = typeof row.name === 'string' ? row.name : id
    const label = parent ? `${parent} / ${name}` : name
    if (id) options.set(id, label)
    if (type === 'org' && Array.isArray(row.children)) row.children.filter(isRecord).forEach(child => visit(child, label))
  }
  rows.filter(isRecord).forEach(row => visit(row))
  return [...options].map(([id, name]) => ({ id, name }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
