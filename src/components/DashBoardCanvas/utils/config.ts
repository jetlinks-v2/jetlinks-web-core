import { cloneDeep, isEqual } from 'lodash-es'
import type { DashboardConfigEntry, DashboardWidget } from '../types'

const protectedKeys = new Set(['__proto__', 'constructor', 'prototype', 'id', 'type', 'componentProps'])

export function asConfigRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/** Panels embedded by a direct config entry must not appear a second time. */
export function getVisibleConfigEntries(entries: readonly DashboardConfigEntry[]) {
  const embedded = new Set(entries.flatMap(entry => entry.inspector?.embeddedKeys ?? []))
  return entries.filter(entry => !embedded.has(entry.name))
}

/** Only descriptor-declared root fields leave componentProps; business keys stay intact. */
export function updateConfigField(
  widget: DashboardWidget,
  entry: DashboardConfigEntry,
  value: unknown,
  key: string,
): DashboardWidget {
  if (!key || protectedKeys.has(key) || key === 'gridItem') return widget
  const next = cloneDeep(widget)
  if (entry.inspector?.embeddedRootKeys?.includes(key)) {
    next[key] = cloneDeep(value)
  } else {
    next.componentProps[key] = cloneDeep(value)
  }
  return next
}

export function getConfigData(widget: DashboardWidget, entry: DashboardConfigEntry) {
  const config = asConfigRecord(widget.componentProps[entry.name])
  return cloneDeep({
    ...entry.inspector?.defaultData?.(),
    ...asConfigRecord(config.data),
  })
}

export function updateConfigData(
  widget: DashboardWidget,
  entry: DashboardConfigEntry,
  data: Record<string, unknown>,
) {
  return updateConfigField(widget, entry, {
    ...asConfigRecord(widget.componentProps[entry.name]),
    data: cloneDeep(data),
  }, entry.name)
}

/** Commit only edited config namespaces, retaining layout changes made while the drawer was open. */
export function applyWidgetDraft(
  current: DashboardWidget,
  initial: DashboardWidget,
  draft: DashboardWidget,
): DashboardWidget {
  const next = cloneDeep(current)
  for (const key of new Set([...Object.keys(initial.componentProps), ...Object.keys(draft.componentProps)])) {
    if (key === 'gridItem' || protectedKeys.has(key)) continue
    if (isEqual(initial.componentProps[key], draft.componentProps[key])) continue
    if (key in draft.componentProps) next.componentProps[key] = cloneDeep(draft.componentProps[key])
    else delete next.componentProps[key]
  }
  for (const key of new Set([...Object.keys(initial), ...Object.keys(draft)])) {
    if (protectedKeys.has(key) || ['visible', 'isLocked'].includes(key)) continue
    if (isEqual(initial[key], draft[key])) continue
    if (key in draft) next[key] = cloneDeep(draft[key])
    else delete next[key]
  }
  return next
}
