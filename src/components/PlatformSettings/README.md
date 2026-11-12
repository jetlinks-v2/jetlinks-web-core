# 平台基础配置

运行时 `/system/Basis` 与 `/init-home` 共用的配置区块。提供平台名称、Logo、页签图标、登录背景、备案信息、高德地图和接口基础地址；不承载 SaaS 域名开通流程。

图片上传入口调整：由 `PlatformImageSetting.vue` 复用同一图片按钮，统一 Logo 与页签图标的尺寸、边框和空态，移除“更换”文字及上传区内边距。Logo 保留 JPG / PNG、4 MB 与裁剪，ICO 保留 1 MB 与原文件上传；只调整本配置区块的展示，保存、权限及通用上传默认样式保持原约定。完成后验证组件编译、现有配置测试及浏览器中的尺寸、空态和上传入口。

平台外观未配置登录背景时，预览沿用当前登录页的默认图规则：优先使用模块的 `--jet-login-bg-image`，私有化兜底 `public/images/login/login.png`，SaaS 兜底 `src/assets/login/login-bg.png`。私有化已配置的背景优先显示；SaaS 继续隐藏背景字段并忽略其历史配置。默认背景仅用于展示，不回填到配置草稿。

登录预览与实际登录页共享 `src/views/login/components/LoginPageLayout.vue` 的左侧登录区、顶部品牌及语言入口、右侧背景和底部备案布局，并复用 `LoginPanelHeader`、`PasswordLogin` 的展示。预览按桌面登录页比例缩放，保留名称、Logo、背景和备案的定位事件；表单与语言操作不可交互，不挂载登录请求、验证码或 SSO 流程。真实登录页只迁移展示布局，认证行为保持原有入口。

高德地图修改弹窗统一编辑 Web 端 Key、安全密钥和 Web 服务 Key，回显已保存值并一起提交；取消恢复已保存值，保存失败保留草稿以便重试。Web 服务 Key 同时保留逐行单独修改入口，沿用 Web 端 Key 与安全密钥成对、两类 Key 不同的校验。

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
