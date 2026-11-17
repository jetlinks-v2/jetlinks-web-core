# 平台基础配置

运行时 `/system/Basis` 与 `/init-home` 共用的配置区块。提供平台名称、Logo、页签图标、登录背景、备案信息、高德地图和接口基础地址；不承载 SaaS 域名开通流程。

## 区块编辑

运行时设置页的平台外观和高德地图按区块编辑：各区块标题右侧提供“编辑”，点击后显示本区块输入控件并切换为“取消 / 保存”。非编辑态及无编辑权限时只展示已保存文案，空值显示“未配置”，安全密钥使用固定掩码，备案显示开关以状态文案展示；图片保持缩略图。地图三个字段直接在卡片内编辑，首次配置也遵循该流程，不再提供独立的“清除配置”按钮。外观名称、图片、备案信息和开关只更新草稿，预览跟随草稿；取消恢复本区块已保存值，保存成功后退出编辑，失败保留草稿。两个区块分别提交，保留其他区块草稿、隐藏字段和扩展配置。保存期间保留当前控件并临时锁定，初始化仍直接显示可填写控件。

实现入口为 `PlatformAppearanceSection.vue`、`PlatformMapSection.vue`、`PlatformImageSetting.vue`，共用 `usePlatformSettingsSection.ts` 管理区块草稿与保存状态，`PlatformSectionActions.vue` 提供统一操作按钮；复用 `change(patch)`、`submit(patch)` 与 `src/hooks/usePlatformSettings.ts` 的配置保存链路。上传或裁剪期间禁止外观保存、取消；取消仅恢复图片配置引用，不删除已上传文件。初始化 `mode="form"` 保留统一提交，接口基础地址、通知渠道、路由参数及运营端不在此次修改范围。

区块编辑验证：core 中执行 `node --test tests/platformSettings.test.mjs tests/inlineEditForm.test.mjs`，37 项通过，新增用例覆盖取消恢复、分区校验与保存隔离、未知 / 隐藏字段保留、失败重试、清除草稿、上传 / 裁剪与重复提交锁定、另一块写入期间上传完成、首次配置、只读权限及初始化统一提交。5 个变更 Vue 文件通过 `node ../ui/scripts/check-ui-style.mjs --files <变更 Vue 路径>`，所有相关 SFC / 样式编译和中英日文案键检查随测试通过，Vue 文件均未超过 300 行；工作区无独立 lint 脚本。

区块编辑初版使用真实运行时基础配置入口、core 组件及 SaaS 字段注册配合模拟配置 / 上传接口完成 Chromium 验收：1440 / 390px 下首次配置、字段显隐、只读权限及初始化直接填写通过；桌面验证外观 / 地图同时编辑、Enter / 失焦 / 开关不写配置、取消恢复预览、地图成对 / 重复 Key 校验、失败重试、保存互斥、清除后取消与保存（该按钮现已移除）、真实 ICO 上传及图片裁剪的按钮锁定和延迟保存通过，无脚本异常及横向溢出。脚本、截图和报告位于 `/private/tmp/platform-section-browser/`。

区块编辑实现（core 提交 `bfbe138`）在运行时工作区执行 `pnpm build --outDir /private/tmp/platform-section-build` 通过（2 分 3 秒，含 709 个可视化播放器资源文件），保留已有资源路径、CSS 注释、分块及依赖警告。`pnpm exec vue-tsc --noEmit --pretty false -p jetlinks-web-core/tsconfig.json` 修改前后均为 513 条既有诊断，忽略行列后输出完全一致，相关文件无诊断；全量类型检查仍需解决既有错误后重跑。差异空白检查通过。未向真实后端写入配置；需在运行时执行 `pnpm dev`，以实际账号验收上传、保存后刷新回显和登录页外观。

非编辑态文案展示验证：上述 37 项测试和三个变更 Vue 文件的样式检查通过；全量类型检查仍为相同的 513 条既有诊断，无新增。真实组件配合模拟接口在 1440 / 390px 下验证文本及空值展示、密钥掩码、点击文案不编辑、编辑 / 取消、保存失败重试、提交期间锁定、成功后恢复文案、备案显示状态、只读权限、SaaS 字段隐藏及初始化直接填写，均通过且无脚本异常或横向溢出。报告与截图位于 `/private/tmp/platform-section-browser/readonly-report.json` 及同目录 `readonly-*.png`；本次展示调整未重跑完整构建，必要时在运行时工作区执行 `pnpm build`，真实后端验证仍待完成。

