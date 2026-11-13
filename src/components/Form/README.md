# 通用信息页面：FormRenderer / FormDesigner

同一份布局用于设计、阅读与原位编辑。字段声明、页面布局、业务值和当前用户能力分开传入；组件不认识实体、动态字段、租户、流程变量、API或数据字典。需要更复杂的内容时由宿主提供插槽，不构建自由画布或第二套表单引擎。

## 接入

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FormRenderer, FormDesigner } from '@jetlinks-web-core/components/Form'
import type { FormField, FormLayout, FormSubmit } from '@jetlinks-web-core/components/Form'

const fields: FormField[] = [
  { key: 'name', label: '名称', type: 'text', required: true },
  { key: 'extension.height', label: '高度', type: 'number', unit: 'm' },
]
const layout = ref<FormLayout>({ version: 1, sections: [
  { id: 'basic', label: '基本信息', items: [{ key: 'name' }, { key: 'extension.height', digits: 1 }] },
] })
const values = ref({ name: '示例对象', 'extension.height': 12.523345 })
const submit: FormSubmit = async changes => {
  // 宿主在此将不透明字段key映射成自己的请求结构，成功后可刷新values。
  await saveInformation(changes)
}
</script>

<template>
  <FormRenderer :fields="fields" :layout="layout" :values="values" :submit="submit" />
  <!-- 设计页独立使用，不能与实际业务编辑共用值写入流程。 -->
  <FormDesigner v-model:layout="layout" :fields="fields" :sample-values="values" />
