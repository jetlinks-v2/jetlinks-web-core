# 平台基础配置

运行时 `/system/Basis` 与 `/init-home` 共用的配置区块。提供平台名称、Logo、页签图标、登录背景、备案信息、高德地图和接口基础地址；不承载 SaaS 域名开通流程。

外观左侧布局：`PlatformAppearanceSection.vue` 参考账户中心 `src/views/Account/center/components/LoginMethods/LoginMethodRow.vue` 的列表行、蓝底圆角图标、名称 / 说明和右侧操作区。平台名称改由右侧“编辑”按钮开启原位编辑，名称值从 14px 调整为 16px / 600 字重；名称文本不再直接触发编辑。`PlatformTextSetting.vue` 通过 `InlineEditForm` 的手动触发字段选项和既有 `editField()` 保留草稿、权限、Enter / 失焦保存、Esc 取消及失败重试；初始化仍直接填写，外观以外的配置行保持现有样式。备案行右侧移除“显示备案号”的可见文案，保留开关的无障碍名称、保存与失败重试行为。

名称编辑行调整：`PlatformTextSetting.vue` 让右侧按钮与输入框顶部对齐，避免下方说明或保存失败提示把按钮向下推；`src/locales/lang/zh.json` 的 `PlatformSettings.modify` 统一显示“编辑”。23 项配置 / 行内编辑回归、行内编辑组件类型检查、目标样式检查及外观入口定向 Vite 构建通过；保留上传组件既有 CSS 注释提示。真实组件配合模拟接口验证 1920 / 1440 / 900px 输入框与按钮顶部一致，保存失败后仍对齐，390px 沿用原堆叠布局且无溢出；编辑、Esc 取消、Enter 保存、初始化和只读入口正常。无独立 lint 脚本，未运行完整应用构建、全量类型检查或真实后端写入；需要时在运行时工作区执行 `pnpm build`、`pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 并验收登录环境。

左侧布局与名称编辑验证（2026-11-12）：core 中 `node --test tests/platformSettings.test.mjs tests/inlineEditForm.test.mjs` 的 23 项测试及 `../node_modules/.bin/vue-tsc --noEmit -p tests/tsconfig.inline-edit-form.json` 通过，三个变更 Vue 文件的样式检查与外观区块入口定向 Vite 生产构建通过（保留上传组件既有 CSS 注释提示，构建外置运行时注册服务）。真实组件配合模拟接口完成设置 / 初始化 × 私有化 / SaaS × 1440 / 390px 八组检查及两个宽度的只读检查，共 10 组通过；覆盖文本 / 标签点击不编辑、右侧按钮开启并聚焦输入、64 字名称、预览草稿同步、Esc 取消、Enter / 失焦仅保存一次、失败重试、16px / 600 字重和无横向溢出。未执行真实后端写入或全量类型检查，必要时在运行时工作区执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`；参考页面在独立浏览器中需要登录，样式依据用户截图与对应组件源码确认。移除备案开关可见文案后，23 项测试、组件样式检查及外观入口定向构建再次通过；1440 / 390px 模拟接口浏览器检查确认文案已隐藏、无障碍名称保留、开关双向保存正常且无横向溢出，本次未重跑全量构建和类型检查。

图片上传入口：`PlatformImageSetting.vue` 通过 `PlatformImageTrigger.vue` 统一 Logo 与页签图标的 3rem 方形图片按钮、边框与加号空态，移除“更换”文字，按钮及本区块的上传容器均无内边距。保留图片比例、无障碍名称与忙碌状态；Logo 保留 JPG / PNG、4 MB 与裁剪，ICO 保留 1 MB 与原文件上传，背景图片继续使用宽幅按钮。保存、权限及通用上传默认样式保持原约定。

登录背景高度：在 `PlatformAppearanceSection.vue` 中让背景行吸收左侧列表剩余高度，与右侧预览底部对齐；`PlatformImageSetting.vue` 的背景上传框跟随行高伸展，保留无内边距和 16:9 裁剪。窄屏堆叠时按内容高度显示，背景字段隐藏时列表保持自然高度。验证覆盖桌面伸展、窄屏、只读及裁剪取消，Logo / ICO 尺寸保持 48×48px。

