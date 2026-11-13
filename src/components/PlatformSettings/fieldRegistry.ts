import type { RegistryAction } from '@jetlinks-web-core/types/module'

// These identifiers are persisted in module registrations; keep their spelling and case.
export const BASIS_FORM_PAGE_CODE = 'system/Basis'
export const BASIS_FORM_MODULE_CODE = 'form-fields'
export const BASIS_FORM_FIELD = {
  BASE_PATH: 'base-path', RECORD_NUMBER: 'showRecordNumber', BACKGROUND: 'background', ICO: 'ico',
} as const
export type BasisFormFieldKey = typeof BASIS_FORM_FIELD[keyof typeof BASIS_FORM_FIELD]
export interface BasisFormFieldAction extends RegistryAction {
  /** 在消费字段时判断，避免模块注册早于登录身份加载。 */
  shouldHide?: () => boolean
}
export const createHiddenBasisFormFields = (fields: BasisFormFieldKey[], shouldHide?: () => boolean): BasisFormFieldAction[] => fields.map(field => ({
  targetPage: BASIS_FORM_PAGE_CODE, targetModule: BASIS_FORM_MODULE_CODE,
  target: field, mode: 'hide', code: `hide-basis-${field}`, shouldHide,
}))

/** 配置行渲染与保存过滤使用相同的隐藏条件，其他扩展保持原行为。 */
export const resolveBasisFormFieldActions = (actions: readonly BasisFormFieldAction[]): BasisFormFieldAction[] =>
  actions.filter(action => action.mode !== 'hide' || action.shouldHide?.() !== false)
