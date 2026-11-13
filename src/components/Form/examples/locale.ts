import { useI18n } from 'vue-i18n'

/** 示例宿主自己的文案与业务提示，不进入通用表单的布局协议。 */
export function useFormExampleLocale() {
  return useI18n({ useScope: 'local', messages: {
    zh: {
      eyebrow: '组件示例 / 信息页面', title: '把信息组织成易读的页面', description: '选择已有字段，调整展示，然后直接在页面中维护信息。', language: '页面语言', scene: '示例场景', object: '对象详情', workflow: '工作流申请', design: '设计', use: '使用', saveDraft: '保存草稿', restoreDraft: '恢复草稿', publish: '发布并查看', restricted: '限制敏感字段', revoke: '高度改为只读', readonly: '只读页面', failNext: '下次保存失败', layoutJson: '布局 JSON', applyJson: '应用布局 JSON', request: '设备检修申请', running: '运行中', pending: '待提交', objectContext: '环境监测 · A 区', workflowContext: '运维服务 · 日常维护', sampling: '每 {interval} 秒采样一次', interval: '采样间隔', seconds: '秒', cancel: '取消', confirm: '确认', payload: '查看本次提交数据', failed: '暂时无法保存，请重试', heightError: '安装高度不能小于 0', saved: '已保存', leave: '还有未保存的修改，确定离开吗？', draftSaved: '草稿已保存到本次示例会话', published: '布局已发布到本次示例会话', jsonStructure: '需要 version: 1 和 sections 数组', jsonFields: '请检查分区 id、名称和字段 key', jsonInvalid: 'JSON 格式不正确',
    },
    en: {
      eyebrow: 'Component example / Information page', title: 'Make information easy to read', description: 'Arrange available fields, adjust their appearance, and edit information in place.', language: 'Page language', scene: 'Example scenario', object: 'Object details', workflow: 'Workflow request', design: 'Design', use: 'Use', saveDraft: 'Save draft', restoreDraft: 'Restore draft', publish: 'Publish and view', restricted: 'Restrict sensitive fields', revoke: 'Make height read only', readonly: 'Read only page', failNext: 'Fail next save', layoutJson: 'Layout JSON', applyJson: 'Apply layout JSON', request: 'Device maintenance request', running: 'Running', pending: 'Pending', objectContext: 'Environmental monitoring · Area A', workflowContext: 'Operations · Routine maintenance', sampling: 'Sample every {interval} seconds', interval: 'Sampling interval', seconds: 'seconds', cancel: 'Cancel', confirm: 'Apply', payload: 'View submitted data', failed: 'Unable to save. Please retry.', heightError: 'Height must not be negative', saved: 'Saved', leave: 'You have unsaved changes. Leave this page?', draftSaved: 'Draft saved for this example session', published: 'Layout published for this example session', jsonStructure: 'Expected version: 1 and a sections array', jsonFields: 'Check section IDs, labels and field keys', jsonInvalid: 'Invalid JSON',
    },
  } })
}
