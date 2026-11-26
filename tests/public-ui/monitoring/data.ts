import type { ConditionFilterTerm } from '../../../src/components/ConditionFilter/types'
export type Query = { group: string; terms: ConditionFilterTerm[] }
export type Device = { id: string; name: string; group: string; model: string; icon: string; status: string }
export type DeviceCounts = { total: number; normal: number; attention: number; offline: number }
export type DeviceDetail = { reported: string; signal: string; location: string; value?: number; unit: string; lower: number; upper: number; digits: number; history: number[] }
export const groups = [
  { id: 'all', name: '全部点位', icon: 'AppstoreOutlined' },
  { id: 'power', name: '供配电系统', icon: 'ThunderboltOutlined' },
  { id: 'cooling', name: '循环冷却系统', icon: 'ControlOutlined' },
  { id: 'air', name: '压缩空气系统', icon: 'CloudOutlined' },
  { id: 'environment', name: '环境监测', icon: 'ExperimentOutlined' },
]
type Reading = { name: string; source: string; unit: string; value: number; lower: number; upper: number; start: number; digits: number; icon: string }
const cooling: Reading[] = [
  { name: '回水温度', source: '冷却回水总管', unit: '°C', value: 38.6, lower: 18, upper: 35, start: 28, digits: 1, icon: 'ExperimentOutlined' },
  { name: '供水压力', source: '1 号循环泵出口', unit: 'MPa', value: 0.28, lower: 0.35, upper: 0.55, start: 0.46, digits: 2, icon: 'DashboardOutlined' },
  { name: '供水温度', source: '冷却供水总管', unit: '°C', value: 24.8, lower: 18, upper: 30, start: 24.2, digits: 1, icon: 'ExperimentOutlined' },
  { name: '循环流量', source: '循环供水总管', unit: 'm³/h', value: 18.4, lower: 12, upper: 24, start: 18, digits: 1, icon: 'SwapOutlined' },
  { name: '运行电流', source: '1 号循环泵', unit: 'A', value: 4.8, lower: 2, upper: 6, start: 4.6, digits: 1, icon: 'ThunderboltOutlined' },
  { name: '冷却塔出水温度', source: '1 号冷却塔', unit: '°C', value: 26.1, lower: 18, upper: 30, start: 25.4, digits: 1, icon: 'ExperimentOutlined' },
  { name: '泵体振动', source: '1 号循环泵', unit: 'mm/s', value: 1.8, lower: 0, upper: 4.5, start: 1.6, digits: 1, icon: 'LineChartOutlined' },
  { name: '水池液位', source: '循环水池', unit: 'cm', value: 128, lower: 80, upper: 160, start: 132, digits: 0, icon: 'DashboardOutlined' },
  { name: '补水流量', source: '循环水补水管', unit: 'm³/h', value: 3.2, lower: 1, upper: 5, start: 3, digits: 1, icon: 'SwapOutlined' },
  { name: '循环泵转速', source: '2 号循环泵', unit: 'rpm', value: 1450, lower: 1000, upper: 1500, start: 1440, digits: 0, icon: 'ControlOutlined' },
  { name: '调节阀开度', source: '冷却供水阀', unit: '%', value: 62, lower: 20, upper: 80, start: 58, digits: 0, icon: 'ControlOutlined' },
  { name: '备用泵运行电流', source: '3 号循环泵', unit: 'A', value: 0, lower: 0, upper: 6, start: 0, digits: 1, icon: 'ThunderboltOutlined' },
]
const catalog: Record<string, Reading[]> = {
  power: [
    { name: '进线电压', source: '进线柜', unit: 'V', value: 396, lower: 380, upper: 420, start: 398, digits: 0, icon: 'ThunderboltOutlined' },
    { name: '母线电流', source: '母联柜', unit: 'A', value: 142, lower: 0, upper: 180, start: 132, digits: 0, icon: 'ThunderboltOutlined' },
    { name: '有功功率', source: '低压配电柜', unit: 'kW', value: 86.4, lower: 0, upper: 110, start: 82, digits: 1, icon: 'DashboardOutlined' },
    { name: '功率因数', source: '低压配电柜', unit: '', value: 0.92, lower: 0.9, upper: 1, start: 0.94, digits: 2, icon: 'DashboardOutlined' },
  ],
  air: [
    { name: '管网压力', source: '压缩空气总管', unit: 'MPa', value: 0.62, lower: 0.6, upper: 0.8, start: 0.67, digits: 2, icon: 'DashboardOutlined' },
    { name: '排气温度', source: '空压机', unit: '°C', value: 96, lower: 20, upper: 90, start: 78, digits: 1, icon: 'ExperimentOutlined' },
    { name: '运行功率', source: '空压机', unit: 'kW', value: 22.4, lower: 0, upper: 30, start: 21.8, digits: 1, icon: 'ThunderboltOutlined' },
    { name: '出口流量', source: '压缩空气总管', unit: 'm³/min', value: 3.8, lower: 2, upper: 6, start: 3.6, digits: 1, icon: 'SwapOutlined' },
  ],
  environment: [
    { name: '车间温度', source: '环境监测站', unit: '°C', value: 29.2, lower: 20, upper: 32, start: 28.8, digits: 1, icon: 'ExperimentOutlined' },
    { name: '相对湿度', source: '环境监测站', unit: '%', value: 56, lower: 30, upper: 70, start: 54, digits: 0, icon: 'CloudOutlined' },
    { name: '二氧化碳浓度', source: '空气质量监测站', unit: 'ppm', value: 860, lower: 0, upper: 1000, start: 780, digits: 0, icon: 'CloudOutlined' },
    { name: 'PM2.5', source: '空气质量监测站', unit: 'μg/m³', value: 18, lower: 0, upper: 35, start: 17, digits: 0, icon: 'CloudOutlined' },
  ],
}
const readings = new Map<string, Reading>()
const devices: Device[] = Array.from({ length: 48 }, (_, index) => {
  const group = groups[1 + Math.floor(index / 12)]
  const template = group.id === 'cooling' ? cooling[index % 12] : catalog[group.id][index % 4]
  const area = String(Math.floor(index % 12 / 4) + 1) + '区'
  const point = group.id === 'cooling' ? template : { ...template, name: template.name + ' · ' + area, source: template.source + ' · ' + area }
  const id = 'PT-' + String(index + 1).padStart(4, '0')
  readings.set(id, point)
  return { id, name: point.name, group: group.id, model: point.source, icon: point.icon,
    status: index % 12 === 11 ? 'offline' : point.value > point.upper ? 'high' : point.value < point.lower ? 'low' : 'normal' }
})
// This fixture consumes the same converted conditions a real query endpoint would receive.
function matchesLike(value: string, pattern: string) {
  let expression = ''
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index]
    if (char === '\\' && index + 1 < pattern.length) expression += literal(pattern[++index])
    else expression += char === '%' ? '.*' : char === '_' ? '.' : literal(char)
  }
  return new RegExp('^' + expression + '$', 'i').test(value)
}
function matches(item: Device, terms: ConditionFilterTerm[]): boolean {
  let result = false, conjunction = true
  for (const [index, term] of terms.entries()) {
    if (index && term.type === 'or') { result ||= conjunction; conjunction = true }
    let match: boolean
    if (term.terms) match = matches(item, term.terms)
    else {
      if (!term.column || !['name', 'model', 'status'].includes(term.column) || !term.termType || !['eq', 'like'].includes(term.termType) || typeof term.value !== 'string') throw new Error('演示条件不受支持')
      const value = item[term.column as 'name' | 'model' | 'status']
      match = term.termType === 'eq' ? value === term.value : matchesLike(value, term.value)
    }
    conjunction &&= match
  }
  return result || conjunction
}
function select(query: Query) {
  return devices.filter(item => (query.group === 'all' || query.group === item.group) && matches(item, query.terms))
}
function pause(ms: number, signal: AbortSignal) {
  signal.throwIfAborted()
  return new Promise<void>((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, ms)
    signal.addEventListener('abort', cancel, { once: true })
  })
}
// Fixtures model independent list, count and details; ranges are illustrative, not platform defaults.
export async function* queryNoPaging(query: Query, offset: number, signal: AbortSignal) {
  await pause(180, signal)
  for (const point of select(query).slice(offset, offset + 6)) { await pause(65, signal); yield point }
}
export async function countDevices(query: Query, signal: AbortSignal) {
  await pause(2800, signal)
  const counts: DeviceCounts = { total: 0, normal: 0, attention: 0, offline: 0 }
  for (const item of select(query)) {
    counts.total++
    if (item.status === 'offline') counts.offline++
    else if (item.status === 'normal') counts.normal++
    else counts.attention++
  }
  return counts
}
export async function countGroups(terms: ConditionFilterTerm[], signal: AbortSignal): Promise<Record<string, number>> {
  await pause(2800, signal)
  const result: Record<string, number> = Object.fromEntries(groups.map(group => [group.id, 0]))
  for (const item of select({ group: 'all', terms })) { result.all++; result[item.group]++ }
  return result
}
export async function queryDetails(ids: string[], signal: AbortSignal): Promise<Record<string, DeviceDetail>> {
  await pause(1050, signal)
  return Object.fromEntries(ids.map(id => {
    const device = devices.find(item => item.id === id), point = readings.get(id)
    if (!device || !point) throw new Error('点位不存在')
    const history = device.status === 'offline' ? [] : Array.from({ length: 16 }, (_, i) =>
      Number((point.start + (point.value - point.start) * i / 15 + Math.sin(i / 15 * Math.PI * 4) * (point.upper - point.lower) * 0.015).toFixed(point.digits + 1)))
    if (history.length) history[history.length - 1] = point.value
    return [id, { ...point, value: device.status === 'offline' ? undefined : point.value, history,
      reported: device.status === 'offline' ? '2 小时前' : '刚刚', signal: device.status === 'offline' ? '—' : '-64 dBm',
      location: '一号厂房 · ' + groups.find(group => group.id === device.group)?.name }]
  }))
}
