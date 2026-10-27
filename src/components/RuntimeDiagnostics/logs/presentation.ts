import type { LogEntry } from '../types'

/** 不生成 HTML；关键词按普通文本匹配，日志中的标签和脚本始终显示为文本。 */
export function logHighlight(text: string, query: string): Array<{ text: string; match: boolean }> {
  if (!query) return [{ text, match: false }]
  const source = text.toLowerCase(), search = query.toLowerCase(), parts: Array<{ text: string; match: boolean }> = []
  let offset = 0, index = source.indexOf(search)
  while (index >= 0) {
    if (index > offset) parts.push({ text: text.slice(offset, index), match: false })
    parts.push({ text: text.slice(index, index + query.length), match: true })
    offset = index + query.length; index = source.indexOf(search, offset)
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), match: false })
  return parts
}

/** 元数据解析交宿主；正文与多行原文分别保留，未知格式不自行猜字段。 */
export function logPresentation(entry: LogEntry) {
  const raw = entry.raw ?? entry.text
  // 换行本身不是异常证据；普通消息保留全文，只有宿主明确识别的异常才使用 stack。
  return { raw, message: entry.message ?? entry.text, stack: entry.stack ?? '' }
}

/** 普通消息默认展示有限正文，展开后保留原始换行与缩进；不把消息续行伪装成堆栈。 */
export function logMessagePreview(message: string, expanded = false) {
  const lines = message.split('\n'), preview = lines.slice(0, 8).join('\n').slice(0, 1400)
  const collapsed = preview.length < message.length
  return { text: expanded || !collapsed ? message : `${preview}\n…`, collapsible: collapsed }
}

/** 仅缩短明确的 ISO / 日期时间显示；完整时间仍由 tooltip 与原文保留。 */
export function logTimeLabel(time: string): string {
  return /^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)(?:Z|[+-]\d{2}:?\d{2})?$/.exec(time)?.[1] ?? time
}

/** 未选中时上一条从末尾开始、下一条从开头开始；当前项失效同样按首次处理。 */
export function nextLogMatchId(entries: ReadonlyArray<Pick<LogEntry, 'id'>>, currentId: string, direction: -1 | 1): string {
  if (!entries.length) return ''
  const current = entries.findIndex(entry => entry.id === currentId)
  const next = current < 0 ? direction > 0 ? 0 : entries.length - 1 : (current + direction + entries.length) % entries.length
  return entries[next].id
}
