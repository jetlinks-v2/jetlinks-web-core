# 指标计算组件

`MetricTemplateManager` 管理模板、发布与模拟；`MetricWorkspace`、`MetricPanel` 和 `MetricResult` 展示业务配置及结果。业务模块声明对象维度、来源选择和前端参考模板，公共层不依赖设备或空间页面。

指标公式通过 `template/TemplateMathEditor.vue` 适配到 core 的 `MathExpressionEditor`，统一使用就地候选、原生选区、嵌套分支、参数提示和 LaTeX 交换。宿主提供输入、上游计算、模板参数及其字段路径、类型、单位和显示说明；函数目录由 `/metric/templates/expression/functions` 按模板查询权限读取，并沿用后端纯函数声明和国际化。

编辑后保存 `StructuredExpression` 与引用依赖。已有源码只在可完整转换时投影为数学公式，查看不写回；仅提供公式编辑，无法投影的历史源码保留数据，并提示从完整配置查看。反显和执行解释复用 `ExpressionView`、`ExpressionWorkspace` 及同一目录。模拟继续调用指标模板或配置的后端试算接口，浏览器不计算结果。

本地菜单由业务模块的 `baseMenu.ts` / `metricMenu.ts` 注册，再通过菜单初始化写入。设备模块提供“业务指标”和“指标模板”入口，接口请求沿运行时原有授权上下文。
