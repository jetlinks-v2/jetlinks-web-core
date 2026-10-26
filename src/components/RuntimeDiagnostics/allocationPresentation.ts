import type { ObjectAllocation } from './types'

export interface AllocationRank extends ObjectAllocation { rank: number; share: number }

/** 单个累计快照的排行；筛选只裁剪结果，不改变全量字节分母或跨快照累加。 */
export function allocationRanking(allocations: readonly ObjectAllocation[] = [], query = '') {
  const valid = allocations.filter(item => typeof item.className === 'string' && item.className.trim()
    && Number.isSafeInteger(item.allocationSize) && item.allocationSize >= 0)
    .slice().sort((a, b) => b.allocationSize - a.allocationSize || a.className.localeCompare(b.className))
  const totalBytes = valid.reduce((total, item) => total + item.allocationSize, 0)
  const rows: AllocationRank[] = valid.map((item, index) => ({ ...item, rank: index + 1,
    share: totalBytes > 0 ? Math.min(100, item.allocationSize / totalBytes * 100) : 0 }))
  const keyword = query.trim().toLocaleLowerCase()
  return { totalBytes, classCount: valid.length, rows: keyword ? rows.filter(item => item.className.toLocaleLowerCase().includes(keyword)) : rows }
}

/** 字节仅按量级格式化，完整原始值可由展示层提供 title。 */
export function formatAllocationBytes(value: number, locale?: string): string {
  if (!Number.isFinite(value) || value < 0) return ''
  if (value < 1024) return `${value.toLocaleString(locale)} B`
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
  const unit = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / 1024 ** unit).toLocaleString(locale, { maximumFractionDigits: 1 })} ${units[unit]}`
}
