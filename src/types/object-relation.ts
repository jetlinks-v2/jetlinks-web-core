import type { Component } from 'vue'

/** 来源声明维护入口；扩展参数由对应维护组件解释，宿主不执行来源业务规则。 */
export interface ObjectRelationMaintenance {
  provider: string
  [key: string]: unknown
}

export interface ObjectRelationContext {
  subject: { typeId: string; id: string; name: string; data: Record<string, unknown> }
  relation: { id: string; name: string; targetType: string }
  maintenance: ObjectRelationMaintenance
  /** 当前主体位于规范关系的终点；方向只影响浏览和维护上下文，不交换事实身份。 */
  reverse?: boolean
  /** 已由宿主读取的直接目标，仅用于初始化编辑草稿，不代表完整集合。 */
  targets?: string[]
  /** 从具体关系进入维护时的目标，仅用于定位，不代表完整绑定集合。 */
  target?: string
}

/** 已由来源成功保存的增量；宿主按原关系重读，不把草稿作为事实。 */
export interface ObjectRelationChange {
  added?: string[]
}

/** 注册到 objectRelationMaintainers。组件输出 changed(change?)、busy(boolean)、close。 */
export interface ObjectRelationMaintainer {
  component: Component
  /** 未声明时仅支持规范正向；反向维护必须由来源能力显式开放。 */
  directions?: readonly ('forward' | 'reverse')[]
  /** 接收 attributes 和可选 compact；关系属性归提供方解释。 */
  summary?: Component
  /** 对某条实例是否提供直接编辑；维护及最终授权仍由来源执行。 */
  editable?: (attributes?: Record<string, unknown>) => boolean
  available?: (declaration: ObjectRelationMaintenance, reverse?: boolean) => boolean
}
