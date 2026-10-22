import { markRaw, shallowRef } from 'vue'
import i18n from '../../locales'
import AssetOwnershipCondition from './index.vue'
import { formatAssetOwnershipTerm } from './condition'
import type { AssetOwnershipDisplay } from './useAssetOwnershipCondition'
import type { ConditionFieldSchema, ConditionTerm } from '../ConditionFilter/types'
import type { AssetOwnershipOptions, AssetOwnershipTerm } from './types'

/** 将后端条件装入通用筛选字段；路由保存的是同一个标准条件对象。 */
export const toAssetOwnershipFilterTerm = (value: AssetOwnershipTerm, dataIndex = 'assetOwnership'): ConditionTerm => ({
  column: dataIndex, termType: 'eq', value, ...(value.type ? { type: value.type } : {}),
})

/** 只创建字段与转换函数，不查询 Context、候选或选中值。 */
export const createAssetOwnershipField = (
  options: AssetOwnershipOptions,
  field: { dataIndex?: string; title?: string } = {},
): ConditionFieldSchema => {
  const display = shallowRef<AssetOwnershipDisplay>({ context: options.context, labels: new Map() })
  const translate = (key: string, values?: Record<string, string>) => i18n.global.t(key, values || {})
  return {
    dataIndex: field.dataIndex || 'assetOwnership',
    title: field.title || translate('components.AssetOwnershipCondition.title'),
    search: {
      type: 'component',
      rename: options.column,
      optionPanel: { width: 360, hideTitle: true },
      termOptions: [{ value: 'eq', label: translate('components.AssetOwnershipCondition.is'),
        shortDescription: translate('components.AssetOwnershipCondition.is') }],
      components: markRaw(AssetOwnershipCondition),
      componentProps: {
        resumeOnMount: true,
        options: { ...options, allowClear: false },
        onDisplayChange: (value: AssetOwnershipDisplay) => { display.value = value },
      },
      formatValuePreview: value => formatAssetOwnershipTerm(value, options,
        display.value.context, display.value.labels, translate),
      handleTerms: record => {
        const term = record.value as AssetOwnershipTerm | undefined
        if (term === undefined) return undefined
        if (!term || term.column !== options.column || typeof term.termType !== 'string') {
          throw new Error(translate('components.AssetOwnershipCondition.invalid'))
        }
        // 不重建已有条件，保留当前编辑器不支持的闭包或关系语义；仅继承外层分组连接符。
        const { type: _type, key: _key, ...condition } = term
        return { ...condition, ...(record.type ? { type: record.type } : {}) }
      },
    },
  }
}