清除按钮移除验证：`PlatformMapSection.vue` 删除按钮及确认弹窗，`usePlatformSettingsSection.ts` 移除仅服务该按钮的 `hasValues`，同步清理中英日专用文案。上述 37 项测试、地图组件样式检查和差异空白检查通过；未重跑浏览器、全量类型检查和完整构建，需完整验收时使用上述命令。

超管编辑范围：SaaS 平台外观仅对当前用户 `username === 'admin'` 开放登录背景、备案号及显示开关，继续沿用 `system/Basis:update` 编辑权限；`projectManager` / `projectOwner` 和普通账号仍隐藏这两项，接口基础地址继续对所有 SaaS 账号隐藏。不能以包含项目负责人的 `useUserStore().isAdmin` 代替平台超管身份。设置页随所在区块保存，初始化页随统一提交保存，后端仍使用现有 `front.background`、`front.recordNumber`、`front.showRecordNumber` 字段。

实现入口：`runtime-ui/modules/saas-runtime-ui/index.ts` 使用 `createHiddenBasisFormFields(fields, shouldHide)` 注册条件隐藏；core 的 `fieldRegistry.ts` 在消费时解析条件，`PlatformSettingsFields.ts` 和 `src/hooks/usePlatformSettings.ts` 共用该结果，保持配置行、预览、校验和提交过滤一致。身份晚于配置加载时回显新开放字段的已保存值，身份失去编辑资格后再次提交会过滤这些字段；隐藏字段及未知配置继续原样保留。运营端、后端接口、菜单和登录认证不变。

登录背景由 `src/utils/login-background.ts` 统一解析，供 `src/views/login/index.vue`、`PlatformLoginPreview.vue` 和上传缩略图复用。SaaS 超管配置的自定义背景在实际登录页生效；未配置及历史 `images/login/login.png` 占位图仍采用模块／SaaS 默认图，私有化保持原回退规则。

超管开放验证：core 中执行 `node --test tests/platformSettings.test.mjs tests/inlineEditForm.test.mjs tests/loginEntry.test.mjs`，46 项通过，覆盖实际 SaaS 注册、超管／项目负责人／项目管理员／普通账号／未加载身份、两种保存模式、身份晚加载及收回后的字段保护、备案必填与开关、背景保存失败重试，以及实际登录组件的自定义背景、旧默认图及备案显示。运行时工作区执行完整 `pnpm build --outDir /private/tmp/jetlinks-superadmin-appearance.sEtOG7/build` 通过（宿主 1 分 58 秒，包含 709 个播放器资源文件），保留既有资源路径、依赖及分块体积提示。全量 `pnpm exec vue-tsc --noEmit --pretty false -p jetlinks-web-core/tsconfig.json` 修改前后均为 513 条诊断，忽略行号后完全一致，无新增诊断；需修复既有类型问题后重跑。无独立 lint 脚本，Vue／样式编译随定向测试通过，变更文件差异空白检查通过。

真实组件与实际 SaaS 字段注册配合模拟接口完成 4 类账号 × 1440／390px 共 8 组 Chromium 检查：超管背景选择、16:9 裁剪、上传保存、预览联动、备案编辑及开关双向保存通过；项目负责人、项目管理员和普通账号继续隐藏相关字段，接口基础地址始终隐藏，全部场景无脚本异常及横向溢出。尚未写入真实后端；需在运行时工作区执行 `pnpm dev`，以平台 `admin` 登录 `/system/Basis`，复验实际文件上传、保存后刷新回显及退出后的登录页背景／备案显示。

