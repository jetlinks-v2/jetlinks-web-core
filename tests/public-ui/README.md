# 公共阅读与编辑组件验收

使用真实 Vue、Ant Design Vue、AIcon、平台样式及公共组件，不访问后端。它是隔离宿主，不代表完整生产 Provider 和业务权限已验证。

从仓库根目录运行：

```sh
node --test tests/inlineEditForm.test.mjs tests/inlineEditing.test.mjs tests/publicUiExamples.test.mjs
node --test tests/workspacePanels.test.mjs
node --test tests/responsivePanel.test.mjs tests/responsiveSplitter.test.mjs tests/basicProfileSave.test.mjs
node tests/check-workspace-panels.mjs tests/tsconfig.public-ui.json
node_modules/.bin/vite build --config tests/public-ui/vite.config.mjs --configLoader runner
node_modules/.bin/vite --config tests/public-ui/vite.config.mjs --configLoader runner
```

访问 `http://127.0.0.1:9521/`。保持宽窗口并切换内容容器，核对详情动作及录入列数随容器重排；数组与 slot 字段应具有一致样式。详情编辑分别选择成功、返回字段错误、抛出异常，检查错误只显示一次、输入保留、Esc 取消及重试；用键盘选择负责人，核对实际 combobox 的标签。候选含说明，收起标签保持短名称。折叠入口优先融入主区头部，左区搜索独立；收起后左列归零，入口、焦点及输入保留遵循公共布局契约。

这是本地模拟页，保存不访问后端，刷新后恢复。字段请求次数包含失败，不代表成功写入。`Editable` 只提交值，`InputEditable save` 和详情模式模拟单字段请求，首次录入及通用 Form 的字段确认只进入各自草稿，整表动作才接受保存；这些示例不共用记录状态。只读和禁用演示的是客户端行为，不能作为服务端权限证据。不得输入真实凭据。

## 原位编辑场景覆盖

以下按公开类型和提交边界组织；自定义控件是开放扩展点，不能以少量示例宣称覆盖所有业务控件。表中的自动化测试证明其列出的范围，真实控件的键盘、弹层、焦点、清空和窄屏行为仍需浏览器验收。

| 场景 | 可操作示例 | 核验要点与自动化入口 |
| --- | --- | --- |
| 单行文字、空值、零值、数字 | “行内片段”“选择与日期”的补充短句、采样偏移 | Enter / 整体失焦、Esc、IME；`inlineEditing.test.mjs`，示例从空字符串和 0 开始 |
| 图标入口、异步成功 / 失败 / 异常 / 等待 | “等待、失败与重试”的点位别名 | 输入后主动返回模拟结果，锁定、失败保留、成功才接受；`inlineEditing.test.mjs`、`publicUiExamples.test.mjs` |
| 多行 | “说明与多语言”“处理说明”“处理说明草稿” | 失焦保留、Enter 换行、Ctrl / Cmd + Enter 或按钮确认、取消；`inlineEditing.test.mjs`、`inlineEditForm.test.mjs` |
| 单选 | 任务分组、处理优先级、负责人 | 显示 label、保存 value；先关弹层再取消编辑；`inlineEditing.test.mjs`、`inlineEditForm.test.mjs` |
| 多选、可新增标签 | 可见分组、检索标签 | 草稿与已接受值分离，明确保存 / 取消；两种模式均在 `inlineEditing.test.mjs` 覆盖 |
| 日期、时间、日期范围、时间范围 | 执行日期、执行时间、统计周期、处理时段 | 原生完整选择、取消、清空后仍能重开；`inlineEditing.test.mjs` 验证确认事件边界，`publicUiExamples.test.mjs` 覆盖范围清空回显 |
| 密码 | 示例访问凭据 | 仅虚构值；固定掩码、空值不提交、确认后清空草稿、不保存明文；`inlineEditForm.test.mjs`、`publicUiExamples.test.mjs` |
| 原子布尔 / 单选 | 接收处理提醒、提醒方式 | 表示偏好，不代表执行命令；一次 change 一次提交，保留原控件键盘语义；`inlineEditForm.test.mjs` |
| 复合值 | 有效范围 | 两输入间移动不保存，离开整体后校验，失败保留；`inlineEditForm.test.mjs`、`publicUiExamples.test.mjs` |
| 自定义确认弹窗 | 巡检对象 | 选择仅改草稿，取消恢复原对象，确认才保存；基础 custom 会话由 `inlineEditForm.test.mjs` 覆盖，真实 Modal 链路需浏览器验证 |
| 只读、禁用、手动入口 | 对象编号、禁用本组、编辑维护备注、来源名称 | 静态只读值、禁用时不可打开、外部入口聚焦；`inlineEditForm.test.mjs`，浏览器验证真实入口 |
| 首次录入 | 独立的新资料名称 / 新负责人及保存新资料 | 与详情隔离，修改只入草稿，整表保存后才更新结果；`publicUiExamples.test.mjs` |
| Form 的全部内置类型及 custom | 通用信息表单：文本、多行、数字、布尔、单 / 多枚举、日期 / 日期时间、采样策略 | 就近完成 / 放弃图标只操作本地草稿，顶部保存才提交，失败可重试或撤销；`formSession.test.mjs`、`publicUiExamples.test.mjs`。采样至少 1 秒是本例显式规则，不是组件默认规则 |
| 多语言单行 / 多行与独立对话框 | 名称与多语言、说明与多语言、多语言表单输入 | 整组校验、切语言、回退、确认 / 取消、跨尺寸草稿保留；`inlineEditing.test.mjs`、`i18nComponents.test.ts`、`i18nText.test.mjs` |
| 移动端 / 键盘与布局 | 上述示例在 390px 容器及手机视口下操作 | 可点击动作、44px 主要操作、弹层确认、Esc、焦点返回和无横向溢出；状态测试不替代浏览器或真机 |
| 文件、头像、图标等真实资源 | 宿主 `custom` 扩展；头像保存消费者为 `src/views/account/center/components/BasicInfo.vue` | 弹窗只示范确认边界。`basicProfileSave.test.mjs` 验证已确认资源值的写入 / 回读语义；资源浏览、上传、鉴权、删除和真机文件选择未由本页验证 |

