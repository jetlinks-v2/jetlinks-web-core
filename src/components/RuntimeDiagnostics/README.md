# 运行诊断组件

提供指标、线程、MBean、集群调用链和日志的基础展示，使用当前主题、Ant Design Vue、CodeBlock 和 Echarts。数据加载、目标寻址、页面导航和后端授权由宿主负责。

```ts
import { RuntimeMetricsPanel, RuntimeMBeanOverview, JvmDiagnosticPanel, ThreadViewer,
  FlameGraphViewer, MBeanBrowser, TraceViewer, LogViewer, createFlameGraphHtml,
  registerMBeanRenderer } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { MBeanDescriptor, MBeanInvocation, ViewState, ActionAccess }
  from '@jetlinks-web-core/components/RuntimeDiagnostics'
```

组件和注册函数也从 components 根入口具名导出，组件按需异步加载；类型与纯数据工具从本目录公开入口导入。使用 core 的组件插件和 i18n 后可直接组合。

| 组件 | 主要 props | 事件 / 插槽 |
| --- | --- | --- |
| RuntimeMetricsPanel | metrics、samples、charts、range、activeMetric、options、state、historyState | refresh、metric、range-change(TimeWindow)；metrics / summary / time / default 插槽 |
| RuntimeMBeanOverview | beans、state、config、history?、showLifetime?、resetAccess?、resetState? | refresh、inspect(ObjectName)、update:config、reset(ObjectName)；启动时间 / 时长、Buffer 累计计数与近 5 分钟趋势 |
| JvmDiagnosticPanel | nodeId、threads、threadState、snapshot、samplingState、access、activeTab、platformPrefixes | sample、start、stop、export-html、capture-jfr、heap-dump({live})、update:activeTab；memory 插槽 |
| FlameGraphViewer | snapshot、platformPrefixes | 缩放聚焦、搜索、平台帧标记与操作分组 |
| ThreadViewer | threads、sampleAccess、state | sample；列表支持筛选、排序及展开线程栈 / 锁 |
| DeviceSessionViewer | nodeId?、deviceId、queriedDeviceId、resultDeviceId?、sessions、state、access、active、expandConnections?、remoteSearch、deviceOptions、deviceSearching | update:deviceId、query(精确设备 ID)、refresh、search-device(keyword)、select-device(id)；filters 插槽；节点可选、多个连接原位展开，expandConnections 可直接展开全部 |
| DeviceSessionObservation | entries、deviceOptions、deviceSearching、active、access、unsupported?、waiting?、paused、interval、metrics | add、remove、refresh、search-device、update:paused / interval / metrics；最多五设备的响应式观测卡片 |
| MBeanBrowser | beans、selectedObject、target、invokeAccess、busy、result、state、detailState、resultState、config | refresh、select(ObjectName)、invoke(MBeanInvocation)、update:config |
| TraceViewer | spans、selectedId、focusNode、logAccess、nodeAccess、state | refresh、select(TraceRow 或 undefined)、logs(Span)、node(Span) |
| LogViewer | entries、files、fileId、filter、following、hasPrevious、hasNext、truncated、traceAccess、exportAccess、state、config、embedded、fileBusy | refresh、file、filter、follow、previous、next、trace、export、update:config |

所有组件的 `state: ViewState` 支持 ready / loading / empty / error / forbidden / unsupported / stale，带可选 message、sampledAt。动作权限 `ActionAccess` 为 `{ allowed: boolean, reason?: string }`，缺省拒绝。宿主也必须在事件处理器内校验权限，后端执行最终授权。

## 数据约定

- Buffer 趋势图的轴含义与完整单位放在图表下方，顶部图例仅说明队列与指标；Tooltip 继续显示原始计数和完整速率单位。