外观左侧布局：`PlatformAppearanceSection.vue` 参考账户中心 `src/views/Account/center/components/LoginMethods/LoginMethodRow.vue` 的列表行、蓝底圆角图标、名称 / 说明和右侧操作区。名称和备案号通过 `PlatformTextSetting.vue` 复用 `InlineEditForm` 的只读字段能力与 `form` 模式：非编辑态展示已保存文案，区块编辑时显示输入控件；Enter、失焦及 Esc 不触发单字段保存或取消。备案开关保留无障碍名称，与其他外观字段一起保存。接口基础地址继续使用原单字段编辑行为。

名称编辑行调整历史（已由区块编辑替代）：`PlatformTextSetting.vue` 让右侧按钮与输入框顶部对齐，避免下方说明或保存失败提示把按钮向下推；`src/locales/lang/zh.json` 的 `PlatformSettings.modify` 统一显示“编辑”。23 项配置 / 行内编辑回归、行内编辑组件类型检查、目标样式检查及外观入口定向 Vite 构建通过；保留上传组件既有 CSS 注释提示。真实组件配合模拟接口验证 1920 / 1440 / 900px 输入框与按钮顶部一致，保存失败后仍对齐，390px 沿用原堆叠布局且无溢出；编辑、Esc 取消、Enter 保存、初始化和只读入口正常。无独立 lint 脚本，未运行完整应用构建、全量类型检查或真实后端写入；需要时在运行时工作区执行 `pnpm build`、`pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 并验收登录环境。

左侧布局与名称编辑历史验证（2026-11-12，单字段编辑已由区块编辑替代）：core 中 `node --test tests/platformSettings.test.mjs tests/inlineEditForm.test.mjs` 的 23 项测试及 `../node_modules/.bin/vue-tsc --noEmit -p tests/tsconfig.inline-edit-form.json` 通过，三个变更 Vue 文件的样式检查与外观区块入口定向 Vite 生产构建通过（保留上传组件既有 CSS 注释提示，构建外置运行时注册服务）。真实组件配合模拟接口完成设置 / 初始化 × 私有化 / SaaS × 1440 / 390px 八组检查及两个宽度的只读检查，共 10 组通过；覆盖文本 / 标签点击不编辑、右侧按钮开启并聚焦输入、64 字名称、预览草稿同步、Esc 取消、Enter / 失焦仅保存一次、失败重试、16px / 600 字重和无横向溢出。未执行真实后端写入或全量类型检查，必要时在运行时工作区执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`；参考页面在独立浏览器中需要登录，样式依据用户截图与对应组件源码确认。移除备案开关可见文案后，23 项测试、组件样式检查及外观入口定向构建再次通过；1440 / 390px 模拟接口浏览器检查确认文案已隐藏、无障碍名称保留、开关双向保存正常且无横向溢出，本次未重跑全量构建和类型检查。

图片上传入口：`PlatformImageSetting.vue` 通过 `PlatformImageTrigger.vue` 统一 Logo 与页签图标的 3rem 方形图片按钮、边框与加号空态，移除“更换”文字，按钮及本区块的上传容器均无内边距。保留图片比例、无障碍名称与忙碌状态；Logo 保留 JPG / PNG、4 MB 与裁剪，ICO 保留 1 MB 与原文件上传，背景图片继续使用宽幅按钮。上传完成后只更新外观草稿，保存通过区块按钮提交；权限及通用上传默认样式保持原约定。

登录背景高度：在 `PlatformAppearanceSection.vue` 中让背景行吸收左侧列表剩余高度，与右侧预览底部对齐；`PlatformImageSetting.vue` 的背景上传框跟随行高伸展，保留无内边距和 16:9 裁剪。窄屏堆叠时按内容高度显示，背景字段隐藏时列表保持自然高度。验证覆盖桌面伸展、窄屏、只读及裁剪取消，Logo / ICO 尺寸保持 48×48px。

背景高度验证（2026-11-12）：23 项配置 / 行内编辑测试、两个变更组件的样式检查与外观区块入口定向 Vite 生产构建通过（保留既有 CSS 注释提示）。真实组件配合模拟接口完成设置 / 初始化 / 只读 / SaaS × 1440 / 1920 / 390px 共 12 组浏览器检查：桌面列表与预览等高，背景框填满行内操作区，窄屏无横向溢出；背景隐藏时不拉伸列表，Logo / ICO 仍为 48×48px 且 padding 为 0，选择背景图片后的裁剪取消不写入配置。未执行真实后端上传、全量构建及全量类型检查；必要时在运行时工作区执行 `pnpm build`、`pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`。

