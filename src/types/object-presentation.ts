import type { Component } from 'vue'

/** An owning module supplies the complete authorized hierarchy, never inferred from graph relations. */
export interface ObjectDirectoryNode {
  id: string
  name?: string
  children?: ObjectDirectoryNode[]
  [key: string]: unknown
}

export interface ObjectDetailPresentationProps {
  object: { id: string; [key: string]: unknown }
  typeId: string
}

/** Read-only record content; the host retains querying, selection, navigation and tracing. */
export interface ObjectRecordPresentationProps {
  record: { id: string; [key: string]: unknown }
  typeId: string
  subject: { typeId: string; id: string }
  mode: 'list' | 'detail' | 'expanded'
  expanded?: boolean
}

/** Business modules contribute compact object fields; consumers own loading and layout. */
export interface ObjectPresentationField {
  key: string
  label: () => string
  order?: number
  icon?: string
  display?: 'status' | 'metric' | 'text' | 'context'
  /** Summary is the default; only detail/both fields contribute additional inspector content. */
  surface?: 'summary' | 'detail' | 'both'
  property?: string
  query?: { capability: string; subjectKey: string; valueKey: string }
  format?: (value: unknown) => { text: string; tone?: 'success' | 'warning' | 'error' | 'neutral' }
  /** Optional business navigation, supplied by the owning module. */
  open?: (object: { id: string; [key: string]: unknown }) => void
}

export interface ObjectPresentation {
  typeId: string
  fields: ObjectPresentationField[]
  /** Secondary directory text from the authorized row; an empty result hides the subtitle. */
  directorySubtitle?: (object: { id: string; [key: string]: unknown }) => string | undefined
  directory?: { mode: 'tree'; load: () => Promise<ObjectDirectoryNode[]> }
  detail?: {
    component: Component<ObjectDetailPresentationProps>
    available?: (object: { id: string; [key: string]: unknown }) => boolean
  }
  /** Execution tracing is opt-in; it never qualifies an otherwise empty inspector. */
  lineage?: boolean
  /** Owning-module content for derived records, with a fixed virtual row height. */
  record?: {
    component: Component<ObjectRecordPresentationProps>
    itemHeight?: number
    /** False when the compact record already contains its useful facts; host actions stay available. */
    expandable?: boolean
  }
  /** Business home for an object; consumers expose this as an explicit navigation action. */
  open?: (object: { id: string; [key: string]: unknown }) => void
}
