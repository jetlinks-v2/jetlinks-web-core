export type MatrixGridRowKind = 'group' | 'item'

export interface MatrixGridRow<T = unknown> {
  key: string
  kind: MatrixGridRowKind
  data: T
  depth?: number
}

export interface MatrixGridColumn<T = unknown> {
  key: string
  data: T
}

export interface MatrixGridColumnGroup<T = unknown> {
  key: string
  columnKeys: string[]
  data: T
}

export interface MatrixGridColumnGroupLayout<T = unknown> extends MatrixGridColumnGroup<T> {
  startColumn: number
  span: number
}

export interface MatrixGridRowSlotScope<TRow = unknown> {
  row: MatrixGridRow<TRow>
  rowIndex: number
}

export interface MatrixGridCellSlotScope<TRow = unknown, TColumn = unknown>
  extends MatrixGridRowSlotScope<TRow> {
  column: MatrixGridColumn<TColumn>
  columnIndex: number
}
