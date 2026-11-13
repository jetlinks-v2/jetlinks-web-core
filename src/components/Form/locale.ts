import { useI18n } from 'vue-i18n'
import { formLabel, formText } from './text'
import type { FormField, FormLayoutItem } from './types'

const messages = {
  zh: {
    checkList: '勾选列表', optionList: '选项列表', tagSelection: '标签选择', segmentedOptions: '分段选项', numberFormat: '数值格式', precisionDigits: '{count} 位小数', configureColor: '配置{label}的颜色', blue: '蓝色', green: '绿色', orange: '橙色', red: '红色', purple: '紫色', neutral: '灰色', searchOptions: '查找选项', noOptions: '没有匹配的选项', time: '时间',
    invalidNumber: '请输入有效数字', rename: '在画布中改名', clear: '清空', editor: '编辑方式', list: '列表', paragraph: '段落',
    empty: '未填写', denied: '无查看权限', edit: '编辑{label}', cancel: '取消', confirm: '确认', save: '保存', undo: '撤销修改', changed: '已修改', restore: '还原', restoreField: '还原{label}的修改', dirty: '已修改 {count} 项', required: '请填写此项', failed: '保存失败，请重试', yes: '是', no: '否', customReadonly: '此字段未提供编辑器',
    addField: '加入字段', addSection: '新增分区', newSection: '新分区', design: '编排', preview: '试用', undoLayout: '撤销编排', close: '关闭', settings: '展示设置', label: '展示名称', width: '占用宽度', half: '半行', full: '整行', appearance: '展示方式', auto: '自动', text: '文字', tags: '标签', digits: '小数位数', sourcePrecision: '原始精度', thousands: '千分位', showUnit: '显示单位', dateFormat: '日期格式', readonly: '仅查看', options: '选项配色', inherit: '默认', remove: '移出页面', removeHint: '不会删除字段和值', emptySection: '拖入或加入字段', move: '移动', previous: '前一项', next: '后一项', section: '所在分区', noFields: '所有字段已加入', drag: '拖动{label}，Alt + 方向键调整顺序', removeSection: '移除空分区', nothing: '暂无内容', more: '更多设置', type_text: '文本', type_textarea: '长文本', type_number: '数字', type_date: '日期', type_datetime: '日期时间', type_enum: '单选', type_multiple: '多选', type_boolean: '布尔', type_custom: '自定义',
  },
  en: {
    checkList: 'Checklist', optionList: 'Option list', tagSelection: 'Tags', segmentedOptions: 'Segments', numberFormat: 'Number format', precisionDigits: '{count} decimals', configureColor: 'Set color for {label}', blue: 'Blue', green: 'Green', orange: 'Orange', red: 'Red', purple: 'Purple', neutral: 'Gray', searchOptions: 'Find an option', noOptions: 'No matching options', time: 'Time',
    invalidNumber: 'Enter a valid number', rename: 'Rename on canvas', clear: 'Clear', editor: 'Editor', list: 'List', paragraph: 'Paragraph',
    empty: 'Not provided', denied: 'Access restricted', edit: 'Edit {label}', cancel: 'Cancel', confirm: 'Apply', save: 'Save', undo: 'Discard changes', changed: 'Changed', restore: 'Restore', restoreField: 'Restore changes to {label}', dirty: '{count} changed', required: 'This field is required', failed: 'Save failed. Please retry.', yes: 'Yes', no: 'No', customReadonly: 'No editor provided',
    addField: 'Add field', addSection: 'Add section', newSection: 'New section', design: 'Design', preview: 'Try it', undoLayout: 'Undo layout', close: 'Close', settings: 'Display settings', label: 'Display name', width: 'Width', half: 'Half row', full: 'Full row', appearance: 'Appearance', auto: 'Automatic', text: 'Text', tags: 'Tags', digits: 'Decimal places', sourcePrecision: 'Original precision', thousands: 'Thousands separator', showUnit: 'Show unit', dateFormat: 'Date format', readonly: 'Read only', options: 'Option colors', inherit: 'Default', remove: 'Remove from page', removeHint: 'Field definitions and values are retained', emptySection: 'Drop or add fields', move: 'Move', previous: 'Previous', next: 'Next', section: 'Section', noFields: 'All fields have been added', drag: 'Drag {label}; Alt + arrow keys to reorder', removeSection: 'Remove empty section', nothing: 'No content', more: 'More settings', type_text: 'Text', type_textarea: 'Long text', type_number: 'Number', type_date: 'Date', type_datetime: 'Date and time', type_enum: 'Single choice', type_multiple: 'Multiple choice', type_boolean: 'Boolean', type_custom: 'Custom',
  },
}

/** 局部文案跟随宿主 locale，不向全局 i18n 注入消息。 */
export function useFormLocale() {
  const composer = useI18n({ useScope: 'local', messages })
  return { ...composer,
    text: (source: Parameters<typeof formText>[0], property: Parameters<typeof formText>[1] = 'label') => formText(source, property, composer.locale.value),
    label: (field: FormField, item: FormLayoutItem) => formLabel(field, item, composer.locale.value),
  }
}
