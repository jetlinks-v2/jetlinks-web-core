export const DETANER_PARK_CHANGED_EVENT = 'detainer-park-changed'

export type DetainerParkChangedDetail = { parkId: string }

export function dispatchParkChanged(parkId: string): void {
  window.dispatchEvent(
    new CustomEvent<DetainerParkChangedDetail>(DETANER_PARK_CHANGED_EVENT, {
      detail: { parkId: String(parkId || '').trim() },
    }),
  )
}

/** 流程管理 iframe 切换园区时保持挂载，避免中转路由重建 iframe。 */
export function isWorkflowEmbedRoute(path: string): boolean {
  return (
    path.includes('workflow-admin/process-design') ||
    path.includes('workflow-admin/process-define')
  )
}
