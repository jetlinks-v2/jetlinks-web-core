import { errorText } from '../service'
import type { MetricApi, MetricRuntime, MetricValue } from '../types'

/** Only successful bounded batches may revoke omitted IDs; failed batches retain their prior snapshot. */
export async function loadMetricLatest(api: Pick<MetricApi, 'latest'>, ids: string[], previous: Record<string, Record<string, MetricValue>>, denied: string[], isCurrent: () => boolean, previousRuntime: Record<string, MetricRuntime> = {}) {
  const outputs = Object.fromEntries(ids.filter(id => Object.prototype.hasOwnProperty.call(previous, id)).map(id => [id, previous[id]]))
  const runtimes = Object.fromEntries(ids.filter(id => Object.prototype.hasOwnProperty.call(previousRuntime, id)).map(id => [id, previousRuntime[id]]))
  const inaccessible = new Set(denied.filter(id => ids.includes(id)))
  const errors: Record<string, string> = {}
  for (let start = 0; start < ids.length; start += 128) {
    if (!isCurrent()) return
    const batchIds = ids.slice(start, start + 128)
    try {
      const response = await api.latest(batchIds)
      if (!isCurrent()) return
      const readable = new Map(response.filter(item => batchIds.includes(item.configId)).map(item => [item.configId, item]))
      for (const id of batchIds) {
        const item = readable.get(id)
        if (item) {
          outputs[id] = item.outputs
          // 缺反馈表示当前节点未反馈，不能沿用上次的 loaded/failed。
          if (item.runtime) runtimes[id] = item.runtime
          else delete runtimes[id]
          inaccessible.delete(id)
        } else { delete outputs[id]; delete runtimes[id]; inaccessible.add(id) }
      }
    } catch (cause) {
      if (!isCurrent()) return
      for (const id of batchIds) errors[id] = errorText(cause)
    }
  }
  return { outputs, runtimes, inaccessibleIds: [...inaccessible], errors }
}
