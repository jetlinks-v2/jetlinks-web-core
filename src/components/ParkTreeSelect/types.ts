export type ParkTreeValue = string | number
export type ParkTreeModelValue = ParkTreeValue | ParkTreeValue[] | undefined

export interface RawParkTreeNode {
  id?: string
  key?: string
  name?: string
  type?: string
  orgId?: string
  parkId?: string
  children?: RawParkTreeNode[]
  [key: string]: unknown
}

export interface ParkTreeNode {
  title: string
  value: string
  key: string
  selectable: boolean
  disabled: boolean
  type?: string
  raw: RawParkTreeNode
  children?: ParkTreeNode[]
}
