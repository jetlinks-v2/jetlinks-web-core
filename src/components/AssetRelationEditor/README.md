# AssetRelationEditor

由维度所属模块显式注册的通用资产关系维护能力。复用现有 `moduleRegistry`、`assetDimensionFilters` 及原资产接口，业务模块之间无直接依赖。

```ts
import { assetRelationMaintainer } from '@jetlinks-web-core/components/AssetRelationEditor'

// 合入所属模块现有 register.ts 资源，不在本体模块注册具体维度。
const resources = {
  objectRelationMaintainers: { 'asset:org': assetRelationMaintainer },
  assetDimensionFilters: { org: organizationSelector }
}
```

来源在关系定义 `expands.maintenance` 中声明：

```json
{
  "provider": "asset:org",
  "assetType": "device",
  "assetIdProperty": "id",
  "dimensionType": "org"
}
```

宿主通过 `resolveObjectRelationMaintainer` 解析，传入 `ObjectRelationContext`：真实主体数据、关系身份和声明，可选已读直接目标 `targets`。targets 不表示完整绑定集合，组件不通过全量替换删除未选择的其他目标。重复注册同 provider 或缺少维度选择器时不提供该维护入口；有查询选择器不自动等于可写。

维护组件输出 `changed({ added? })`、`busy(boolean)`、`close`。宿主只承载原位面板、保护保存中的关闭、在 changed 后重新读取事实；added 是当前浏览端新增的对象ID，不能直接当作事实入图。可选 `summary` 接收边的 `attributes` 及 `compact`，只读显示来源权限名称；`editable(attributes)` 表达实例入口是否可编辑。本体宿主不解释资产权限字段。维护器的 `directions` 显式声明可维护方向，未声明时兼容仅正向；`ObjectRelationContext.reverse` 表示当前主体位于规范终点，不交换写入身份或建立反向关系副本。

正向沿用所属模块注册的维度选择器；反向固定当前维度对象，使用基础关系服务的来源对象分页目录选择资产对象，每页50条、虚拟滚动及服务端名称搜索。已关联核对通过同一规范关系的反向分页查询读取，额外保留本次待变更对象，不将已加载缓存冒充完整集合。绑定核验使用有界对象批次与 `$metadata.relations` 的实例链接，权限为空仍可证明绑定存在，owner和自定义角色保持原值；不按业务类型、显示名称或权限数量推断关系。资产ID由声明的 `assetIdProperty` 映射，新增、修改与解除仍调用原资产接口，`multiple` 仅约束每项资产的维度端，不限制反向资产集合。未加载或不可读取的对象不进入解除集合，失败继续保留草稿并禁止提交。

`GET /assets/settings/{assetType}/{dimensionType}` 决定单多选和权限编辑；details 回查已有绑定，新增用 bind、已有权限用 PUT permission、解除用 unbind。权限按目标独立，可显式复制到其他已选非 owner 目标；不自动授全部权限、不递归绑定下级。原资产入口校验调用者权限与目标范围，前端不另算有效权限。owner 只读，既有自定义 relation 保留，界面不提供任意角色修改。

查看权限的统一默认规则：沿用原资产管理页的行为，仅在 `permissionSupported=true` 且来源权限目录包含标准 `read` 时，新关联默认选择查看，不能通过权限选项取消。正反向共用同一草稿规则，权限复制及明确修改也保留该必选项；不按权限显示名判断，不向未声明查看的来源添加权限，不扩展后端协议或授权规则。已有绑定按真实权限读取，打开、撤销或仅新增其他绑定不隐式补权；历史缺少查看的绑定只在用户明确编辑或复制权限后形成待调整草稿，确认保存才写入。owner继续只读。`permissions.ts` 共用默认及必选规则，`useAssetRelationEditor.ts` 的 `setPermissions` 承接显式编辑与复制，`AssetBindingActions.vue` 仅按同一规则禁用已选查看；历史缺少查看时保留真实未选状态，仍可明确补选。

读取失败不能当作新绑定；失败保留草稿并显式重试，成功的部分及时刷新，卸载后忽略迟到响应。`attributes.relation` 是原绑定字段；`name` / `reverseName` 是来源显示提示，不能作为查询身份。原表同对对象只能一条绑定的约束不由前端放宽。

