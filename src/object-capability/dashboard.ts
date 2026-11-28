import type { DashboardValue, DashboardWidget } from '../components/DashBoardCanvas/types'
import { getGridSettings, toGridLayout } from '../components/DashBoardCanvas/utils/layout'
import type { ObjectMember, ObjectMemberSelection, ObjectPropertyMetadata } from './types'
import { objectCapabilityId, sameObjectMember } from './metadata'
import { defaultObjectMembers } from './references'
import { objectContentGroups, objectMemberContentGroup, type ObjectContentGroupKind, type ObjectContentLabels } from './content'
import type { ObjectSectionPresentation } from '../types/object-presentation'
import { objectMemberSection } from './sections'

export interface ObjectContentWidget extends DashboardWidget {
  componentProps: DashboardWidget['componentProps'] & { selections?: ObjectMemberSelection[]; sectionId?: string; contentGroup?: ObjectContentGroupKind; contentGroups?: ObjectContentGroupKind[]; collapsible?: boolean }
}
export function objectSectionMembers(members: ObjectMember[], sections: ObjectSectionPresentation[], id: string): ObjectMember[] {
  return objectContentGroups.flatMap(group => objectGroupMembers(members, group)).filter(member => objectMemberSection(member, sections)?.id === id)
}
export function objectSectionWidget(section: ObjectSectionPresentation, count: number, y: number): ObjectContentWidget {
  return { id: `section:${section.id}`, type: 'object-data', name: section.label(), componentProps: {
    sectionId: section.id, sectionMembers: section.members,
    gridItem: { x: 0, y, w: 12, h: objectContentHeight(Math.min(count, 6), 2), minW: 4, minH: 3 }
  } }
}
export function objectWidgetSection(widget: ObjectContentWidget, sections: ObjectSectionPresentation[] = []): ObjectSectionPresentation | undefined {
  const id = widget.componentProps.sectionId
  if (typeof id !== 'string' || !id) return
  const registered = sections.find(section => section.id === id)
  if (registered) return registered
  const bindings = widget.componentProps.sectionMembers
  return { id, label: () => widget.name || '', members: Array.isArray(bindings) ? bindings.filter(ref => ref && typeof ref.providerId === 'string' &&
    ['property', 'query', 'action'].includes(ref.kind) && (ref.id === undefined || typeof ref.id === 'string')) : [] }
}
export function currentObjectSelection(member: ObjectMember): ObjectMemberSelection {
  const object = { objectType: member.ref.type, objectSource: { source: 'upper' as const, upperKey: 'object' } }
  const ref = { capabilityId: objectCapabilityId(member.ref), version: 1, config: { object } }
  return {
    member: member.ref,
    object,
    binding: member.ref.kind === 'action' ? { version: 1, operation: ref } : { version: 1, source: ref }
  }
}
export function isCurrentSelection(selection: ObjectMemberSelection): boolean {
  if (selection.member.kind === 'query') return false
  const spec = selection.object
  return !spec || (!spec.related && spec.objectSource?.source === 'upper' && spec.objectSource.upperKey === 'object')
}
export const selectionKey = (selection: ObjectMemberSelection) => JSON.stringify(selection.binding)
/** A public page stores meaning; the current object's model supplies its actual fields. Queries remain explicit. */
export function objectGroupMembers(members: ObjectMember[], group: ObjectContentGroupKind): ObjectMember[] {
  const editors = new Set(members.flatMap(member => {
    const edit = member.ref.kind === 'property' ? (member.metadata as ObjectPropertyMetadata).expands?.edit : undefined
    return edit ? [JSON.stringify([member.ref.type, edit.providerId, edit.command])] : []
  }))
  return defaultObjectMembers(members).filter(member => member.ref.kind !== 'query' && objectMemberContentGroup(member) === group &&
    !(member.ref.kind === 'action' && editors.has(JSON.stringify([member.ref.type, member.ref.providerId, member.ref.id]))))
}
export function objectWidgetSelections(widget: ObjectContentWidget, members: ObjectMember[] = [], page = 0): ObjectMemberSelection[] {
  const section = objectWidgetSection(widget)
  if (section) {
    return [...new Map([...objectSectionMembers(members, [section], section.id).map(currentObjectSelection), ...(widget.componentProps.selections || [])].map(selection => [selectionKey(selection), selection])).values()]
  }
  const groups = objectWidgetGroups(widget)
  const size = groups.length === 1 && groups[0] === 'actions' ? 4 : 6
  return groups.length ? groups.flatMap(group => objectGroupMembers(members, group)).slice(page * size, (page + 1) * size).map(currentObjectSelection) : widget.componentProps.selections || []
}
export function objectWidgetGroups(widget: ObjectContentWidget): ObjectContentGroupKind[] {
  const groups = widget.componentProps.contentGroups
  return Array.isArray(groups) ? [...new Set(groups.filter(group => objectContentGroups.includes(group)))]
    : widget.componentProps.contentGroup && objectContentGroups.includes(widget.componentProps.contentGroup) ? [widget.componentProps.contentGroup] : []
}
export function dashboardSelections(value: DashboardValue, members: ObjectMember[] = [], pages: Record<string, number> = {}): ObjectMemberSelection[] {
  return (value.components as ObjectContentWidget[])
    .filter((widget) => widget.visible !== false)
    .flatMap((widget) => Array.isArray(widget.componentProps.contentGroups) && objectWidgetGroups(widget).length
      ? objectWidgetGroups(widget).flatMap(group => objectGroupMembers(members, group)).map(currentObjectSelection)
      : objectWidgetSelections(widget, members, pages[widget.id]))
}
/** Continuous reading uses the same default policy without paging; queries still require explicit bindings. */
export function objectReadingSelections(members: ObjectMember[]): ObjectMemberSelection[] {
  return objectContentGroups.flatMap(kind => objectGroupMembers(members, kind).map(currentObjectSelection))
}
/** Fit the same normalized grid used by DashBoardCanvas; failures and empty views reserve no space. */
export function objectDashboardHeight(value: DashboardValue): number {
  const settings = getGridSettings(value.canvas)
  const rows = Math.max(0, ...toGridLayout(value.components, settings.columns).map((item) => item.y + item.h))
  return rows ? rows * settings.rowHeight + (rows - 1) * settings.margin[1] : 0
}
/** Reserve real reading rows rather than a fixed tall card for every group. */
export function objectContentHeight(count: number, columns = 3, actions = false): number {
  return actions ? Math.max(2, Math.ceil(count / columns) + 1) : Math.max(3, Math.ceil(count / columns) * 2 + 1)
}