- DeviceSessionViewer 仅展示宿主提供的会话；输入与已提交查询 ID 分开，`resultDeviceId` 标识保留结果所属设备，查询新 ID 时不把旧结果标成新设备。`nodeId` 缺省为空，此时保持原始节点顺序；提供节点时仍优先展示当前节点。`remoteSearch=false` 保留精确 ID 输入；启用后，宿主提供 `DeviceSessionDeviceOption { value, label, description? }[]`，其中 value 为真实设备 ID、label 为设备名称。组件只发 `search-device(keyword)`，宿主负责防抖、取消、权限与有界候选查询；选择候选只发 `select-device(id)`，不重复发 query。自由文本的 Enter / 查询按钮仍发 query，候选和输入变化不改变保留结果身份。`filters` 插槽可组合节点筛选，提供 disabled 插槽属性。查询、选择与刷新受 active / access.allowed / 加载状态约束，宿主仍须校验实际读取权限、请求身份和取消。空结果表示未查询到会话，不等于设备离线。会话及连接的时间为 epoch 毫秒，`lastCommTime` 展示为“最近活跃”，包含心跳与显式保活，不代表该连接最近业务收发；结果标题以 state.sampledAt 标记查询快照时间。相对时间和已连接时长仅由本地时钟更新，失活暂停，不请求接口。计数支持精确十进制文本，缺失或无效值不补零；会话、连接及连接 metrics 中的待处理计数各自呈现，不相加。设备 ID、查询结果和连接信息不由组件写入浏览器存储。
- 指标值与单位由宿主明确提供；缺失值保留缺口，不补零。samples 为单组趋势；charts 为多图、多 series 的毫秒时间样本，可提供单位、max、minInterval、formatValue 和按需说明。图表自动排列并随 Ant Design 明暗主题更新；metrics 插槽可复用宿主现有资源条。historyState 可单独承载历史请求状态，不隐藏仍有效的实时指标和 MBean。
- RuntimeMBeanOverview 只消费已读取属性，按 java.lang / Runtime 和 org.jetlinks / PersistenceBuffer 完整身份匹配；未知、负数计数保留缺失。Buffer 概览使用原生滚动图例选择队列，每队列两条同色实 / 虚线对比待处理 / 失败或写入 / 处理尝试速率，图高 240px。`BufferDisplayConfig` 保留 filter、objectName、view，扩展 visibleObjectNames 与 scale（linear / compressed）；旧 objectName 恢复为单选，缺省全选，空数组为主动全关。明确选择后新增队列默认隐藏；偏好保存期望的完整身份，当前曲线、摘要和 Tooltip 只展示与可用队列的交集。没有权威永久删除信号时，初始空、临时缺失或部分到达的快照不销毁选择，队列回载自动恢复；用户操作图例才明确替换期望集合。期望单选同步 objectName，多选 / 全关时清除 objectName，重置仍须该对象当前存在。宿主按节点持久化选择和刻度，采样与工具切换保留选择。默认线性刻度，可显式切换 log1p 压缩刻度，保留零值，坐标轴反变换、Tooltip 始终显示原数。说明入口解释 Buffer 的用途和指标含义。摘要显示所选队列累计写入、处理尝试、待处理和失败条目，单队列提示另列 WriterPending 请求数与 Wip 批次，不合并不同单位。
- Buffer 累计计数唯一来自 `Monitor` 的 `queue(in N,out N,dropped N)` 段；`written` / `attempted` 以十进制文本保留 Java long 精度。out 包括失败、取消和重试的处理尝试，不是完成 / 成功数，也不能用 in-out 推算积压。全部队列的累计总数仅在每队列字段都可得时求和。`history: BufferHistorySample[]` 由宿主注入真实采样时间及 `{ objectName, pending?, dead?, written?, attempted?, counterEpoch? }`；本页保留最近 5 分钟，单个堆积样本可显示点，吞吐需相邻有效样本才按实际时间差估算条/秒。先用 BigInt 作精确差值，差值可安全转成数字后才计算速率；缺字段、缺测、集合变化、计数倒退或不同 epoch 均留断点，不跨断点连线或向采集前回填。HTML tooltip 的动态名称、身份、单位与文案统一转义。
- Buffer 重置缺省拒绝，全部队列不支持批量重置。具体队列须有 resetAccess.allowed，确认框说明仅重置统计、保留待处理与失败数据；确认时再次校验目标和权限，只发 reset(ObjectName)。宿主负责根据真实 metadata 与权限决定是否允许、执行 resetMonitor、更新 counterEpoch 并清理跨重置的在途采样；resetState 就近呈现加载与失败。组件不请求、定时采集、调用 MBean 或写浏览器存储。对象诊断中的单队列三阶段摘要和 BufferQueues 的筛选 / inspect 保持独立。
- 线程为一次快照，携带真实采样时间、线程状态、栈和可选锁信息；单次 BLOCKED 不等于死锁。本组件不声称提供线程 CPU 或多样本分析。
- JVM 的实时 JFR snapshot 是累计快照，宿主逐条替换，不能累加样本 / 分配字节。线程、实时采集、结果查看、HTML / JFR 导出、heap 采集与导出分别由 access 动作授权；宿主确认副作用并处理生命周期。停止保留结果或清空由宿主明确选择。对象分配以无分页可搜索排行展示已捕获的 TLAB 内 / 外分配事件字节，完整类名可换行；占比始终以当前快照全部有效对象类型为分母，搜索只筛选行，不改变总量或占比。无效、负数及不可靠的非安全整数字节不参与排行；全零数据保持 0%，不补造分配事件。它不表示堆存量、精确总分配或泄漏结论，浏览偏好只保留当前节点内的搜索，不持久化诊断正文。
- 实时 JFR 的 `SamplingState.updateCount` 仅统计本次有效快照接收次数，空 / 重复累计快照也只增加更新次数，不增加执行样本。宿主以已有时钟提供 `quietSeconds`，首帧等待 15 秒或最近更新间隔 5 秒后设置 `delay`（`first-frame` / `updates`）；提示保留最近结果，用户显式重新连接才按本页 stop → start 重开订阅，不调用全局停止。停止冻结计时 / 次数；新采集清零，迟到旧订阅不得更新。空报告树只表示没有可展示的执行样本，不能据此声称 JDK 未产生事件或诊断低负载。`FlameGraphViewer` 的 `empty` / `sampling-details` 插槽允许调用方补采集状态，独立调用仍保留默认空态与现有导出行为。
- MBean 使用完整 canonical ObjectName 作为身份，方法使用参数类型列表作为精确签名。缺少可靠元数据时仅展示属性；属性写入未开放。组件调用前确认目标和参数，不自动重试。专用 renderer 只能通过宿主提供的 `executeInvocation` 执行已登记的只读查询白名单；宿主持续负责目标、权限和最终执行，通用 `invoke` 结果不与专用查询结果混用。
- DeviceSessionObservation 按设备显示紧凑卡片，设备 ID 在名称后弱化展示；下方连接摘要从全部服务节点选择已知建立时间最新的记录，节点、协议、地址和时间来自同一记录；时钟图标配紧凑时长，悬停显示具体建立时间。连接明细缺失时仅使用该节点真实会话字段；缺失字段不向其他记录借值。多个已知连接显示数量和下拉箭头；点击摘要打开可滚动浮窗，只按节点分组展示紧凑连接列表，图标配数值，含义和完整时间放在悬停提示中，离开视图关闭；四项摘要宽屏横排、窄屏两列。每卡同一图区默认绘制收发速率、消息吞吐、待处理，分别使用流量左轴、消息速率右轴、数量右外轴，图下明确单位，指标颜色跨设备一致。宿主提供共享 metrics 选择，任意设备图例更新全部卡片；时间游标仅在当前观测区按真实时间联动，浮层最多在半个实际采样周期内匹配帧并显示真实采样时间，不跳过缺测或越界回填。图表浮层不接收鼠标事件，移动可穿过浮层继续读图。设备身份颜色保持独立。完整浮窗中的最近通信来自连接 metrics.lastCommTime，仅有会话 lastCommTime 时标为最近心跳；采样、权限、暂停和进入页面立即查询由宿主管理，组件不请求接口或持久化连接数据。
- Trace 时间使用十进制纳秒字符串，先做整数差值再转毫秒；`nanosText` 可消费精确文本并拒绝不安全浮点数。保留多根、缺失 / 歧义父级、重复和循环记录。宿主把 select 事件的稳定 `TraceRow.key` 回传 selectedId，避免重复 SpanID 选错。focusNode 只高亮。nodeId 必须是已验证实例，未知 app 范围仍显示但不能跳转；返回样本数与已观测范围不表示完整集群覆盖。
- Trace 的“下一异常”只定位明确的 `exception` 事件；“慢调用”按精确纳秒差值从长到短循环定位已挂接且正耗时的子调用，同耗时保留调用树顺序。耗时包含子调用，不推导自身耗时、阈值或瓶颈；入口和未挂接的结构异常根不进入慢调用序列。没有可比较子调用时禁用并提供可聚焦提示，单个调用仍可点行查看。定位展开祖先并保留搜索与其他折叠，详情继续在调用树原位展开。
- 日志采用单一阅读工作区：来源切换与当前文件 / 真实阅读路径位于顶部，左侧约 200px 文件目录承载面包屑、上级、刷新、文件名 / 大小 / 修改时间，右侧承载已加载区查找 / 级别 / 跟随与紧凑正文。目录可折叠，工作区宽度 ≤640px 默认收起，显式打开时覆盖正文；较宽时固定分栏。`LogViewer` 的 `source` / `file-prefix` / `file-selector` / `console-actions` slots 分别承载来源、文件前置操作、选中文件身份与控制台接收动作；`file-selector` 默认仍提供文件选择，`embedded` 取消内层正文边框以便宿主只保留一个外框，`fileBusy` 禁用文件刷新 / 下载。`isConsole` 模式隐藏文件操作。目录与选中文件各自保留状态及独立取消代际，浏览 / 刷新 / 目录失败和 ZIP 返回上级不改变正在阅读、跟随或导出的文件。只有实际选择不同文件才切换正文，同文件重复点击不重读。
- 文件在滚动边缘发出 previous / next，`loadingDirection` 表达后台读取；正文更新按旧可见行身份恢复阅读锚点，不使用分页。宿主以可收缩的 flex 容器分配剩余高度，按未滚动的布局位置及祖先底部留白约束视口，提供有界数据；正文和状态滚动区阻止边缘滚动传递到外层页面；级别与查找仅作用已加载记录，完整原文 / 堆栈原位展开。顶部跟随开关恢复时只发 follow(true)，由宿主负责最新窗口；自动滚动与控制台接收分别控制。宿主以来源为 key 保留两个阅读实例，切换后恢复各自阅读位置和展开内容；停用的来源不继续读取或接收。ZIP 条目可提供 exportName，下载仍为整个归档，关联时间仅作定位参考。
- 宿主默认有界发现普通目录（最多 12 个目录、3 层），仅从具备 readWindow 能力的普通文件按 current、lastModified 选择最新；不自动展开归档。自动发现的分支失败不掩盖其他成功候选，手动进入失败目录仍呈现原始错误；根目录授权与取消仍正常处理。文件片段只在服务端字节游标完全相邻时拼接，保留合法重复行，跨片段识别异常栈并保持原片段行身份；最多保留 2500 物理行或 4Mi 文本字符，超出时淘汰远端片段，继续位置仍来自服务端。文件跟随从末尾游标向前读取新增内容，轮转重新读取真实尾部。roots 只读 Provider 能力发现独立于来源切换，未确认时展示加载 / 可重试错误，确认无 Java 后才展示控制台不支持；刷新能力保留已确认结果，不因临时加载或无关按钮权限更新清空控制台证据。实时控制台只在发现 Java Provider 后显式订阅现有 `/system/log/{node}/java/runtime`，不调用 runtime 的 stat，不降级旧 `/logger` 协议；能力发现本身不读取文件、不启动订阅。最多保留 2000 条或 4Mi 文本字符，每个超长正文 / 堆栈 / 原文限 256Ki 字符。首条事件立即更新接收状态，正文约 100ms 批量落地；待展示队列同样有界，停止 / 切工具时提交已接收证据，clear / 撤权 / 节点改变释放队列与定时器。工具停用取消接收，缓存证据保留，恢复不自动重订阅。当前平台 SDK 的 error 帧仅触发全局错误提示，未向单条订阅转发，因此首条前保持“等待日志”，不声称连接已成功，也不自动重试。