呈现沿用画布内的紧凑选择区：注册的维度组件在 `embedded` 状态提供搜索及候选，不重复呈现已选摘要。候选进入可见批次时批量读取真实绑定，最多50个目标一批，自动回显已有权限。未知状态不能当作未关联；不遍历整目录，不把未读目标加入解除集合。新增、权限调整和解除都先形成草稿；取消新目标只撤销添加，取消已有目标勾选标记待解除，并支持行内撤销。复制权限及解除收进更多菜单；底栏列出新增、调整、解除数量，无修改禁用确认，涉及解除时确认具体目标后提交差量。owner 仅展示锁及只读提示。浮层随上下文切换和读取/保存关闭，Esc 先关当前浮层并返回入口，再次Esc才关闭面板；样式使用现有主题token，不依赖本体或身份模块的样式选择器。

验证：`node --test tests/assetRelationEditor.test.mjs tests/assetRelationEditorPresentation.test.mjs tests/assetOwnershipCondition.test.mjs`。只读浏览器入口位于 `modules/jetlinks-ontology-ui/tests/browser/asset-binding.html`，读取真实 settings、组织树及已有绑定，拦截确认和解除点击，不向业务数据提交写入。

维度选择器可显式声明 `supportsOptionExtra: true`，提供 `option-extra({ option: AssetDimensionOption })` 插槽、`selectedOnly`、`reviewValues`、`focusValue` props，以及 `view-change`、`options-visible(ids)` 事件。选择器仅报告当前有界可见候选，不读取资产接口；reviewValues 包含待解除目标，供核对和撤销，focusValue 用于定位发起编辑的目标。资产编辑器将同一组权限/更多控件放入候选行，不再另列已选对象；底栏已选数量切换核对模式，返回全部恢复目录。选择器负责目录、路径及搜索呈现，视图变化时通知宿主关闭迟到浮层，不能解释权限字段。未声明此能力时保留原通用已选行。无需增加注册中心或按业务类型分支，原选择器的普通筛选模式不受影响。

权限浮层采用通用操作图标、来源名称和右侧勾选的36px整行选项，使用轻底色表达选中；底部弱化提示当前修改仍需确认保存。图标仅装饰read/save/delete/share，其他来源权限使用中性钥匙，不根据图标或名称计算授权范围。

完整可见性走查：修正 Ant 按钮默认8px相邻图标间距与摘要溢出隐藏叠加造成的数量裁切，摘要内图标与计数使用显式 flex 间距，并统一箭头间距；普通列表将操作区限制为行宽的60%，避免多项权限挤没对象名称。沿用原交互和权限契约。可视场景入口为 `modules/jetlinks-ontology-ui/tests/browser/asset-binding-scenarios.html`，在已有本地 Vite 服务中打开 `/@fs/` 下该文件的绝对路径即可访问；使用真实组件和本地数据，不请求或提交资产配置。点击“检查布局”核对摘要真实可用宽度、计数边界、箭头重叠、树行溢出和普通列表名称宽度，可复现原来的裁切问题。

本轮验证：54项core相关回归及15项组织树回归通过；格式、场景脚本语法检查及认证模块生产构建通过。浏览器覆盖280/320/400px宽度、零到四项及十四项权限、长名称、自定义权限、深层组织、owner、禁用、待新增/调整/解除、搜索、单选、普通列表、空目录、加载与失败重试；浅色中文和暗色英文的布局检查均无失败，`+1 / +2 / +12`完整可见。定向 `vue-tsc` 仍有197项共享依赖诊断，本轮修改的两个组件和组织树hook无诊断。真实工作台恢复后已复验：三项权限时摘要内容宽度与滚动宽度一致，`+1`位于箭头之前且无重叠；权限浮层及更多菜单Esc关闭后返回原按钮、保留面板；搜索无匹配正常显示空态，清空搜索保留草稿。已恢复用户原先仅选“前端测试B”、查看/编辑/删除三项权限且浮层打开的未保存状态，本轮未提交配置。

当前工作区、core与认证模块未配置lint脚本；本轮使用源码格式检查、Vue类型检查、组件回归和生产构建验证，未宣称全量类型检查通过。

局部呈现修正：权限摘要与选项复用同一图标映射；单目标操作由 `AssetBindingActions.vue` 承载，草稿、保存与浮层协调仍由编辑器负责。内嵌行使用 `presentation.compact`：名称与权限同一行，操作区固定112px；权限只显示前两个图标及剩余数量，完整来源名称保留在提示和原权限浮层中，未授予权限使用钥匙图标。待变更信息合并到撤销提示，待解除仍显示文字；权限、撤销和更多各占固定位置。普通已选列表保留图标加文字。此前真实浏览器已验证名称与权限垂直居中，勾选、四项权限和撤销前后名称坐标及44px行高一致，搜索无横向溢出；本轮补充验证与剩余限制见上文。
