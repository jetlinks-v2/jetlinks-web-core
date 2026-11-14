import dayjs from 'dayjs'

/** 平台时间为毫秒；未采集的0不反显成1970，不按数值大小猜测单位。 */
export function metricDateText(value:unknown, format?:string):string {
  const time = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  if (!Number.isFinite(time) || time <= 0) return '—'
  const date = dayjs(time)
  return date.isValid() ? date.format(format?.replace(/yyyy/g,'YYYY').replace(/dd/g,'DD') || 'YYYY-MM-DD HH:mm:ss') : '—'
}
