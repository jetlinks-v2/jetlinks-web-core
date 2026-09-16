import { parseStoredLayout } from './layout'

/** 恢复固定 key；迁移成功后才清理调用方显式声明的旧 key。 */
export function readDashboardLayout(storage: Storage, key: string, legacyKeys: readonly string[] = []) {
  const read = (candidate: string) => {
    try {
      return parseStoredLayout(JSON.parse(storage.getItem(candidate) || 'null'))
    } catch { return undefined }
  }
  const candidates = [...new Set(legacyKeys)].filter(candidate => candidate !== key)
  let saved = read(key)
  if (!saved) {
    saved = candidates.map(read).find(layout => layout && layout.length > 0)
    if (saved) {
      try { storage.setItem(key, JSON.stringify(saved)) } catch { return saved }
    }
  }
  if (saved) {
    candidates.forEach(candidate => {
      try { storage.removeItem(candidate) } catch { /* 清理失败不影响已恢复的布局。 */ }
    })
  }
  return saved
}