/** Reading projection only: measured content grows default cards without rewriting saved coordinates. */
export function objectReadingDashboard(value: DashboardValue, heights: Readonly<Record<string, number>>, narrow = false): DashboardValue {
  const settings = getGridSettings(value.canvas)
  const placed: Array<{ x: number; y: number; w: number; h: number }> = []
  const grids = new Map<string, (typeof placed)[number]>()
  const layout = toGridLayout(value.components, settings.columns).sort((a, b) => a.y - b.y || a.x - b.x)
  for (const item of layout) {
    const x = narrow ? 0 : item.x, w = narrow ? settings.columns : item.w
    const measured = heights[item.i] || 0
    const h = Math.max(item.h, Math.ceil((measured + settings.margin[1]) / (settings.rowHeight + settings.margin[1])))
    const y = Math.max(narrow ? 0 : item.y, ...placed.filter(p => p.x < x + w && p.x + p.w > x).map(p => p.y + p.h))
    const grid = { x, y, w, h }
    placed.push(grid)
    grids.set(item.i, grid)
  }
  return { ...value, components: value.components.map(widget => ({ ...widget, componentProps: {
    ...widget.componentProps, gridItem: { ...widget.componentProps.gridItem, ...grids.get(widget.id) },
  } })) }
}

/** Context precedes full-width readings; saved dashboards retain their explicit coordinates. */
export function objectDefaultDashboard(members: ObjectMember[], labels: ObjectContentLabels, sections: ObjectSectionPresentation[] = []): DashboardValue {
  const generic = members.filter(member => !objectMemberSection(member, sections))
  const groups = objectContentGroups.flatMap((kind) => {
    const items = objectGroupMembers(generic, kind).slice(0, kind === 'actions' ? 4 : 6)
    return items.length ? [{ kind, items }] : []
  })
  const context = groups.filter(group => ['data', 'status', 'references'].includes(group.kind))
  let y = context.length ? 2 : 0
  const components: ObjectContentWidget[] = context.length ? [{
    id: 'object-context', type: 'object-data', name: labels.data,
    componentProps: { contentGroups: context.map(group => group.kind), collapsible: true,
      gridItem: { x: 0, y: 0, w: 12, h: 2, minW: 4, minH: 2 } }
  }] : []
  for (const group of groups.filter(group => !context.includes(group))) {
    const h = objectContentHeight(group.items.length, 2, group.kind === 'actions')
    const widget: ObjectContentWidget = {
      id: `object-${group.kind}`,
      type: group.kind === 'actions' ? 'object-actions' : 'object-data',
      name: labels[group.kind] || labels.data,
      componentProps: {
        gridItem: { x: 0, y, w: 12, h, minW: 4, minH: group.kind === 'actions' ? 2 : 3 },
        contentGroup: group.kind
      }
    }
    y += h
    components.push(widget)
  }
  for (const section of sections) {
    const items = objectSectionMembers(members, sections, section.id)
    if (!items.length) continue
    const widget = objectSectionWidget(section, items.length, y)
    components.push(widget)
    y += widget.componentProps.gridItem!.h!
  }
  return { canvas: { gridLayout: { colNum: 12, rowHeight: 32, marginHorizontal: 12, marginVertical: 12 } }, components }
}