上传入口验证（2026-11-12）：core 中 `node --test tests/platformSettings.test.mjs tests/inlineEditForm.test.mjs` 的 23 项通过；运行时工作区执行 `node ../ui/scripts/check-ui-style.mjs --files jetlinks-web-core/src/components/PlatformSettings/PlatformImageSetting.vue jetlinks-web-core/src/components/PlatformSettings/PlatformImageTrigger.vue` 通过；`pnpm -F jetlinks-web-core build --outDir /private/tmp/jetlinks-basis-upload-build -- --module-name authentication-manager-ui` 通过（28.18 秒），保留既有 CSS 注释与大包提示。真实组件配合模拟接口完成设置页 / 初始化页 × 私有化 / SaaS × 1440 / 390px 共 8 组浏览器检查，确认两个按钮均为 48×48px、边框一致、padding 为 0、无“更换”文字、Logo 点击打开裁剪且取消不写入；另 4 组 ICO 上传检查覆盖保存失败重试与初始化仅更新草稿，只读入口不显示上传按钮。没有提交真实后端请求；真实环境上传持久化仍待联调。工作区无独立 lint 脚本，本次未重跑全量类型检查，需要时执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`。

平台外观未配置登录背景时，预览沿用当前登录页的默认图规则：优先使用模块的 `--jet-login-bg-image`，私有化兜底 `public/images/login/login.png`，SaaS 兜底 `src/assets/login/login-bg.png`。可编辑背景字段时优先显示已配置的自定义图，SaaS 历史默认占位图按未配置处理；非超管仍隐藏背景字段。默认背景仅用于展示，不回填到配置草稿。

登录预览与实际登录页共享 `src/views/login/components/LoginPageLayout.vue` 的左侧登录区、顶部品牌及语言入口、右侧背景和底部备案布局，并复用 `LoginPanelHeader`、`PasswordLogin` 的展示。预览按桌面登录页比例缩放，保留名称、Logo、背景和备案的定位事件；表单与语言操作不可交互，不挂载登录请求、验证码或 SSO 流程。真实登录页只迁移展示布局，认证行为保持原有入口。

浏览器外框：`PlatformAppearancePreview.vue` 保留窗口控制点与活动页签，去掉 URL 地址栏所在的整行工具栏及站点地址读取，登录页与顶栏共用页面视口。左侧显示背景配置项时沿用 8:5；隐藏 `background` 时改为 12:5，即同宽下高度为原来的 2/3，预览卡片按内容高度显示。`PlatformLoginPreview.vue` 同步使用 1440×600 的紧凑画布，保留登录表单完整展示；仅未上传背景图时不缩短。名称和页签图标沿用草稿及字段定位；浏览器装饰不触发导航或配置写入。页签及顶栏的长名称省略显示，窄屏切换预览时保持窗口尺寸；真实登录页和保存契约保持原约定。

紧凑高度验证：23 项配置 / 行内编辑回归（含 Vue 编译）、两个变更组件的样式检查、外观入口定向 Vite 构建通过，保留上传组件既有 CSS 注释提示。真实组件配合模拟接口完成设置 / 初始化 × 私有化 / SaaS × 1920 / 1440 / 390px 共 12 组检查：隐藏背景时内容高度为同宽原高度的 2/3，登录表单完整、两种预览切换尺寸稳定、无横向溢出或配置写入；背景配置项可见但未上传图片时仍为原高度。未运行全量类型检查、完整应用构建或真实登录环境验收，需要时在运行时工作区执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`、`pnpm build`；工作区无独立 lint 脚本。

顶栏预览：`PlatformTopbarPreview.vue` 仅展示左侧品牌与右侧搜索、语言、通知和头像，删除模拟菜单行、菜单配置、专用样式与三语文案，沿用 `src/assets/layout/workbench-background.svg` 与 Ant Design 组件。工具区仅作展示，品牌继续读取草稿并发出字段定位事件；不接入真实菜单、路由及消息服务。