</template>
```

也可从 `@jetlinks-web-core/components` 具名导入。`FormDesigner` 为异步组件，未全局注册；渲染器不主动下载设计器。现有 Editable、MetadataValueItem、KvGrid 等组件默认行为不变。

## 数据契约

| 输入 | 语义 |
| --- | --- |
| `fields: FormField[]` | 宿主提供稳定且唯一的key、展示名称、类型、单位、必填/只读和已解析选项。元数据转换、字典查询由宿主完成。 |
| `layout: FormLayout` | `version: 1`、分区 `id/label/items`；item引用字段key，配置名称覆盖、单双列、配色与显示格式。不要放实际值或会话权限。 |
| `values: FormValues` | 按字段key索引的当前值；包含点号的key仍是一个完整key。宿主负责来源投影和提交映射。 |
| `access?: FormAccess` | 每次会话的 `write/read/denied/hidden`；未声明时遵从字段能力。不能通过布局提高权限。 |
| `readonly?: boolean` | 整页只读；进入只读或撤权清理不可写草稿。 |
| `validate?: FormValidate` | 同步纯函数返回错误文字或undefined；必填使用组件基础规则，不另建校验语言。 |
| `submit?: FormSubmit` | Promise回调，只接收已确认且可写的差异；未提供时仍可本地试填并消费change，默认保存按钮不显示。 |

内置类型：`text/textarea/number/date/datetime/enum/boolean`；复杂JSON、图片、图表、关系选择等使用 `custom` 与宿主插槽。数值为空时提交null；多选为空时提交[]。`0/false/''/null/[]` 保留各自语义，未修改字段不进入差异。日期值为 `YYYY-MM-DD`，日期时间编辑产生本地 `YYYY-MM-DDTHH:mm:ss`；时区和其他日期协议由宿主适配。超过JavaScript安全精度的数字请声明为text或自定义编辑器。选项只支持string/number/boolean，按原类型稳定值匹配；未知选项保留到用户明确移除。

字段key和分区id须唯一，布局为可信的已校验配置，不提供任意JSON或脚本执行能力。字段定义失效的引用暂不渲染，布局本身保留引用。发布、版本管理、配置持久化、路由离开确认和跨对象切换属于宿主。

## 编辑与提交

操作与反馈：保存/撤销与修改数量、失败/校验反馈共用一行，不为空反馈单独预留24px；桌面36px、手机主要操作44px，首分区上留白12px。错误仍在原区域出现，避免额外挤动后续内容；不改变草稿、保存和actions插槽协议。

- 点击值原位编辑，首次光标在末尾，单行宽度按内容增长并限制在本字段内；单位、标签与邻近区块保持位置。名称也在画布中改，属性面板不重复提供名称输入框。
- 单行Enter或失焦确认到本地草稿，Tab确认并进入前/后一项，Esc取消本次激活；IME组词期间Enter不确认。长文本Enter换行，Ctrl/Command+Enter确认。枚举和布尔在桌面Popover、手机底部Drawer中集中确认；日期复用Ant DatePicker单层面板，日期选定即回填，日期时间沿用内置确认。手机日期面板在视口底部承载、内部滚动，不另写日历或日期/时间输入。
- 修改标记和单项还原始终保持轻量、固定尺寸。统一保存；失败保留草稿，保存中禁用冲突操作。`submit`可返回 `{ values }` 接受规范化字段值，或 `{ errors: { [key]: message } }` 保留草稿并展示字段错误；整体错误直接reject。
- `change(changes)`报告已确认差异，`dirty-change(boolean)`包括当前尚未确认的输入；`saved(values)`报告本次接受的可读值。宿主刷新时保留本地差异，`external-change(keys)`报告被外部更新影响的字段，组件不静默覆盖或实现通用冲突合并。
- 同一记录内刷新values即可；切换记录/流程上下文使用Vue `:key` 新建会话。组件忽略卸载后的异步结果，但不会取消宿主请求；宿主仍应负责请求取消或业务上下文检查。
- `denied`显示“无查看权限”，`hidden`不渲染，两者都不调用值/编辑插槽。后端负责授权和过滤无权值及不可公开字段定义；前端展示状态不是安全边界。设计器只接收当前配置者可以使用的字段目录。

## 插槽

| 插槽 | 用途 |
| --- | --- |
| `header` | 宿主概要、图片、图表和业务动作。 |
| `actions`（渲染器） | `{ changes, dirty, saving, save, restore }`，可把保存命名为提交或嵌入工作流动作。 |
| `value-{renderer或key}` | `FormValueSlot`：`field/item/value`。readonly字段仍可使用自定义展示。 |
| `editor-{renderer或key}` | `FormEditorSlot`：增加`update(value)/confirm()/cancel()`；必须先update草稿，再confirm。未提供编辑器的custom字段只展示。 |

Vue组件、插槽与函数属于宿主，JSON只引用稳定key；不要把组件、脚本或API写入布局。宿主自己的复杂编辑器也应使用同一轻量动作样式，不在值槽中嵌入整套传统表单。

## 编排与移动端

配置交互：重整展示候选卡与少量模式切换，数值/日期下拉显示实际样例；枚举/布尔共用带右侧选中标记的候选面板，保留原类型值、键盘和手机底部确认；修正使用禁用色显示普通文字的问题。日期直接使用Ant DatePicker的原位输入和单层浮层，年/月切换、解析、键盘和本地化交由控件，不自行组装日历与日期/时间输入。依据[Ant Design数据录入](https://ant.design/docs/spec/data-entry/)与[DatePicker交互说明](https://ant.design/components/date-picker/)选择交互，实际API按本仓库Ant Design Vue版本使用。设置下拉采用控件原生宽度和右侧对齐，避免CSS强制最小宽度与定位计算不一致。沿用现有Canvas、FormValue与Ant控件，不新增选择引擎、不改变字段/布局协议。

内容编辑入口紧跟值，移除整栏悬停底色；原位输入按实际文字测量宽度、单位紧随，超过字段边界后输入内部滚动。阅读态长文字完整换行。数字显示与输入均使用26px行高，避免基线撑高；示例安装高度默认使用原始精度，不预设1位小数。显式配置小数位仍只改变显示，编辑和提交始终使用原值。

区块设计态由FormCanvas统一承载：浅蓝细边框、极浅主题色底色、完整区块点击选择，以及右上角工具槽的位置、显隐和响应式尺寸。FormDesigner只注入拖动、配置、移除动作和选择状态，不另写选中描边或独立区块组件。设计态固定留白与负外边距抵消，选中/未选中时内容位置一致；运行态不启用设计样式，不显示工具槽。工具条仅选中时提供移除动作，长名称预留工具空间，手机按钮44px；工具条操作不冒泡触发区块选择或名称编辑。

字段库点选/拖入、分区、单双列、左右/上下/跨区拖动、移出页面和最多20步撤销。移除入口仅保留选中区块工具条，设置面板不重复提供底部操作区及说明。拖动越过阈值后才开始，放下不触发编辑。触屏仅手柄启动拖动，常规滑动保留滚动；也可在手机面板中逐项移动和切换分区。键盘Alt+方向键调整顺序，Delete移出页面。移除不会删除字段定义和值。

布局缩略选项、类型配置和颜色按需出现；桌面浮层与手机底部面板覆盖画布，打开配置不改变字段布局。按钮统一圆角与字体；保存/发布为主动作，编排工具和取消为文字动作，字段还原徽标保持固定尺寸。手机单列、面板内部滚动、触屏主要动作至少44px；不是将桌面表单简单缩窄。

枚举由字段定义决定单选/多选，布局`editor`支持`auto/list/tags`，自动模式在选项不超过5项时使用标签；显示可选择文字/标签。`optionColors`按原类型的稳定value绑定，清除覆盖即继承宿主选项颜色；布尔状态同样支持true/false配色。数字的精度、千分位、单位和日期格式仅影响显示，不改变提交值。

## 配置文案国际化

字段、选项、分区和布局项复用`I18nMessages`，普通字符串继续可用。字段名称、说明、单位、选项名称由宿主提供，设计器只修改分区名和布局展示名称，不回写字段定义。

```ts
const field: FormField = {
  key: 'maintenance.height', label: '安装高度', type: 'number', unit: 'm',
  i18nMessages: {
    label: { zh: '安装高度', en: 'Installation height' },
    description: { en: 'Height above ground' },
    unit: { en: 'm' },
  },
}
// 布局只保存明确覆盖，其他语言继续继承原字段。
const item = { key: field.key, i18nMessages: { label: { en: 'Mounting height' } } }
```

解析顺序为区域语言、主语言、默认字符串；空白翻译视为未配置。布局名称按“当前语言覆盖 → 布局默认label → 字段本地化名称”解析。字段库、画布、说明、单位、选项、设置预览、移动分区候选及无障碍名称共用此规则。实际值、字段key、选项value和提交payload不随语言改变；自定义插槽及概要内部文案仍由宿主维护。

名称旁的地球图标打开语言页签、当前译文和即时预览；手机改为底部面板，主要动作至少44px。原位改名只更新激活时的语言，切换页面语言先按原语言确认输入。翻译面板切语言保留草稿，取消不回写，应用一次写入布局历史；清空覆盖恢复继承，撤销恢复此前配置，没有变化时不新增历史。默认翻译只用于占位与预览，不复制进布局；关闭后焦点归还触发入口。共享对话框保留既有事件和长度校验，提供中英文并保留其他已有语言；不接自动翻译服务或新增语言管理系统。

名称编辑交互：字段与分区名称统一采用弱悬停下划线和主题色编辑下划线，线条画在输入框内部，避免被自适应容器裁掉。国际化入口仅在当前名称获得焦点时显示，保留占位避免名称宽度和邻项跳动；使用透明度保留键盘和弹窗返回焦点，收起时不响应指针。键盘Tab与触屏点击同样可达，不依赖hover打开。该调整限定在FormDesigner，不改变共享I18n入口在其他页面的显隐；图标默认使用语义次级文字色，hover或键盘焦点时强调。名称确认/取消及翻译继承继续使用已有布局状态，没有新增编辑状态或延时。

主要实现：`text.ts`集中解析，`useFormDesigner.ts`管理名称与翻译布局历史，`../I18n/text.ts`提供通用语言解析/更新，`../I18n/I18nTextDialog.vue`及其hook承载共享翻译交互。

## 示例与验证

`examples/FormWorkspaceExample.vue`直接引用两个公开组件，包含对象详情/工作流、本地草稿/模拟发布、布局JSON往返、只读/拒权/隐藏、自定义采样控件、失败重试与业务payload映射。没有第二套HTML渲染器或后端依赖。

在runtime-ui目录：

```sh
pnpm -F jetlinks-web-core dev:form
pnpm -F jetlinks-web-core test:form
pnpm -F jetlinks-web-core build:form
```

入口：`http://127.0.0.1:8767/tests/form-workspace-preview.html`。示例的草稿和发布只在本次页面会话中生效。