- 普通多行消息与异常栈分别展示：宿主按完整日志头、缩进、显式结构块或连续 `key:value` / `key=value` 字段块识别归属；字段块空行后的 payload 属于同一消息，遇到新日志前缀或明确 Throwable / Java / Reactor 栈证据重新分界。未知独立格式不补造时间或等级，窗口从字段 / 栈片段开始时同样保留未知身份。相邻窗口先整体解析，正文、空行、缩进及原文保持完整，记录继续使用其原始首行身份。`logPresentation` 不再把第二行默认解释成堆栈；普通正文直接显示，超过 8 行或 1400 字符提供独立展开，搜索命中会展开对应正文或堆栈。原文复制仍使用完整 raw，实时控制台与文件共用这一展示契约。

## MBean 自动渲染

对象树固定为 domain → type → name，JetLinks 域优先且首次默认展开，搜索临时展开分组。名称保持单行完整文本，长名称通过树自身水平滚动查看；树和详情独立滚动，导航内容不撑宽正文或页面。宽容器保留树与详情并列；可用宽度不超过 720px 时，默认以当前对象入口让详情优先，点击后展开内联目录，选择对象或按 Esc 收起并将焦点返回入口。目录隐藏保留原树实例、搜索、展开和双轴滚动，工具切回不强制收起用户已打开的目录。受控 config 保存用户真实展开与分区，空 expandedKeys 表示主动收起。selectedObject 可定位完整身份，target 用于调用确认。内置摘要覆盖 JVM、Buffer / Tracing / Netty、SQL 等待、物数据缓存、会话、事件、Kafka、采集、聚合、文件清理及 AI 常用计数；国际化名称 / 说明与严格身份规则统一在 registry.ts，未知对象直接显示属性表。目录元数据和当前属性读取的状态分开，专用内容、属性、方法共用一个对象入口。

