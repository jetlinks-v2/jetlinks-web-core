# SectionCard 使用说明

统一白底区块卡，提供图标、标题、副标题、操作区和内容插槽。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `id` | 区块 DOM id | `string` | - |
| `title` | 区块标题 | `string` | - |
| `sub` | 副标题 | `string` | - |
| `icon` | 图标名 | `string` | 必填 |
| `iconBg` | 图标背景 | `string` | accent-soft |
| `iconColor` | 图标颜色 | `string` | accent |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<SectionCard icon="SettingOutlined" title="基础信息" sub="设备连接配置">
  <template #actions><a-button type="link">编辑</a-button></template>
  <div>内容</div>
</SectionCard>
~~~

#### Rules

- 每个区块只使用一层 SectionCard，避免卡片嵌套。
- icon/title/sub/actions 负责头部，默认插槽承载主体。
