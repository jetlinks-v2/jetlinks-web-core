import dayjs from 'dayjs'

/**
 * 告警通知详情的展示模型。
 *
 * 各类告警（设备 / 产品 / 组织 / 场景 / 采集器 / AI）通知的数据都来自告警记录，
 * 这里只按白名单取出用户关心的字段，不展开底层消息、条件树或绑定关系。
 */

type Dict = Record<string, any>

export type AlarmTargetKind = 'device' | 'product' | 'organization' | 'scene' | 'collector' | 'ai' | 'other'

export interface AlarmSummaryField {
  key: string
  /** i18n key，由展示组件翻译 */
  labelKey: string
  value: string | number
  /** time: 毫秒时间戳；mono: ID 类等宽展示 */
  format?: 'time' | 'mono'
  /** 独占一行，内容较长时换行展示 */
  wide?: boolean
}

export interface AlarmReasonRow {
  key: 'condition' | 'actual' | 'recovery'
  labelKey: string
  value: string
}

export interface AlarmNotificationSummary {
  kind: AlarmTargetKind
  name: string
  level?: number
  /** 后端已本地化的级别文案，级别字典缺失时兜底 */
  levelText: string
  relieved: boolean
  /** 告警时间（毫秒），缺失时为 undefined */
  time?: number
  reasons: AlarmReasonRow[]
  fields: AlarmSummaryField[]
}

const LABEL = 'components.ViewDialog.alarm.'

const PROVIDER_KINDS: Record<string, AlarmTargetKind> = {
  'alarm-device': 'device',
  'alarm-device-relieve': 'device',
  'alarm-product': 'product',
  'alarm-org': 'organization',
  'alarm-other': 'scene',
  'alarm-collector': 'collector',
  aiSecurityAlarm: 'ai',
  aiComplianceAlarm: 'ai',
}

const TARGET_KINDS: Record<string, AlarmTargetKind> = {
  device: 'device',
  product: 'product',
  organization: 'organization',
  org: 'organization',
  scene: 'scene',
  collector: 'collector',
  aiTaskMediaTarget: 'ai',
}

const isDict = (value: unknown): value is Dict =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** 历史数据里可能存在损坏的 JSON，解析失败时按空对象处理。 */
function parseDict(value: unknown): Dict {
  if (isDict(value)) return value
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return isDict(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** 0、false 是有效值，只有 null / undefined / 空白字符串视为空。 */
function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return ''
  return String(value).trim()
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const result = text(value)
    if (result) return result
  }
  return ''
}

function timestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const raw = typeof value === 'string' ? value.trim() : value
  // 数字字符串是毫秒时间戳；带年月日的历史文本保留原来的日期解析方式。
  const date = typeof raw === 'string' && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(raw) ? raw : Number(raw)
  const millis = dayjs(date).valueOf()
  return millis > 0 ? millis : undefined
}

/** 历史通知可能缺少告警时间，只用已记录的通知时间兜底，不能取查看时间。 */
export function resolveAlarmNotificationTime(alarmTime: unknown, notifyTime: unknown): number | undefined {
  return timestamp(alarmTime) ?? timestamp(notifyTime)
}

/** 通知详情：优先 detailJson，其次 detail，最后回退到通知记录本身。 */
export function readNotificationDetail(record: Dict | null | undefined): Dict {
  if (!record) return {}
  if (typeof record.detailJson === 'string' && record.detailJson.trim()) {
    const parsed = parseDict(record.detailJson)
    if (Object.keys(parsed).length) return parsed
  }
  return isDict(record.detail) ? record.detail : record
}

/** provider 命名并不统一（alarm-*、aiSecurityAlarm 等），同时结合数据特征识别。 */
export function isAlarmNotification(provider: unknown, detail: Dict | null | undefined): boolean {
  const id = text(provider)
  if (id === 'alarm' || id.startsWith('alarm-') || id in PROVIDER_KINDS) return true
  return !!detail && !!firstText(detail.alarmConfigId, detail.alarmConfigName, detail.alarmName)
}

function resolveKind(provider: string, detail: Dict): AlarmTargetKind {
  return TARGET_KINDS[text(detail.targetType)] || PROVIDER_KINDS[provider] || 'other'
}