背景高度验证（2026-11-12）：23 项配置 / 行内编辑测试、两个变更组件的样式检查与外观区块入口定向 Vite 生产构建通过（保留既有 CSS 注释提示）。真实组件配合模拟接口完成设置 / 初始化 / 只读 / SaaS × 1440 / 1920 / 390px 共 12 组浏览器检查：桌面列表与预览等高，背景框填满行内操作区，窄屏无横向溢出；背景隐藏时不拉伸列表，Logo / ICO 仍为 48×48px 且 padding 为 0，选择背景图片后的裁剪取消不写入配置。未执行真实后端上传、全量构建及全量类型检查；必要时在运行时工作区执行 `pnpm build`、`pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`。

上传入口验证（2026-11-12）：core 中 `node --test tests/platformSettings.test.mjs tests/inlineEditForm.test.mjs` 的 23 项通过；运行时工作区执行 `node ../ui/scripts/check-ui-style.mjs --files jetlinks-web-core/src/components/PlatformSettings/PlatformImageSetting.vue jetlinks-web-core/src/components/PlatformSettings/PlatformImageTrigger.vue` 通过；`pnpm -F jetlinks-web-core build --outDir /private/tmp/jetlinks-basis-upload-build -- --module-name authentication-manager-ui` 通过（28.18 秒），保留既有 CSS 注释与大包提示。真实组件配合模拟接口完成设置页 / 初始化页 × 私有化 / SaaS × 1440 / 390px 共 8 组浏览器检查，确认两个按钮均为 48×48px、边框一致、padding 为 0、无“更换”文字、Logo 点击打开裁剪且取消不写入；另 4 组 ICO 上传检查覆盖保存失败重试与初始化仅更新草稿，只读入口不显示上传按钮。没有提交真实后端请求；真实环境上传持久化仍待联调。工作区无独立 lint 脚本，本次未重跑全量类型检查，需要时执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`。

平台外观未配置登录背景时，预览沿用当前登录页的默认图规则：优先使用模块的 `--jet-login-bg-image`，私有化兜底 `public/images/login/login.png`，SaaS 兜底 `src/assets/login/login-bg.png`。私有化已配置的背景优先显示；SaaS 继续隐藏背景字段并忽略其历史配置。默认背景仅用于展示，不回填到配置草稿。

登录预览与实际登录页共享 `src/views/login/components/LoginPageLayout.vue` 的左侧登录区、顶部品牌及语言入口、右侧背景和底部备案布局，并复用 `LoginPanelHeader`、`PasswordLogin` 的展示。预览按桌面登录页比例缩放，保留名称、Logo、背景和备案的定位事件；表单与语言操作不可交互，不挂载登录请求、验证码或 SSO 流程。真实登录页只迁移展示布局，认证行为保持原有入口。

浏览器外框：`PlatformAppearancePreview.vue` 保留窗口控制点与活动页签，去掉 URL 地址栏所在的整行工具栏及站点地址读取，登录页与顶栏共用页面视口。左侧显示背景配置项时沿用 8:5；隐藏 `background` 时改为 12:5，即同宽下高度为原来的 2/3，预览卡片按内容高度显示。`PlatformLoginPreview.vue` 同步使用 1440×600 的紧凑画布，保留登录表单完整展示；仅未上传背景图时不缩短。名称和页签图标沿用草稿及字段定位；浏览器装饰不触发导航或配置写入。页签及顶栏的长名称省略显示，窄屏切换预览时保持窗口尺寸；真实登录页和保存契约保持原约定。

紧凑高度验证：23 项配置 / 行内编辑回归（含 Vue 编译）、两个变更组件的样式检查、外观入口定向 Vite 构建通过，保留上传组件既有 CSS 注释提示。真实组件配合模拟接口完成设置 / 初始化 × 私有化 / SaaS × 1920 / 1440 / 390px 共 12 组检查：隐藏背景时内容高度为同宽原高度的 2/3，登录表单完整、两种预览切换尺寸稳定、无横向溢出或配置写入；背景配置项可见但未上传图片时仍为原高度。未运行全量类型检查、完整应用构建或真实登录环境验收，需要时在运行时工作区执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`、`pnpm build`；工作区无独立 lint 脚本。