顶部名称与行内名称覆盖公共文字编辑：输入长短内容，核对宽度随动至配置上限、字体与基线不跳动、hover / focus 下划线及 Esc 恢复。多语言入口承接文字草稿，面板按平台支持语言配置显示；取消、外部关闭不提交，确认一次更新文字与翻译。用 Tab 进入多语言按钮并打开面板，检查输入焦点、Esc 关闭及焦点返回。

“说明与多语言”覆盖多行原位编辑：阅读保留段落，进入编辑后内容区宽度与初始高度保持，Enter 换行、普通失焦保留草稿，Ctrl / Cmd + Enter 保存、Esc 取消；内容增长至高度上限后内部滚动。翻译面板用语言 Tabs，切换后保留各语言草稿，全部校验后一次确认；隐藏语言校验失败需切回对应页签并聚焦错误字段。“多语言表单输入”验证独立 Modal 复用同一编辑内容，保留主输入值与翻译映射。

两区之间的真实分割线已启用调宽：拖动、方向键和点击操作共用边界，Esc 回滚拖动，双击恢复初始宽度。调整后折叠再展开应保留宽度与搜索值；无业务页 CSS 或模拟拖动代码。

顶部“处理工作台”直接使用 `ResponsiveSplitter`，可切换左右 / 上下分区；默认尺寸、像素边界和宿主尺寸共同约束布局。分割条默认仅保留连续细线，hover 显示轻量把手，不弹出尺寸菜单。方向键、Home / End 调整尺寸，双击或 Enter / Space 复位；Esc 撤销拖动。折叠后点击握柄或 Enter / Space 恢复原尺寸。折叠入口使用公共 `PanelCollapseButton`，位于布局外的工作区工具栏，与“处理工作台”标题同行，关联真实导航区域 ID；图标随布局方向变化。

工作台通过公共 `ResponsiveSplitter` 区分手动偏好与临时适配。左右布局切到 390px 内容容器后自动收起任务列表，主区不再参与双面板调宽，边缘保留独立12px恢复槽；点击入口或向内拖动均可打开本工作区内的临时抽屉。拖动预览跟随指针，超过一半确认，回拉到40%撤销；短拖、Esc、捕获丢失和布局切换均返回隐藏，不写回宽布局偏好。选择任务后关闭并将焦点转到详情标题，Esc / 关闭返回入口。扩大到 700px 时：原先展开的列表恢复，手动收起的仍然收起；临时抽屉不会自动打开。核对搜索草稿、选中项、DOM 实例、原尺寸和滚动位置经过切换仍保留；在抽屉内聚焦搜索时变宽，应保留合理焦点。上下布局按可用高度与最小尺寸预算适配，恢复槽和拖动方向随之旋转。

“选择与日期”覆盖单选、多选、日期与范围：弹层拥有原生 Enter / Esc，只有完整选择发出 change；多选在保存前只维护草稿，普通失焦保留。用键盘和鼠标分别核对第一次 Esc 关闭弹层、下一次取消编辑。“多类型原位编辑”覆盖数字、Select、Switch、复合上下限和多行：复合字段内部移动焦点不写入，非法整体值保留草稿；多行失焦不保存，Ctrl / Cmd + Enter 或按钮确认，取消回退。

工作台已开启拖动折叠。左右分区在 160px 最小宽度处继续拖动，请求尺寸小于 80px 时显示两端渐隐的内缘阴影，面板仍保持 160px；拖回 96px 以上撤销意图，松手才用平台快速过渡收起。分隔器独立占用 12px 拖拽槽，核对展开、折叠和揭开过程中均不覆盖内容；折叠后整条线隐藏，只保留槽中央的握柄。从边缘向右拖会逐步揭开面板，松手后应用合法尺寸，短距离或 Esc 撤销。展开过程中保留搜索草稿，工具栏按钮继续恢复保留的尺寸。上下分区使用同样的 Y 轴交互和独立横槽。减少动态效果时不播放过渡。
