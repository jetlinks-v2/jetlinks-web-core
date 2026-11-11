import type { DashboardValue, DashboardWidget } from '../components/DashBoardCanvas/types'
import { getGridSettings, toGridLayout } from '../components/DashBoardCanvas/utils/layout'
import type { ObjectMember, ObjectMemberSelection } from './types'
import { objectCapabilityId } from './metadata'

export interface ObjectContentWidget extends DashboardWidget {
  componentProps: DashboardWidget['componentProps'] & { selections?: ObjectMemberSelection[] }
}
export function currentObjectSelection(member: ObjectMember): ObjectMemberSelection {
  const object = { objectType: member.ref.type, objectSource: { source: 'upper' as const, upperKey: 'object' } }
  const ref = { capabilityId: objectCapabilityId(member.ref), version: 1, config: { object } }
  return { member: member.ref, object, binding: member.ref.kind === 'action'
    ? { version: 1, operation: ref } : { version: 1, source: ref } }
}
export function isCurrentSelection(selection: ObjectMemberSelection): boolean {
  if (selection.member.kind === 'query') return false
  const spec = selection.object
  return !spec || (!spec.related && spec.objectSource?.source === 'upper' && spec.objectSource.upperKey === 'object')
}
export const selectionKey = (selection: ObjectMemberSelection) => JSON.stringify(selection.binding)
export function dashboardSelections(value: DashboardValue): ObjectMemberSelection[] {
  return (value.components as ObjectContentWidget[]).filter(widget => widget.visible !== false)
    .flatMap(widget => widget.componentProps.selections || [])
}
/** Fit the same normalized grid used by DashBoardCanvas; failures and empty views reserve no space. */
export function objectDashboardHeight(value: DashboardValue): number {
  const settings = getGridSettings(value.canvas)
  const rows = Math.max(0, ...toGridLayout(value.components, settings.columns).map(item => item.y + item.h))
  return rows ? rows * settings.rowHeight + (rows - 1) * settings.margin[1] : 0
}
export function objectDefaultDashboard(members: ObjectMember[], labels: { data: string; actions: string }): DashboardValue {
  const sources = [...new Set(members.map(member => member.ref.providerId))]
    .map(id => members.filter(member => member.ref.providerId === id && member.ref.kind === 'property'))
  const data = Array.from({ length: Math.max(0, ...sources.map(source => source.length)) }, (_, index) => sources.flatMap(source => source[index] || []))
    .flat().slice(0, 6)
  const groups = [
    { type: 'object-data', name: labels.data, items: data },
    { type: 'object-actions', name: labels.actions, items: members.filter(member => member.ref.kind === 'action').slice(0, 4) },
  ].filter(group => group.items.length)
  return { canvas: { gridLayout: { colNum: 12, rowHeight: 40, marginHorizontal: 12, marginVertical: 12 } },
    components: groups.map((group, index) => ({ id: group.type, type: group.type, name: group.name,
      componentProps: { gridItem: { x: 0, y: index * 6, w: 12, h: 6, minW: 4, minH: 3 }, selections: group.items.map(currentObjectSelection) } })) }
}
