const longMaximum = 9223372036854775807n

/** Java 非负 long 的精确十进制文本；未知、溢出或已丢精度的数字不能补零。 */
export function bufferCounterText(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{1,19}$/.test(value)) return undefined
  const count = BigInt(value)
  return count <= longMaximum ? count.toString() : undefined
}

/** 只解析 PersistenceBuffer Monitor 的有界 queue 段，out 表示处理尝试而非成功数。 */
export function bufferMonitorCounters(value: unknown): { written?: string; attempted?: string } {
  if (typeof value !== 'string' || value.length > 16384) return {}
  const queue = /(?:^|;)\s*queue\s*\(\s*in\s+(\d{1,19})\s*,\s*out\s+(\d{1,19})\s*,\s*dropped\s+\d{1,19}\s*\)(?=\s*(?:;|$))/.exec(value)
  return queue ? { written: bufferCounterText(queue[1]), attempted: bufferCounterText(queue[2]) } : {}
}

/** 全部已知队列都具备精确计数才求和，不把缺失值或部分响应变成总量。 */
export function bufferCounterTotal(queues: readonly { written?: string; attempted?: string }[], key: 'written' | 'attempted'): string | undefined {
  if (!queues.length) return undefined
  let total = 0n
  for (const queue of queues) {
    const value = bufferCounterText(queue[key])
    if (value === undefined) return undefined
    total += BigInt(value)
  }
  return total.toString()
}
