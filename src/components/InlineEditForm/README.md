# InlineEditForm

分组详情和首次填写共用的表单。详情默认展示已保存字段值，点击就地编辑；文本、密码与数字在 Enter / 失焦时提交，选项选择后提交，Esc 取消。字段不显示保存 / 取消按钮。复合编辑器可通过插槽提供的 `blur` 在焦点离开整个区域时提交，内部切换输入不提交；弹窗编辑器通过 `commit` 在其既有确认事件中提交。异步失败保留编辑值及控件错误状态，成功才关闭。详情态不在字段底部展示失败或加载文案；Select 使用自身 `loading`，其他控件保持提交锁定，首次填写仍保留字段校验提示。既有 `Editable` 的行为不变。

`index.vue` 组合分组和字段，`InlineEditField.vue` 组合 Ant Design 控件，`useInlineEditField.ts` 管理字段编辑生命周期，`types.ts` 定义无业务依赖的契约。通过 core 根入口或目录公开入口具名导入，不全局注册。通知渠道为首个接入方。

## 契约

| 输入 | 语义 |
| --- | --- |
| `groups` | `InlineEditGroup[]`，每组包含 `key/title/fields`；字段提供 `key/label/value/initialValue/editor`，以及可选约束、选项、提示、错误和布局属性 |
| `mode` | 默认 `detail`；`form` 始终显示控件，只同步草稿，由宿主统一保存 |
| `submit(key, value)` | 异步返回 `{ ok, error? }`；宿主负责业务校验、请求、更新已保存基线和回读 |
| `disabled` / `busy` | 权限或整体锁定；单字段提交时组件另有 pending 锁，防止 Enter、失焦重复请求 |
| `messages` | 已翻译的 `save/cancel/empty/saving/failed` 文案 |

字段值限 JSON 数据。`value` 是编辑草稿，`initialValue` 是已保存基线；详情展示后者。宿主收到 `change(key, value)` 后更新草稿，提交成功后同步两者。组件不会直接修改字段对象，不负责业务数据持久化；多个记录应使用记录 ID 作为表单 `key`。

`editor` 支持 `text/number/select/password/textarea/custom`；选项值为字符串或数字，其他后端类型由宿主转换。`fullWidth` 让字段占整行，默认两列、窄屏一列；详情态标签与提示使用较浅文字色，下拉文本和图标采用独立元素水平居中；`readonly` 仅展示。无变化不提交。取消恢复 `initialValue`，同时发出 `change` 和 `cancel(key)`，宿主可据此恢复关联字段。`focus(key)` 可联动帮助；实例方法 `editField(key)` 可打开关联编辑器，并遵循权限 / pending 锁。

密码使用 `editor: 'password'`、空的 `initialValue` 与 `secretSet`，只展示固定掩码。`value` 只能传编辑草稿，不能传已保存明文；密码留空不提交。凭据保留、掩码过滤和有效载荷合并仍由宿主负责。

`editor` 插槽仅用于 `custom` 字段，接收 `field/value/update/commit/cancel/blur/disabled/loading`；内部编辑器必须使用 `update` 回传，遵循 `disabled`，不能隐式请求或改写数据。复杂值以独立副本编辑；将 `blur` 绑定到复合编辑器根节点的 `focusout`，离开区域后整体提交。使用弹窗 / 浮层的编辑器应绑定自身完成事件到 `commit`，避免打开弹窗时误判为离开。`display` 插槽可按字段扩展只读内容；不要在插槽中泄露凭据。

## 接入示例

```vue
<template>
  <InlineEditForm
    :groups="groups" :messages="messages" :submit="submit"
    @change="(_, value) => draft = String(value)"
  />
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { InlineEditForm, type InlineEditGroup, type InlineEditMessages, type InlineEditSubmit } from '@jetlinks-web-core/components'

const props = defineProps<{ name: string; messages: InlineEditMessages; saveName: (value: string) => Promise<void> }>()
const draft = ref(props.name)
const saved = ref(props.name)
const groups = computed<InlineEditGroup[]>(() => [{
  key: 'basic', fields: [{ key: 'name', label: 'Name', value: draft.value, initialValue: saved.value }],
}])
const submit: InlineEditSubmit = async (_, value) => {
  await props.saveName(String(value))
  saved.value = draft.value = String(value)
  return { ok: true }
}
</script>
```

抛出的错误由组件转为 `messages.failed` 并保持控件错误状态；业务校验原因由宿主返回 `{ ok: false, error }`。详情态不额外渲染失败文本，首次填写可通过字段 `error` 展示校验原因。成功后的后续读取失败不应伪装成写入失败，宿主应单独提供读取重试，避免重复写入。

## 验证

`node --test tests/inlineEditForm.test.mjs` 覆盖显示语义、凭据掩码、无变化 / 取消、失败重试、重复保存、复杂值隔离、锁定、复合控件焦点边界、失焦重试、卸载后待执行失焦失效及旧响应失效，8/8 通过。`../node_modules/.bin/vue-tsc --noEmit -p tests/tsconfig.inline-edit-form.json` 独立严格类型检查通过。通知模块覆盖关联参数、权限、保存及首次配置；浏览器检查文本 / 选项 / 自定义字段、帮助联动和 1440px / 390px 布局。移除详情底部反馈后复跑上述测试与严格类型检查通过；隔离浏览器验证 Select 原生 loading、失败时保留输入与错误状态且无底部反馈文本，以及再次失焦重试成功。具体接入与验证边界见 `runtime-ui/modules/notify-manager-ui/README.md` 的“已配置渠道回显与就地保存”。
