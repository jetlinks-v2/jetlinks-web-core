# Vite 开发服务器连接与文件监听生命周期

## 当前结论与范围

运行时前端由 `jetlinks-web-core/vite.config.ts` 配置开发代理，`server.proxy[VITE_APP_BASE_API]` 同时承接 HTTP 和业务 WebSocket。当前安装版本是 Vite 7.2.4，其打包的代理实现为 http-proxy-3 1.22.0。

相同 Vite 版本的隔离服务器中已复现并修复两处连接生命周期缺陷。后续故障复发时捕获到另一条现场路径：外部文件的重复监听注册累积，Vite 主线程在 macOS 原生文件事件分发中持续遍历监听集合，静态资源及代理请求均无法处理，后端直连正常。此前代理回收修复没有覆盖这条路径。

Owning module 为 `runtime-ui/jetlinks-web-core`，修复边界为开发服务器代理与文件监听的生命周期，不涉及运营前端、生产构建产物、后端接口或业务 WebSocket 协议。代理回收及文件监听去重分别覆盖两条已复现的故障路径。

## 排查证据

隔离验证使用实际安装的 `vite.createServer`，上游使用本地 HTTP/TCP 服务器控制握手和断线，不加载业务页面，不修改运行中的开发服务器。

| 触发条件 | 观察结果 | 判断 |
| --- | --- | --- |
| 已建立的 WebSocket 被上游 TCP reset，重复 12 次 | 出现 12 次 `ws proxy error`，上游连接回收到 0，普通 HTTP 和 `/@vite/client` 均返回 200 | `ECONNRESET` 日志本身不足以解释全部请求挂起。 |
| WebSocket 上游不完成握手，下游在握手期间取消，重复 8 次 | 上游仍保留 8 条连接，普通 HTTP 仍返回 200 | 握手取消未销毁上游请求，存在连接泄漏。 |
| HTTP 上游声明响应长度，发送部分正文后 reset | 下游已收到部分正文，但在观察窗口内既未结束也未报告断开 | 代理未向下游传播响应中断。 |
| 使用最多 6 条连接的同源 HTTP 连接池，依次制造 6 个上述中断响应，再请求 `/@vite/client` | 6 个响应均已开始、均未结束；后续请求进入队列，独立连接仍返回 200；取消前 6 个请求后，排队请求完成 | 证明未回收的响应能够占满浏览器同源 HTTP/1.1 连接，使静态资源与 API 一起表现为 pending。此项使用 Node HTTP Agent 模拟连接池，尚非真实浏览器现场验证。 |

重启后的实际进程检查中，页面、`/@vite/client`、代理 `/api/system/config/front` 和后端直连接口均快速返回 200，未复现当前进程整体阻塞。该结果只说明采样时服务正常。

## 修复行为与代码入口

目标：在代理这一共同边界上回收异常连接，让失败明确传递给浏览器，避免异常响应持续占用同源连接。

1. `configs/proxy.ts` 的 `configureProxyLifecycle` 提供带类型的代理生命周期配置，通过 Vite 已公开的 `ProxyOptions.configure` 接入。
2. 在 `proxyReqWs` 中处理握手期间的下游关闭及错误，销毁对应上游请求；升级成功后对两端 socket 做成对清理，清理保持幂等并释放本配置的监听器。HTTP upgrade socket 允许半关闭，下游断开可能只发出 `end` 而没有 `close`，因此同时监听 `end`、`close` 和 `error`。正常上游关闭使用 `destroySoon` 刷新已转发的 WebSocket close 帧，再关闭下游。
3. 在 `proxyRes` 中处理上游响应异常结束或关闭：完整响应正常完成，不完整响应销毁下游响应，使浏览器能够立即释放连接。已经发送响应头时不补写伪造的成功正文或第二套响应头。
4. 在 `vite.config.ts` 的现有代理规则中接入生命周期配置，保留目标地址选择、路径改写、HTTP/WebSocket 协议及现有错误日志。
5. `tests/viteProxyLifecycle.test.mjs` 使用真实 Vite 和本地可控上游服务器做集中回归，覆盖握手取消、两端异常断开、响应中途断开、反复取消后的连接数、同源连接池恢复，以及正常 HTTP、正常 WebSocket 和持续流式响应。

明确不做：本次不修改 `ui/`、业务重连策略、接口或权限；不通过吞掉 `ECONNRESET` 日志掩盖问题；不增加统一的 HTTP/流式响应超时，不扩大连接池，不升级整套依赖。

## 风险与验收

