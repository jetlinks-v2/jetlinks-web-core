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

- 单行文字 / 数字在 Enter 或焦点离开整个字段时提交；输入法确认不提交，Esc 取消。
- 单选 / 日期 / 时间及范围由底层控件的 `change` 确认最终值。弹层内移动焦点不退出，Enter 选择候选或日期，第一次 Esc 关闭弹层，随后 Esc 可取消字段编辑。
- Select 的 `multiple` / `tags` 模式保留整组草稿，候选浮层内的保存按钮或 Ctrl / Cmd + Enter 确认，取消 / Esc 回退；普通失焦不提交。编辑槽位使用单行文字摘要，标签、候选与确认动作不增加字段高度。
- componentProps 只透传给对应 Ant Design Vue 控件。

时间范围复用 Ant Design Vue 具名导出的 `TimeRangePicker`。范围控件有两个输入，宿主应通过其 `placeholder` 数组提供含业务上下文的起止名称；不能只凭外层的字段名称认为两个输入都已命名。可清空值的展示插槽应同时处理 `null` / `undefined`，不要直接对范围值调用 `join`。

选择器与日期 / 时间的阅读槽位预留同一尾部图标空间；数字槽位预留步进按钮空间，空文本保留可输入的最小槽位。阅读与编辑共用字体、字重、文字起点和垂直对齐，日期 / 时间范围使用相同分隔符及等宽数字，激活编辑不会将完整值压成半截或改变相邻字段的位置。候选面板沿用平台选项的 160px 最小可读宽度，并受视口边界约束，不随短值缩成窄条；普通选项仍保留原生虚拟滚动。图文选项继续使用 `SelectOption` 的布局。宿主显式传入的 `dropdownStyle/dropdownAlign/dropdownMatchSelectWidth` 仍优先。

键盘确认 / 取消后焦点回到编辑入口，普通失焦提交尊重新的焦点。默认将选择 / 日期浮层挂在编辑区域，`getPopupContainer` 仍可由调用者覆盖；公共浮层开关事件与会话校验共同避免误提交。销毁、取消或重新开始编辑后，旧会话的排队失焦不再提交。

`InputEditable` 保留默认图标编辑入口；`trigger="text"` 使用文字按钮直接进入编辑。两种入口均支持 Enter/失焦提交、Esc 取消和禁用状态。编辑值与已保存值不同时显示「已修改，尚未保存」图标；改回原值、保存成功或取消后消失，等待保存及保存失败时保留。可选 `save(value): boolean | Promise<boolean>` 用于异步提交，返回 `false` 或抛错均保留草稿与编辑态；调用方的 `error` 优先展示，否则使用通用失败信息。提交锁避免重复写入，销毁后的排队提交与迟到结果失效；不能由忽略回执推导服务器已撤销写入。未传 `save` 的既有调用仍通过 `update:value/change` 提交。`label` 提供输入和编辑入口的无障碍名称。

`Editable` 编辑期间由已接受的阅读内容继续占位；未确认草稿在原槽位内编辑，不横向撑开邻居，确认后的新值才参与阅读布局。`InputEditable` 的单行文字输入随草稿增减宽度，在 flex 容器内也按内容收缩；多行模式仍使用容器宽度。两者保留原字体、字重、行高和基线，通过 `--inline-edit-max-width` 设置视觉宽度上限，默认不超过容器，不限制可提交的文字长度。阅读态 hover 显示浅底与细下划线，编辑态保留下划线，焦点和错误分别使用平台主题色。`InputEditable` 的 `action` 插槽接收 `value/editing/cancel`，焦点在输入与动作间移动时不提交，离开整个字段后才提交。

`I18nTextEditable` 复用上述输入与样式，短译名在就近面板编辑，手机使用底部面板；共享 `I18nTextDialog` 同样适配手机。一次编辑期间保持打开时的容器类型，尺寸切换不重建编辑器或丢失草稿，关闭后再次打开才采用新尺寸对应的容器。语言选项和顶部语言菜单共用 `src/locales/languages.ts`；从文字输入进入多语言面板时接续未提交草稿，确认后统一发出值与翻译变更，取消或关闭不提交。缺失翻译仅以回退文案提示，不复制为已填写译文；保存保留未展示语言及其他字段的数据。`I18nTextField` 继续使用独立弹窗，适合表单和长文本。

`InputEditable` 和 `I18nTextEditable` 的 `textarea` 默认关闭；开启后按段落阅读，编辑保持内容区宽度及原有字体，高度随内容增长至 `--inline-edit-max-height`（默认 16rem）后内部滚动。Enter 换行，Ctrl / Cmd + Enter 或就近的保存按钮提交，Esc / 取消恢复基线，普通失焦保留草稿。多语言编辑仍共享同一会话，切换语言不提交。

## 按场景选择提交边界

| 场景 | 确认与取消 |
| --- | --- |
| 短文字、数字片段 | Enter / 整体失焦提交；Esc 取消；步进按钮属于同一字段 |
| 单选、日期、时间及范围 | 使用原生控件确认事件；浮层的 Enter / Esc 优先属于控件 |
| 多选、标签、长文本 | 明确保存 / 取消，Ctrl / Cmd + Enter 快捷保存；失焦保留草稿 |
| Switch、Radio 等原子选择 | 经业务契约允许时，在已确认的 change 中提交；键盘行为由原控件负责 |
| 复合输入 | 内部移动焦点不提交；宿主选择整体失焦或显式确认，并对整个值校验 |
| 宿主自定义的文件、头像、图标、日期对话框 | 浏览、选择与临时预览不等于保存；在控件既有确认事件中提交，取消不改保存基线 |
| 多语言 | 按整组校验和提交；切换语言不保存，确认期间锁定输入，取消使迟到校验失效 |
| 首次录入 / 整表提交 | 使用正常表单或 `InlineEditForm mode="form"`，字段变化只更新草稿 |

设计依据：[Atlassian Inline edit](https://developer.atlassian.com/platform/forge/ui-kit/components/inline-edit/) 支持自定义输入、显式确认 / 取消和失焦保留编辑；[APG Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) 与 [Date Picker Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) 定义候选 / 日期确认、取消和焦点归还。上表结合平台既有契约选取提交边界，不表示文献要求所有字段统一自动保存。

文件、头像、图标和业务对象选择不属于 `Editable` 的内置类型，应通过宿主现有控件或 `InlineEditForm` 的 `custom` 插槽接入。选择资源与上传、持久化、权限验证是不同环节；本地弹窗示例不能证明这些服务已接通。场景入口、验证动作及未覆盖边界见[公共组件示例覆盖表](../../../tests/public-ui/README.md#原位编辑场景覆盖)。
