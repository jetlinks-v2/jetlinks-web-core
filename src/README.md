# `@jetlinks-web-core` 能力文档导航

本目录是 JetLinks 前端 core 层的能力入口。本文只做分类导航；具体 Props、参数、返回值、状态和副作用以分类索引、源码导出和生产用法为准。

## 阅读顺序

1. 根据任务类型打开下面对应的分类索引。
2. 从分类索引选择 1～3 个候选能力，再打开候选目录或文件旁的说明文档。
3. 用对应的 `index.ts` 核验根入口导出；文档、目录名和全局注册名都不能单独证明 API 可用。
4. 查看目标页面或相邻生产代码，确认当前版本的真实调用方式。
5. 文档与源码或生产代码冲突时，以源码导出和生产代码为准；文档缺失不代表能力不存在。

## 分类索引

| 任务类型 | 索引 | 事实源 | 说明 |
| --- | --- | --- | --- |
| 项目级组件、页面壳和交互封装 | [components/README.md](components/README.md) | [components/index.ts](components/index.ts) | 组件场景映射、注册名、具名导出和单组件 README |
| 可复用响应式逻辑 | [hooks/README.md](hooks/README.md) | [hooks/index.ts](hooks/index.ts) | Hook 用途、根入口/深层路径和副作用边界 |
| 通用函数、运行时和数据转换 | [utils/README.md](utils/README.md) | [utils/index.ts](utils/index.ts) | 工具按场景分组，标记根入口与深层路径 |
| 跨页面共享状态 | [store/README.md](store/README.md) | [store/index.ts](store/index.ts) 及各 store 源文件 | Pinia store 的职责、状态范围和导出事实 |
| core 页面和页面族 | [views/README.md](views/README.md) | `views/**`、路由入口和相邻页面 | 页面目标、入口、状态流和可复用能力 |

## 文档维护约定

- 新增或稳定调整的公共能力，先在对应分类索引增加一行，再在能力目录或文件旁增加简要说明。
- 单项说明至少写清：解决的问题、适用/不适用场景、实际导入路径、关键参数或返回值、副作用、最小示例和一个生产用法定位。
- 需要区分根入口、全局注册和深层路径时，明确标注“根入口导出”“全局注册名”或“仅深层路径”。
- 页面说明只描述终端用户任务、页面入口、关键状态和真实数据来源；不要把临时排查记录或设计草稿放入这里。
