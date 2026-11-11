# RelationSelector

单列逐级选择“从某对象沿关系找到另一个对象”的描述。选到目标类型即提交，选择中间类型则原位进入下一层；返回仅浏览，关闭保留原配置。正反向名称来自基础关系目录，组件不依赖本体或其他业务 UI 模块。

```vue
<RelationSelector v-model:value="value" :options="{
  origins: [{ key: 'input', label: '当前对象', root: {
    objectType: sourceType, objectSource: { source: 'upper', upperKey: 'input.objectId' }
  } }],
  targetTypes: expectedTypes,
}" />
```

- `value`：既有 `VariableObjectSpec`；固定起点可直接使用 `objectId`。`related.next` 支持多层，反向保存在本段 `options.reverse`。
- `options.origins`：由调用方声明的起点。相同类型的不同变量分别使用不同 key，按真实根身份回显。
- `options.targetTypes`：允许的终点类型；省略允许任意类型，空数组不允许提交终点。零跳与同类型重复均可表达。
- `disabled` / `readonly`：不可修改，不打开浮层。
- 事件：`update:value`、`change`；清空输出 `undefined`。不会在未完成路径时发出更新。
- 多跳：选到合法终点自动完成；重开后可从底部“继续查找”进入更多层。面包屑支持回到前面换选，搜索仅筛选当前层。
- 选取不修改关系，不绑定对象，不发送通知，不将样例 ID、显示名称或图标混入协议。
- 目录请求走平台请求上下文，缓存限于组件实例并在语言变化时清空；权限与实例查询仍由数据提供方负责。

开发验证页：`/#/relation-selector/lab`，要求登录，仅开发环境注册。可搜索真实样例对象，查询当前路径结果并查看配置；预览至多 20 条，额外一条用于识别截断，无总数和无限分页承诺。

方案与阶段验证见 [关系对象选择器设计](../../../docs/关系对象选择器设计.md)。