顶栏可读性：使用 960×600 画布，文字、Logo 与工具图标保持最初 1920×1200 画布的两倍显示尺寸。品牌与工具区保持同排，移除菜单后不保留空导航行；浏览器外框、无 URL 栏与登录预览比例保持现状。验证重点为菜单移除、双倍显示、桌面 / 窄屏布局、长名称与品牌定位。

顶栏预览验证（2026-11-12）：移除菜单后 23 项配置 / 行内编辑测试、样式检查与预览入口 Vite 生产打包通过；1440 / 390px 浏览器检查确认无菜单和空导航行、双倍尺寸保留、右侧工具完整、品牌定位有效、切换窗口尺寸稳定，无横向溢出和配置写入。未重跑全量构建及类型检查，必要时在运行时工作区执行 `pnpm build`、`pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`；浏览器验证使用真实组件与模拟接口，不执行真实后端写入。

浏览器外框验证（2026-11-12）：23 项配置 / 行内编辑测试、`node ../ui/scripts/check-ui-style.mjs --files jetlinks-web-core/src/components/PlatformSettings/PlatformAppearancePreview.vue` 与预览组件入口的 Vite 生产打包通过。模拟接口下，设置页 / 初始化页 × 私有化 / SaaS × 1440 / 1280 / 390px 共 12 组浏览器回归通过，覆盖登录比例、草稿联动、字段定位和只读登录控件；另在 1440 / 390 / 320px 验证 64 字名称省略、切换视图尺寸稳定、无横向溢出及装饰控件不导航、不额外写配置。后续移除 URL 栏后，23 项测试、样式检查、预览入口构建及差异空白检查再次通过，未重复浏览器回归。未重跑全量构建和类型检查，需要时在运行时工作区执行 `pnpm build`、`pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`。

高德地图使用 `PlatformMapSection.vue` 的页内表单，三个字段通过区块按钮一起启用、取消和保存。`Web 端 Key` 与安全密钥仍需成对，两类 Key 不能相同；安全密钥在非编辑态显示固定掩码，编辑态使用密码控件，退出编辑后恢复掩码文案。三个配置行图标沿用平台外观的 38×38px 容器、圆角、浅蓝底与 20px 蓝色图标。已配置状态取已保存值，草稿清空或填写不提前切换状态标签。

从 `@jetlinks-web-core/components/PlatformSettings` 按需导入，根入口 `@jetlinks-web-core/components` 同样具名导出；不全局注册：

- `PlatformSettingsEditor`：连接当前 system store 的页面容器。`mode="detail"` 的外观和地图按区块保存、接口基础地址逐项保存，`mode="form"` 只维护草稿；可注入 `save`，通过实例 `submit()` 统一校验保存并返回布尔结果。
- `PlatformSettingsLayout`：纯配置组合。接收 `model`、`saved`、`mode`、`assets`、`hidden`、`errors`、`loading`、`busy`、`disabled`、`error`、`warning`、`submit(patch)`；发出 `change(patch)`、`reload`、`uploading(key, busy)`。默认插槽承载宿主扩展。
- `PlatformAppearanceSection`、`PlatformAppearancePreview`、`PlatformMapSection`：可单独组合的外观、预览与地图区块。预览只读取草稿并发出 `locate`，不修改平台全局外观。
- `PlatformSettingsModel`、`PlatformSettingsPatch`、`PlatformSettingsSource` 等类型：草稿、部分变更及配置源契约。`submit(patch)` 返回 `Promise<{ ok: boolean; error?: string }>`。

```vue
<template><PlatformSettingsEditor ref="settings" mode="form" /></template>
<script setup lang="ts">
import { ref } from 'vue'
import { PlatformSettingsEditor } from '@jetlinks-web-core/components/PlatformSettings'
const settings = ref<InstanceType<typeof PlatformSettingsEditor>>()
defineExpose({ submitBasic: () => settings.value?.submit() })
</script>
```