export function addObjectDashboardGroup(value: DashboardValue, kind: ObjectContentGroupKind, labels: ObjectContentLabels): DashboardValue {
  if (value.components.some(widget => widget.visible !== false && objectWidgetGroups(widget as ObjectContentWidget).includes(kind))) return value
  return { ...value, components: [...value.components, {
    id: crypto.randomUUID(), type: kind === 'actions' ? 'object-actions' : 'object-data', name: labels[kind] || labels.data,
    componentProps: { contentGroup: kind, gridItem: {
      x: 0, y: Math.max(0, ...value.components.map(widget => Number(widget.componentProps.gridItem?.y || 0) + Number(widget.componentProps.gridItem?.h || 4))),
      w: 12, h: objectContentHeight(kind === 'actions' ? 4 : 6, 3, kind === 'actions'), minW: 4, minH: 3
    } }
  }] }
}

/** Add explicitly to a homogeneous group. Saved mixed groups and their selected content are never rewritten. */
export function addObjectDashboardSelection(
  value: DashboardValue,
  selection: ObjectMemberSelection,
  members: ObjectMember[],
  labels: ObjectContentLabels,
  sections: ObjectSectionPresentation[] = []
): DashboardValue {
  if (dashboardSelections(value, members).some((item) => selectionKey(item) === selectionKey(selection))) return value
  const groupOf = (item: ObjectMemberSelection) => {
    if (item.member.kind === 'action') return 'actions'
    if (item.member.kind === 'query') return 'related'
    const member = members.find((member) => sameObjectMember(member.ref, item.member))
    return !member && !isCurrentSelection(item) ? 'related' : objectMemberContentGroup(member)
  }
  const kind = groupOf(selection)
  const member = members.find(member => sameObjectMember(member.ref, selection.member))
  const section = member ? objectMemberSection(member, sections) : undefined
  const type = kind === 'actions' ? 'object-actions' : 'object-data'
  const widget = (value.components as ObjectContentWidget[]).find(
    (item) =>
      item.visible !== false &&
      (section ? item.componentProps.sectionId === section.id : item.type === type && !item.componentProps.sectionId && !!item.componentProps.selections?.length && item.componentProps.selections.every((selected) => groupOf(selected) === kind))
  )
  if (!widget)
    return {
      ...value,
      components: [
        ...value.components,
        {
          id: crypto.randomUUID(),
          type,
          name: section?.label() || labels[kind] || labels.data,
          componentProps: {
            ...(section ? { sectionId: section.id, sectionMembers: section.members } : {}),
            selections: [selection],
            gridItem: {
              x: 0,
              y: Math.max(
                0,
                ...value.components.map(
                  (item) => Number(item.componentProps.gridItem?.y || 0) + Number(item.componentProps.gridItem?.h || 6)
                )
              ),
              w: 12,
              h: objectContentHeight(1, 3, kind === 'actions'),
              minW: 4,
              minH: kind === 'actions' ? 2 : 3
            }
          }
        }
      ]
    }
  const selections = [...(widget.componentProps.selections || []), selection]
  const grid = widget.componentProps.gridItem || {}
  const oldHeight = Number(grid.h || 3),
    bottom = Number(grid.y || 0) + oldHeight
  const h = Math.max(
    oldHeight,
    objectContentHeight(selections.length, Number(grid.w || 12) <= 6 ? 2 : 3, kind === 'actions')
  )
  return {
    ...value,
    components: value.components.map((item) =>
      item.id === widget.id
        ? { ...widget, componentProps: { ...widget.componentProps, selections, gridItem: { ...grid, h } } }
        : h > oldHeight && Number(item.componentProps.gridItem?.y || 0) >= bottom
        ? {
            ...item,
            componentProps: {
              ...item.componentProps,
              gridItem: {
                ...item.componentProps.gridItem,
                y: Number(item.componentProps.gridItem?.y || 0) + h - oldHeight
              }
            }
          }
        : item
    )
  }
}