BufferQueues 条形比较各队列已知的待处理条数，不是容量使用率；对象摘要以待落盘请求 → 待处理条目 → 在途批次的三个独立阶段展示，不合并不同单位。失败条目和最近错误分别呈现，未知计数 / 未读取错误保留缺失，`nil` / 空错误表示无错误文本，不能抹去 DeadSize 等独立失败证据。只有对象存在方法时提供“查看操作”入口，切换页签不调用方法。操作使用 metadata 参数顺序，布尔 / 数字 / JSON 等按声明类型校验，确认弹窗重申对象和节点；成功、失败结果独立展示。

## 火焰图导出

`createFlameGraphHtml({nodeId, snapshot, platformPrefixes?, minimumSamples?, labels?})` 生成自包含 HTML，保留搜索、聚焦、操作分组、采样提示与热点完整路径。宿主负责权限、保存文件和本地化 labels（含 `insights`）。节点名、类名与方法均按不可信文本处理，不执行内嵌数据；导出不依赖外部脚本。

在线与离线火焰图保持调用主干在底部、深层调用向上展开。首次有样本、新会话和显式聚焦 / 恢复全图定位到主干；流式快照按距底部的阅读偏移保留当前层级及横向位置，搜索与操作分组不重置阅读。隐藏后恢复须等待有效布局。SVG 按实际画布宽度排版，保留每层 27px，避免深栈缩放后的居中留白；最小图宽 720px，窄容器内可独立横向滚动。网络通信分类按包边界识别 Netty、RSocket、JDK 网络及 Reactor Netty，未知帧保留“其他”。

