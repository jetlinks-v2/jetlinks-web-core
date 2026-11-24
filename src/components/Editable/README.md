# Editable 使用说明

轻量字段编辑器，按 type 切换输入框、数字框、选择器、日期和时间范围。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `value` | 字段值 | `unknown` | - |
| `type` | 编辑控件类型 | `string \| number \| select \| date \| time \| dateRange \| timeRange` | string |
| `componentProps` | 透传底层控件 props | `object` | {} |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:value` | 值变化 | `(value)` |
| `change` | 值提交 | `(value)` |

#### 方法

组件实例的 `edit(): Promise<void>` 进入编辑并聚焦控件，适用于新增后立即输入；禁用时不生效，聚焦保留容器滚动位置。

#### 用法

~~~vue
<Editable v-model:value="name" type="string" />
<Editable v-model:value="state" type="select" :component-props="{ options }" />
~~~

#### Rules

- 输入类控件在 blur 时提交，选择/日期类控件在 change 时提交。
- componentProps 只透传给对应 Ant Design Vue 控件。

`InputEditable` 保留默认图标编辑入口；`trigger="text"` 使用文字按钮直接进入编辑。两种入口均支持 Enter/失焦提交、Esc 取消和禁用状态。可选 `save(value): boolean | Promise<boolean>` 用于异步提交，返回 `false` 时保留草稿与编辑态，调用方通过 `error` 提供字段错误；未传 `save` 的既有调用仍通过 `update:value/change` 提交。`label` 提供输入和编辑入口的无障碍名称。

`Editable` 和 `InputEditable` 的文字输入随草稿增减宽度，保留原字体、字重、行高和基线；通过 `--inline-edit-max-width` 设置视觉宽度上限，默认不超过容器，不限制可提交的文字长度。阅读态 hover 显示浅底与细下划线，编辑态保留下划线，焦点和错误分别使用平台主题色。`InputEditable` 的 `action` 插槽接收 `value/editing/cancel`，焦点在输入与动作间移动时不提交，离开整个字段后才提交。

`I18nTextEditable` 复用上述输入与样式，短译名在就近面板编辑。语言选项和顶部语言菜单共用 `src/locales/languages.ts`；从文字输入进入多语言面板时接续未提交草稿，确认后统一发出值与翻译变更，取消或关闭不提交。缺失翻译仅以回退文案提示，不复制为已填写译文；保存保留未展示语言及其他字段的数据。`I18nTextField` 继续使用独立弹窗，适合表单和长文本。