/** 属性读数：属性名 = 格式化值 单位；格式化值已带单位时不重复追加。 */
function propertyReading(detail: Dict): string {
  const value = firstText(detail.propertyValueText, detail.propertyValue)
  if (!value) return ''
  const unit = text(detail.propertyUnit)
  const reading = unit && !value.endsWith(unit) ? `${value} ${unit}` : value
  const name = firstText(detail.propertyName, detail.property)
  return name ? `${name} = ${reading}` : reading
}

function targetFields(kind: AlarmTargetKind, detail: Dict, info: Dict): AlarmSummaryField[] {
  const name = text(detail.targetName)
  const id = text(detail.targetId)
  const fields: AlarmSummaryField[] = []
  const push = (key: string, value: string, format?: AlarmSummaryField['format']) => {
    if (value) fields.push({ key, labelKey: LABEL + key, value, format })
  }
  switch (kind) {
    case 'device':
      push('deviceName', name)
      push('deviceId', id, 'mono')
      push('ownerProduct', firstText(detail.productName, info.productName))
      break
    case 'product':
      push('productName', name)
      push('productId', id, 'mono')
      break
    case 'organization':
      push('orgName', name)
      break
    case 'scene':
      push('sceneName', name)
      break
    case 'collector':
      push('collectorName', name)
      push('collectorId', id, 'mono')
      break
    case 'ai': {
      const headers = parseDict(info.headers)
      push('target', name)
      push('space', firstText(detail.spaceName, info.spaceName, headers.spaceName))
      push('mediaDevice', firstText(detail.mediaDeviceName, info.mediaDeviceName, headers.mediaDeviceName))
      push('mediaChannel', firstText(detail.mediaChannelName, info.mediaChannelName, headers.mediaChannelName))
      break
    }
    default:
      push('target', name)
  }
  return fields
}

/**
 * 把告警通知数据归一成展示模型。
 *
 * @param record 通知记录（含 topicProvider、notifyTime）
 * @param detail 通知详情，默认从 record 中读取
 */
export function buildAlarmNotificationSummary(
  record: Dict | null | undefined,
  detail: Dict = readNotificationDetail(record),
): AlarmNotificationSummary {
  const provider = text(record?.topicProvider)
  // 历史告警把触发数据序列化在 alarmInfo 中，仅作为白名单字段的兜底来源
  const info = parseDict(detail.alarmInfo)
  const termSpec = parseDict(detail.termSpec)
  const kind = resolveKind(provider, detail)
  const relieveTime = timestamp(detail.relieveTime)
  const relieved = provider === 'alarm-device-relieve' || text(detail.event) === 'relieve' || !!relieveTime

  const condition = firstText(detail.triggerDesc, termSpec.triggerDesc)
  const actual = firstText(detail.actualDesc, termSpec.actualDesc)
  const reading = propertyReading(detail)
  const reasons: AlarmReasonRow[] = []
  if (condition) reasons.push({ key: 'condition', labelKey: LABEL + 'condition', value: condition })
  if (relieved && reading) {
    // 解除通知关心的是恢复后的读数，而不是触发当时的实际情况
    reasons.push({ key: 'recovery', labelKey: LABEL + 'recovery', value: reading })
  } else if (actual || reading) {
    reasons.push({ key: 'actual', labelKey: LABEL + 'actual', value: actual || reading })
  }

  const fields = targetFields(kind, detail, info)
  const source = text(detail.sourceName)
  const sameAsTarget = text(detail.sourceId) === text(detail.targetId)
    && text(detail.sourceType) === text(detail.targetType)
  if (source && !sameAsTarget && !fields.some(field => field.value === source)) {
    fields.push({ key: 'source', labelKey: LABEL + 'source', value: source })
  }
  if (relieveTime) {
    fields.push({ key: 'relieveTime', labelKey: LABEL + 'relieveTime', value: relieveTime, format: 'time' })
  }
  const description = text(detail.description)
  if (description) {
    fields.push({ key: 'description', labelKey: LABEL + 'description', value: description, wide: true })
  }

  const level = Number(detail.level)
  return {
    kind,
    name: firstText(detail.alarmName, detail.alarmConfigName),
    level: Number.isFinite(level) && level > 0 ? level : undefined,
    levelText: text(detail.levelText),
    relieved,
    time: resolveAlarmNotificationTime(detail.alarmTime, record?.notifyTime),
    reasons,
    fields,
  }
}
