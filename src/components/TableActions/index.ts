import TableActionsComponent from './TableActions'
import TableActionsItem from './TableActionsItem'

/** 同时支持具名子项和 Vue 模板中的 TableActions.Item 组合写法。 */
const TableActions = Object.assign(TableActionsComponent, { Item: TableActionsItem })

export default TableActions
export { TableActions, TableActionsItem }
export type { TableActionsItemProps, TableActionsItemSlotScope, TableActionsPlacement } from './types'