顶栏预览：`PlatformTopbarPreview.vue` 仅展示左侧品牌与右侧搜索、语言、通知和头像，删除模拟菜单行、菜单配置、专用样式与三语文案，沿用 `src/assets/layout/workbench-background.svg` 与 Ant Design 组件。工具区仅作展示，品牌继续读取草稿并发出字段定位事件；不接入真实菜单、路由及消息服务。

顶栏可读性：使用 960×600 画布，文字、Logo 与工具图标保持最初 1920×1200 画布的两倍显示尺寸。品牌与工具区保持同排，移除菜单后不保留空导航行；浏览器外框、无 URL 栏与登录预览比例保持现状。验证重点为菜单移除、双倍显示、桌面 / 窄屏布局、长名称与品牌定位。

顶栏预览验证（2026-11-12）：移除菜单后 23 项配置 / 行内编辑测试、样式检查与预览入口 Vite 生产打包通过；1440 / 390px 浏览器检查确认无菜单和空导航行、双倍尺寸保留、右侧工具完整、品牌定位有效、切换窗口尺寸稳定，无横向溢出和配置写入。未重跑全量构建及类型检查，必要时在运行时工作区执行 `pnpm build`、`pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`；浏览器验证使用真实组件与模拟接口，不执行真实后端写入。

浏览器外框验证（2026-11-12）：23 项配置 / 行内编辑测试、`node ../ui/scripts/check-ui-style.mjs --files jetlinks-web-core/src/components/PlatformSettings/PlatformAppearancePreview.vue` 与预览组件入口的 Vite 生产打包通过。模拟接口下，设置页 / 初始化页 × 私有化 / SaaS × 1440 / 1280 / 390px 共 12 组浏览器回归通过，覆盖登录比例、草稿联动、字段定位和只读登录控件；另在 1440 / 390 / 320px 验证 64 字名称省略、切换视图尺寸稳定、无横向溢出及装饰控件不导航、不额外写配置。后续移除 URL 栏后，23 项测试、样式检查、预览入口构建及差异空白检查再次通过，未重复浏览器回归。未重跑全量构建和类型检查，需要时在运行时工作区执行 `pnpm build`、`pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`。

高德地图修改弹窗统一编辑 Web 端 Key、安全密钥和 Web 服务 Key，回显已保存值并一起提交；取消恢复已保存值，保存失败保留草稿以便重试。Web 服务 Key 使用已保存值只读展示，统一通过上方“编辑”按钮进入三字段弹窗；沿用 Web 端 Key 与安全密钥成对、两类 Key 不同的校验，初始化及首次配置表单保持原流程。`PlatformMapSection.vue` 的三个配置行图标沿用平台外观的 38×38px 容器、圆角、浅蓝底与 20px 蓝色图标，保留原图标语义及行内操作。统一编辑入口后，23 项回归（含 Vue 编译）、目标样式检查与地图入口定向 Vite 构建通过；私有化 1440px / SaaS 390px 模拟接口浏览器检查确认点击 Web 服务 Key 不进入编辑，统一弹窗支持三字段回显、取消、校验、失败重试、合并保存及保存后只读值更新，无横向溢出。图标沿用此前六组桌面 / 窄屏核对结果，未执行真实后端写入。构建保留既有 CSS 注释提示；无独立 lint 脚本，未重跑完整应用构建和全量类型检查，需要时在运行时工作区执行 `pnpm build`、`pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`，真实登录环境待验收。

从 `@jetlinks-web-core/components/PlatformSettings` 按需导入，根入口 `@jetlinks-web-core/components` 同样具名导出；不全局注册：

- `PlatformSettingsEditor`：连接当前 system store 的页面容器。`mode="detail"` 逐项保存，`mode="form"` 只维护草稿；可注入 `save`，通过实例 `submit()` 统一校验保存并返回布尔结果。
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