- 生命周期修复必须覆盖握手前、握手成功后及响应头已发送后的不同状态，避免清理旧连接时误伤新连接。
- 对 SSE、NDJSON、长轮询等持续响应，只在实际关闭且响应不完整时回收；不能按响应持续时间结束健康连接。
- 代理配置变更会触发运行中 Vite 的配置重载，现有开发页面可能短暂断开。
- 验收信号：反复握手取消后上游连接回归基线；中断响应使下游明确失败并释放连接；同源后续 HTTP 与 Vite 脚本不再因这些中断响应排队；健康 WebSocket 和流式响应持续可用。
- 原始故障仍需现场确认。如果修复后再次出现，应在重启前同时采样浏览器 pending 请求的阶段、Vite 静态资源响应、代理与后端直连响应、进程 CPU/内存及 TCP 连接状态，用于区分连接池排队与 Vite 事件循环或转换管线阻塞。

## 验证结果

在 `runtime-ui/jetlinks-web-core/` 执行：

- `node --test tests/viteProxyLifecycle.test.mjs`：13 项通过，0 失败、0 跳过。包括连续取消 12 次握手后上游连接归零、12 次上游 reset 后 HTTP 与 Vite 脚本正常返回、下游在握手期间及升级后的 reset、正常 WebSocket echo 和 1000 关闭码、401 握手拒绝正文保留、HTTP 正文截断明确失败，以及 6 条连接的同源连接池恢复。
- SSE 和 NDJSON 的健康多段响应在上游结束前持续可用，取消 NDJSON 响应后上游连接释放；没有给代理增加统一超时。
- `../node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node configs/proxy.ts`：通过。`node --check tests/viteProxyLifecycle.test.mjs` 和 `git diff --check`：通过。
- 使用实际 `vite.loadConfigFromFile` 分别编译并加载 `serve/development` 和 `build/production` 配置，通过代理钩子接线、WebSocket 设置和路径改写断言。配置加载仍输出已有的业务模块 `vite-plugin` 加载提示，本次未改变模块插件机制。未执行完整生产资源打包；此次只修改开发代理，生产包行为没有调整。需要完整生产构建证据时，在 `runtime-ui/` 执行 `pnpm build`。
- 根工作区及 core 未提供独立 lint 脚本。此次只对新增配置执行定向严格类型检查；没有重新运行全量页面类型检查。需要全量检查时，在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`。
- 实际运行实例：页面、`/@vite/client`、代理 `/api/system/config/front` 和后端直连均返回 200，采样耗时约 11–28ms。Codex 内置浏览器打开 `http://127.0.0.1:9200/#/overview`，概览页、资源统计和菜单正常显示。

上一轮验证的边界：代理测试证明已复现的连接泄漏和响应挂起分支被修复，未覆盖与原故障相同持续时间的热更新与构建。此后复发现场及新增方案见下文。

