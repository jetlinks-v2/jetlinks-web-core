# IconLibrary 使用说明

图标选择弹窗，支持图标库、类型切换和自定义 z-index。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `type` | 当前图标值 | `string` | - |
| `zIndex` | 弹窗层级 | `number` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `change` | 图标变化 | `(value)` |
| `update:type` | 图标值变化 | `(value)` |
| `visibleChange` | 弹窗显示变化 | `(visible)` |

#### 用法

~~~vue
<IconLibrary v-model:type="iconName" @change="onIconChange" />
~~~

#### Rules

- 图标值应保存稳定的图标名称，不保存渲染组件实例。
- 需要在表单中嵌入时使用 update:type 绑定。

#### 图标列表来源

- 运营端 `IconLibrary` 继续复用 `AIcon` 与全局 `IconConfig.scriptUrl` 加载图标。`src/components/IconLibrary/fields.ts` 只维护 Ant Design 分类；iconfont 列表直接来自页面实际加载的 SVG symbol，无需同步维护 `src/assets/icons/iconfont.json`。
- `src/components/IconLibrary/useIconfontSymbols.ts` 在首个消费者挂载时读取 `svg symbol[id]`，按原始 ID 去重，不依赖 iconfont 项目编号或 `icon-` 前缀。选择弹窗与 `IconValue` 展示/编辑组件共享列表和单个 MutationObserver，处理资源异步注入、symbol 增删与 ID 变化；最后一个消费者卸载时释放，普通 DOM 更新、搜索与分类切换不会重新扫描。DOM 访问留在挂载阶段以兼容 SSR。
- `src/components/IconLibrary/SelectModal.vue` 使用统一的 `{ name, value }` 选项：Ant Design 保留主题后缀，iconfont 保留原始 symbol ID。“全部”与“iconfont”分类的预览、选中态、复制及保存使用相同的值。弹窗沿用既有 Ant Design 控件、布局与 Props/事件契约。
- 更新默认 `public/icons/iconfont.js` 或配置的自定义脚本后，刷新页面即可发现实际加载的图标；浏览器缓存仍按资源发布策略处理，必要时更新请求版本号。已从资源删除的历史图标值需要另行保留同名 symbol 或迁移，不由选择器自动修复。资源加载失败时不回退到旧 JSON 列表。

#### 验证

在 `ui/jetlinks-web-core/` 执行：

```shell
node --test tests/iconLibrary.test.mjs
pnpm exec vue-tsc --noEmit -p tests/tsconfig.icon-library.json
```

在 `ui/` 执行：

```shell
pnpm check:ui-style -- --files jetlinks-web-core/src/components/IconLibrary/SelectModal.vue
pnpm -F jetlinks-web-core build -- --module-name saas-manager-ui
```

浏览器测试使用真实组件、`AIcon`、`ConfigProvider` 和当前 iconfont 脚本，覆盖 12 个场景（含父测试共 13 项），400 个当前图标均有可渲染图形；覆盖异步加载、预加载、去重、增删、ID 变化、大小写搜索、自定义前缀、“全部”分类保存、剪贴板、Ant Design 图标、多语言、卡片与弹窗共享监听及最后一个消费者卸载后的释放，浏览器无运行错误。与 `IconValue` 配套验证的类型、样式、构建及已登录服务页面结果见 [IconValue 验证说明](../IconValue/README.md#验证)。
