# Vite 开发代理连接生命周期

## 当前结论与范围

运行时前端由 `jetlinks-web-core/vite.config.ts` 配置开发代理，`server.proxy[VITE_APP_BASE_API]` 同时承接 HTTP 和业务 WebSocket。当前安装版本是 Vite 7.2.4，其打包的代理实现为 http-proxy-3 1.22.0。

目前已在相同 Vite 版本的隔离服务器中复现两处连接生命周期缺陷；它们可以解释长时间运行后连接累积及浏览器同源请求排队。但尚未捕获用户原始故障现场，不能认定这两处缺陷是本次故障的唯一原因，也不能据此认定代码修改或构建直接触发故障。

Owning module 为 `runtime-ui/jetlinks-web-core`，修复边界为开发服务器代理，不涉及运营前端、生产构建、后端接口或业务 WebSocket 协议。

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

剩余风险：尚未经历与原故障相同持续时间的热更新与构建，也未捕获原始故障现场；当前验证证明已复现的代理泄漏和响应挂起分支被修复，不能排除其他独立的构建或后端阻塞原因。

实现提交：[61614422f562d9b31c4c5cdbd25058ed2affb938](https://github.com/jetlinks-v2/jetlinks-web-core/commit/61614422f562d9b31c4c5cdbd25058ed2affb938)。Pull Request：[jetlinks-web-core #228](https://github.com/jetlinks-v2/jetlinks-web-core/pull/228)，目标分支 `2.20`。