热点行主行保留类与方法，包名置于次行，长符号可换行；生成类身份、可靠正安全整数源码行和可复制原名均保留。唯一同权重子帧的线性链合并展示，展开保留全部路径，不合并不同调用路径的同名方法。每次仅展开一项证据，流式更新保留仍存在的展开项。图形高度随视口约束，将分组、提示和首个热点留在阅读区。

`FlameGraphViewer` / `JvmDiagnosticPanel` 的 `minimumSamples` 默认 100，仅用于少样本提示，可由宿主配置；达到参考值也不保证能定位瓶颈。提示始终基于全量快照，不随搜索、分类或聚焦改变。自身样本仅在父 / 直接子计数都是可靠非负整数、子级完整且子和不超过父时推导，表示未进入已报告子帧的样本。报告栈可能被过滤或截断，不能据此推断实际 CPU 时间、网络等待、锁、GC 压力或泄漏。在线与 HTML 导出共用分析、符号解析、转义和文案插值规则。

```ts
const unregister = registerMBeanRenderer({
  id: 'my-cache-v1',
  match: bean => bean.domain === 'example' && bean.type === 'Cache'
    && bean.attributes.some(attribute => attribute.name === 'Size' && attribute.available),
  component: CacheSummary,
})
// 扩展卸载时调用 unregister()
```

后注册的 renderer 优先，接收 `bean` prop；匹配或渲染异常回退属性表。renderer 可选 emit `request-section`（`summary` / `attributes` / `operations`），请求切换已有页签；不存在的方法页签请求会忽略，此事件不执行方法、不扩大权限。扩展只提供展示，不持有 raw invoke 或自行绕过宿主动作授权。

## 最小用例

```vue
<MBeanBrowser :beans="beans" :state="state" :invoke-access="{ allowed: canInvoke }"
  :busy="busy" :result="result" @refresh="reload" @invoke="invoke" @select="clearResult" />
```

宿主应在节点变化时清理数据、参数和结果，激活时按需加载；可组合 `useDiagnosticQuery` 管理竞态与清理。组件本身不读取路由、业务 API、全局当前节点或 localStorage。