`usePlatformSettings` 管理草稿、字段校验、请求互斥和 `front` / `amap` / `paths` 的增量合并；`useSystemPlatformSettings` 接入 system store、权限、图片上传状态和初始化默认布局。存储请求仍使用现有接口，成功后回读更新全局外观；回读失败独立提示，刷新不会再次写入。未提交、隐藏、未知字段及主题/布局配置保留。每次提交只更新当前字段的校验结果，另一块的错误和草稿保留；其他区块保存期间仍接收在途图片上传结果，回读不会覆盖该图片草稿。初始化请求失败由宿主中止后续步骤；表单组件不写菜单或初始化标记。

字段扩展继续使用 `BASIS_FORM_PAGE_CODE = 'system/Basis'`、`BASIS_FORM_MODULE_CODE = 'form-fields'`。`BASIS_FORM_FIELD`、`createHiddenBasisFormFields` 和 `resolveBasisFormFieldActions` 从本入口导出，原 authentication 模块入口保留既有标识及注册函数的兼容转导出。针对字段的扩展进入所属卡片，无目标扩展在卡片末尾渲染一次。SaaS 允许修改页签图标 `ico`，设置页上传后随外观区块保存，初始化页只更新草稿并随统一提交保存；`background`、`showRecordNumber` 仅对平台超管开放，`base-path` 始终隐藏。备案号随显示开关一并控制可见性，隐藏时不参与校验或写入。设置页外层 `system/basis:basic` 的 `basic` 注册位置保持不变。

生产入口：`modules/authentication-manager-ui/views/system/Basis/Form.vue`、`src/views/init-home/Basic/Form.vue`。定向测试：core 中执行 `node --test tests/platformSettings.test.mjs tests/inlineEditForm.test.mjs`。

地图弹窗历史验证（2026-11-12，已由页内区块编辑替代）：上述 23 项测试通过，包含 Vue 编译、样式及三语资源检查；真实组件配合模拟接口通过私有化 1440px 和 SaaS 390px 浏览器检查，覆盖三个字段回显、取消、Key 重复校验、失败保留草稿、重试合并保存及弹窗无横向溢出。相关文件差异空白检查通过；本次局部调整未重跑完整构建和全量类型检查，整页改造结果见 `src/views/README.md`。

默认登录背景回退验证（2026-11-12）：上述 23 项测试再次通过；真实组件配合模拟接口完成设置页 / 初始化页 × 私有化 / SaaS × 有 / 无自定义背景共 8 组浏览器检查，确认默认图片可加载、模块默认图与自定义图优先级正确、历史 SaaS 背景不生效、浏览时不写配置，差异空白检查通过。本次只修改预览展示，未重跑完整构建和全量类型检查。

登录预览布局对齐验证（2026-11-12）：`node --test tests/platformSettings.test.mjs tests/inlineEditForm.test.mjs tests/loginEntry.test.mjs` 共 30 项通过，包含共享布局与预览的 Vue / Less 编译；预览入口的定向 Vite 生产打包通过。真实 9200 登录页在 1440 / 1280 / 390px 下，迁移前后的品牌、语言入口、表单、备案及分栏几何尺寸一致。模拟接口下，设置页 / 初始化页 × 私有化 / SaaS × 1440 / 1280 / 390px 共 12 组通过缩放比例、草稿联动、字段定位、只读登录控件及无横向溢出检查；另 8 组背景回退与自定义图优先级回归通过。`pnpm exec vue-tsc --noEmit -p tsconfig.json` 仍报告 511 条诊断，本次四个修改 / 新增的 Vue 文件无诊断；完整构建未重跑，差异空白检查通过。没有提交真实登录或初始化请求。

SaaS 页签图标开放验证（2026-11-12）：移除 `modules/saas-runtime-ui/index.ts` 中 `ICO` 的隐藏注册，core 的 23 项配置 / 行内编辑测试通过，覆盖初始化统一保存图标及隐藏字段保护。浏览器按实际注册字段加载模拟接口，设置页 / 初始化页 × 1440 / 390px 共 4 组通过图标显示、上传预览、字段定位、失败重试保存及初始化仅更新草稿检查；背景、备案与接口地址仍隐藏，保存保留已有配置，无横向溢出。差异空白检查通过；这次注册项调整未重跑完整构建和全量类型检查。
