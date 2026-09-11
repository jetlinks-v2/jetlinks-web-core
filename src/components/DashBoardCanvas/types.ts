import type { Component } from 'vue'

/** Grid coordinates are independent from a business component's pixel-based style. */
export interface DashboardGridItem {
  x: number
  y: number
  w: number
  h: number
  i?: string
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

export interface DashboardCanvasConfig {
  name?: string
  backgroundColor?: string
  backgroundImage?: { url?: string; fileId?: string }
  gridLayout?: {
    colNum?: number
    rowHeight?: number
    marginHorizontal?: number
    marginVertical?: number
    [key: string]: unknown
  }
  filter?: {
    hue?: number
    saturation?: number
    brightness?: number
    contrast?: number
    opacity?: number
    grayscale?: number
  }
  [key: string]: unknown
}

export interface DashboardWidgetProps {
  gridItem?: Partial<DashboardGridItem>
  style?: Record<string, unknown>
  [key: string]: unknown
}

/** BusinessAlarm's info object is preserved, including data, theme and root tooltip. */
export interface DashboardWidget {
  id: string
  type: string
  name?: string
  visible?: boolean
  isLocked?: boolean
  tooltip?: string
  componentProps: DashboardWidgetProps
  [key: string]: unknown
}

export interface DashboardWidgetDefaults {
  type: string
  name?: string
  componentProps: DashboardWidgetProps
  [key: string]: unknown
}

export interface DashboardValue {
  canvas: DashboardCanvasConfig
  components: DashboardWidget[]
}

/** Existing Config.vue receives activeComponent and emits change(value, key). */
export interface DashboardConfigEntry {
  name: string
  component: Component
  direct?: boolean
  inspector?: {
    dataComponent?: Component
    defaultData?: () => Record<string, unknown>
    embeddedKeys?: readonly string[]
    embeddedRootKeys?: readonly string[]
  }
}

export interface DashboardComponentDefinition {
  component: Component
  configs: readonly DashboardConfigEntry[]
  defaultConfig: DashboardWidgetDefaults
  groupId: string
  thumbnail?: string
  /** Grid size for components whose defaults only describe a big-screen pixel size. */
  defaultGridItem?: Partial<DashboardGridItem>
}

/** Supplied by the host; the canvas never scans or registers business modules. */
export interface DashboardCatalog {
  groups: readonly { id: string; name: string }[]
  components: Readonly<Record<string, DashboardComponentDefinition>>
}

export interface DashboardLayoutItem extends DashboardGridItem {
  i: string
  static?: boolean
}

export interface DashboardGridSettings {
  columns: number
  rowHeight: number
  margin: [number, number]
}
