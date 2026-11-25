# InlineEditForm

分组详情和首次填写共用的表单。详情默认展示已保存字段值，点击就地编辑；单行文本、密码与数字在 Enter / 整体失焦时提交，单选在控件确认后提交，Esc 取消。短字段不增加保存 / 取消按钮；多行文本保留显式操作。选择器弹层优先处理 Enter / Esc，不被字段键盘逻辑提前提交或关闭。复合编辑器可通过插槽提供的 `blur` 在焦点离开整个区域时提交，内部切换输入不提交；弹窗编辑器通过 `commit` 在其既有确认事件中提交。异步失败保留编辑值，就地显示一次失败原因，成功才关闭；宿主不再重复维护相同字段错误。Select 使用自身 `loading`，其他控件保持提交锁定。

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

`textarea` 在普通 Enter 时换行，Ctrl / Cmd + Enter 或保存按钮提交，Esc / 取消恢复保存基线，普通失焦保留草稿。首次录入仍由宿主统一提交。更多选择、日期、开关、复合字段与弹层的边界见 [原位编辑场景](../Editable/README.md#按场景选择提交边界)。

`editor` 支持 `text/number/select/password/textarea/custom`；选项值为字符串或数字，其他后端类型由宿主转换。`fullWidth` 让字段占整行，默认两列、窄容器一列；标签与提示沿平台次级文字语义；`readonly` 仅展示。无变化不提交。取消恢复 `initialValue`，同时发出 `change` 和 `cancel(key)`，宿主可据此恢复关联字段。`focus(key)` 可联动帮助；实例方法 `editField(key)` 可打开关联编辑器，并遵循权限 / pending 锁。

详情文字编辑复用 `Editable/inline-edit.css` 的 hover、下划线、焦点与错误样式，继承展示区的字体；输入宽度随草稿变化，通过 `--inline-edit-max-width` 限制视觉宽度，默认不超过字段容器。`form` 模式保留完整控件边框，自定义编辑器保留自身外观。

字段可设置 `editTrigger: 'manual'`，详情值以静态文本呈现，由宿主的独立编辑按钮调用 `editField(key)` 开启编辑；默认 `value` 保持点击值编辑。该选项仅改变触发入口，不改变保存、取消、失败保留、权限或首次填写行为。

手动入口已通过既有 8 项测试与独立严格类型检查；平台外观的浏览器验证覆盖静态值点击、外部按钮聚焦、Enter / 失焦保存、Esc 取消、失败重试、只读与首次填写，结果见 `../PlatformSettings/README.md`。

密码使用 `editor: 'password'`、空的 `initialValue` 与 `secretSet`，只展示固定掩码。`value` 只能传编辑草稿，不能传已保存明文；密码留空不提交。凭据保留、掩码过滤和有效载荷合并仍由宿主负责。

`editor` 插槽仅用于 `custom` 字段，公开类型为 `InlineEditEditorScope`，接收 `field/value/update/commit/cancel/blur/disabled/loading` 及 `inputId/labelId/describedBy/error`。将 `inputId` 通过控件公开 API 绑定到实际输入，使外部 label 可关联；帮助 / 错误关联用 `describedBy`，复合输入分别命名其子控件。不能仅给包装层传 aria-label 就认为内部控件已命名。

内部编辑器必须使用 `update` 回传，遵循 `disabled`，不能隐式请求或改写数据。复杂值以独立副本编辑；将 `blur` 绑定到复合编辑器根节点的 `focusout`，离开区域后整体提交。使用弹窗 / 浮层的编辑器应绑定自身完成事件到 `commit`，避免打开弹窗时误判为离开。`display` 插槽可按字段扩展只读内容；不要在插槽中泄露凭据。

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

抛出的错误由组件转为 `messages.failed`；业务校验原因由宿主返回 `{ ok: false, error }`。详情和首次填写均就地显示原因，首次填写也可通过字段 `error` 传入整体提交的校验结果。成功后的后续读取失败不应伪装成写入失败，宿主应单独提供读取重试，避免重复写入。

## 验证

`node --test tests/inlineEditForm.test.mjs` 检查显示、草稿隔离、失败恢复、锁定及生命周期。真实控件的标签、错误呈现和容器布局使用 [公共组件验收页](../../../tests/public-ui/README.md)，状态单测不替代浏览器验证。