`usePlatformSettings` 管理草稿、字段校验、请求互斥和 `front` / `amap` / `paths` 的增量合并；`useSystemPlatformSettings` 接入 system store、权限、图片上传状态和初始化默认布局。存储请求仍使用现有接口，成功后回读更新全局外观；回读失败独立提示，刷新不会再次写入。未提交、隐藏、未知字段及主题/布局配置保留。初始化请求失败由宿主中止后续步骤；表单组件不写菜单或初始化标记。

字段扩展继续使用 `BASIS_FORM_PAGE_CODE = 'system/Basis'`、`BASIS_FORM_MODULE_CODE = 'form-fields'`。`BASIS_FORM_FIELD` 和 `createHiddenBasisFormFields` 从本入口导出，原 authentication 模块入口兼容转导出。针对字段的扩展进入所属卡片，无目标扩展在卡片末尾渲染一次。SaaS 允许修改页签图标 `ico`，设置页上传后逐项保存，初始化页只更新草稿并随统一提交保存；继续隐藏 `background`、`showRecordNumber`、`base-path`，备案号随显示开关一并隐藏，不参与校验或写入。设置页外层 `system/basis:basic` 的 `basic` 注册位置保持不变。

生产入口：`modules/authentication-manager-ui/views/system/Basis/Form.vue`、`src/views/init-home/Basic/Form.vue`。定向测试：core 中执行 `node --test tests/platformSettings.test.mjs tests/inlineEditForm.test.mjs`。

地图弹窗补充 Web 服务 Key 的验证（2026-11-12）：上述 23 项测试通过，包含 Vue 编译、样式及三语资源检查；真实组件配合模拟接口通过私有化 1440px 和 SaaS 390px 浏览器检查，覆盖三个字段回显、取消、Key 重复校验、失败保留草稿、重试合并保存及弹窗无横向溢出。相关文件差异空白检查通过；本次局部调整未重跑完整构建和全量类型检查，整页改造结果见 `src/views/README.md`。

默认登录背景回退验证（2026-11-12）：上述 23 项测试再次通过；真实组件配合模拟接口完成设置页 / 初始化页 × 私有化 / SaaS × 有 / 无自定义背景共 8 组浏览器检查，确认默认图片可加载、模块默认图与自定义图优先级正确、历史 SaaS 背景不生效、浏览时不写配置，差异空白检查通过。本次只修改预览展示，未重跑完整构建和全量类型检查。

登录预览布局对齐验证（2026-11-12）：`node --test tests/platformSettings.test.mjs tests/inlineEditForm.test.mjs tests/loginEntry.test.mjs` 共 30 项通过，包含共享布局与预览的 Vue / Less 编译；预览入口的定向 Vite 生产打包通过。真实 9200 登录页在 1440 / 1280 / 390px 下，迁移前后的品牌、语言入口、表单、备案及分栏几何尺寸一致。模拟接口下，设置页 / 初始化页 × 私有化 / SaaS × 1440 / 1280 / 390px 共 12 组通过缩放比例、草稿联动、字段定位、只读登录控件及无横向溢出检查；另 8 组背景回退与自定义图优先级回归通过。`pnpm exec vue-tsc --noEmit -p tsconfig.json` 仍报告 511 条诊断，本次四个修改 / 新增的 Vue 文件无诊断；完整构建未重跑，差异空白检查通过。没有提交真实登录或初始化请求。

SaaS 页签图标开放验证（2026-11-12）：移除 `modules/saas-runtime-ui/index.ts` 中 `ICO` 的隐藏注册，core 的 23 项配置 / 行内编辑测试通过，覆盖初始化统一保存图标及隐藏字段保护。浏览器按实际注册字段加载模拟接口，设置页 / 初始化页 × 1440 / 390px 共 4 组通过图标显示、上传预览、字段定位、失败重试保存及初始化仅更新草稿检查；背景、备案与接口地址仍隐藏，保存保留已有配置，无横向溢出。差异空白检查通过；这次注册项调整未重跑完整构建和全量类型检查。