实现提交：[61614422f562d9b31c4c5cdbd25058ed2affb938](https://github.com/jetlinks-v2/jetlinks-web-core/commit/61614422f562d9b31c4c5cdbd25058ed2affb938)。Pull Request：[jetlinks-web-core #228](https://github.com/jetlinks-v2/jetlinks-web-core/pull/228)，目标分支 `2.20`。

## 故障复发：文件监听重复注册

故障复发时未重启 Vite，运行中的代理修复源码与已验证版本一致。Vite 7.2.4 内置 chokidar 3.6.0，运行环境为 macOS、Node 22.22.2。

- Vite CPU 约 94%–99%。首页、`/@vite/client`、代理 API 使用独立 HTTP 客户端均在 5 秒后超时，后端直连约 22ms 返回 200。因此本次整体阻塞不依赖浏览器同源连接池排队。
- CPU profile 定位到 Vite 内置 chokidar 的 `setFSEventsListener`、`filteredListener`、Set 遍历及 GC。通过断点读取，同一原生事件容器有 385,924 个监听回调；示例注册路径为 core 之外的 `runtime-ui/.env.local`，路径长度正常，没有软链接变换。
- Vite 的 `ensureWatchedFile` 对 root 外文件反复调用 `watcher.add`。core 为开发 root，业务模块位于其外；chokidar 的 FSEvents 分支会为每次调用新建过滤回调并加入集合，没有按文件去重。任意文件事件因此需要遍历不断增长的回调集合。
- 当时有业务模块构建并行运行，但这只能证明时间相关。构建是否独立触发故障、哪些插件贡献了重复注册尚未逐项归因，修复不应绑定某个业务模块或某条构建命令。
- 进程随后未重启便恢复；独立请求再次测得 Vite 脚本 200/38ms、代理 API 200/46ms、后端直连 200/17ms。临时开启的本机 inspector 已关闭。

隔离验证使用实际 `vite.createServer`，root 外同一个文件先注册一次，再重复注册 2,000 次。以下 `_closers` 计数仅用于诊断，不作为生产实现依赖：

| 监听设置 | 首次注册后的回收句柄 | 重复注册后的回收句柄 | 补充结论 |
| --- | --- | --- | --- |
| 默认 macOS FSEvents | 1 | 2,001 | 直接复现重复注册导致资源线性增长。 |
| `useFsEvents: false` | 1 | 1 | macOS 上 chokidar 会自动改为 `usePolling: true`，不能将此结果当成 Node `fs.watch` 的验证。 |
| 同时设置 `useFsEvents: false, usePolling: false` | — | — | 用 2,000 个实际模块源码文件做规模验证时触发 `EMFILE`，不适合直接作为工作区默认方案。 |

轮询模式下，2,000 个实际模块文件重复加入 5 批后，回收句柄保持 2,000，HTTP 可响应。这只用于区分注册去重与事件后端行为，不作为采用轮询的理由。

## 文件监听修复行为与验证

在共同监听注册入口保证普通文件的重复注册幂等，保留现有原生事件后端，使这类显式文件监听的规模由不同文件数量决定，而不随热更新或重复转换次数持续增长。方案经确认后已实现。

1. `configs/plugin/dedupe-watch.ts` 的 `dedupeWatchPlugin` 通过 `vite.config.ts` 接入，仅开发模式生效。在 Vite 默认的 literal-path FSEvents 监听器上，对普通文件按 watcher 的 `cwd` 规范化并去重；异步原生注册前占位，合并同批及并发加入。只使用公开 watcher API，不修改依赖文件。
2. 显式文件 `unwatch`、否定路径和服务器关闭会释放对应记录；同步注册失败回滚，带路径的异步错误释放失败注册，无路径错误通过公开 `getWatched()` 保留健康记录。FSEvents 对删除重建、原子替换及目录取消后重新启用的子文件监听仍有效，因此保留对应注册，避免反复创建回调。
3. 目录、软链接、首次缺失文件和否定路径批次保留原生行为。其他监听后端不应用适配；显式开启 glob 或配置动态忽略函数时也透传，避免改变匹配规则。当前开发配置使用默认 literal-path FSEvents 和静态忽略项，属于已验证的去重范围；自定义上述选项时不能沿用去重保证。
4. `tests/viteWatchLifecycle.test.mjs` 使用真实 Vite、原生文件事件和 HMR WebSocket，同时验证回收计数、更新后模块内容及 HTTP。规模验证使用 2,000 个不同外部文件，重复加入 5 批后仍为 2,000 个显式回收句柄，文件事件和 `/@vite/client` 正常；关闭服务器后句柄归零。

范围为 core 的开发服务器配置、一个监听适配入口、对应回归和本文档。沿用已有代理修复，不改业务模块、生产打包规则、开发 root、连接池及 Node 内存参数，不通过轮询、扩大文件描述符上限或过滤报错规避问题。

主要风险是去重后误失去后续文件事件，尤其是删除重建、忽略规则、目录取消和重启。集中回归覆盖上述分支；仍需实际工作区持续运行验证，不能把有界规模回归等同于覆盖原故障持续时间。

集中验证：

- `node --test --test-timeout=30000 tests/viteWatchLifecycle.test.mjs`：12 项通过，0 失败、0 跳过。包含未修复实例的监听累积反例、2,000 次重复注册、并发注册、2,000 文件规模、外部模块 HMR、删除重建、原子保存、文件/目录取消重加、非默认 cwd、错误后重试、服务器重启及特殊匹配透传。macOS 沙箱中的未修改对照实例也收不到 FSEvents，故原生事件验证在宿主权限下执行。
- 新增配置定向 `tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node configs/plugin/dedupe-watch.ts`、测试脚本语法检查及 `git diff --check` 通过。隔离 checkout 的类型检查显式指定原工作区的 `--typeRoots`，没有新增依赖。
- 代理实现和既有 13 项代理回归未修改，复用前述源码指纹对应的通过证据。根工作区及 core 无独立 lint 脚本；完整生产打包和全量页面类型检查仍按上文命令执行，本次没有新增这两项证据。

- 使用真实工作区分别加载 `serve/development` 与 `build/production` 配置，监听插件接线、`apply: serve`、既有代理钩子均通过断言，未加入轮询配置。模块插件加载仍出现原有提示，未改变该机制。
- 已将同一份实现同步到当前开发目录，Vite 自动重载配置。首页、`/@vite/client`、代理配置接口与后端直连全部 200，采样约 11–19ms；实际 Vite CPU 回到 0.0%。Codex 内置浏览器打开概览页，菜单、资源概况及统计数据正常显示。
- 当前未经历与原故障相同持续时间的开发和并行构建；以上证明已复现的重复注册路径及生命周期分支通过验收，不能排除其他独立故障。

监听修复提交：[27bcb84281db120a968396a72cf34fcb52382bf0](https://github.com/jetlinks-v2/jetlinks-web-core/commit/27bcb84281db120a968396a72cf34fcb52382bf0)，沿用上述 PR #228。
