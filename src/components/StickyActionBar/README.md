# StickyActionBar 使用说明

页面或抽屉底部操作条，支持 sticky bottom、普通 inline 和容器内 floating 三种位置，并提供默认、信息与深色三种视觉语气。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `hint` | 左侧提示 | `string` |  |
| `position` | 定位方式 | `bottom \| inline \| floating` | bottom |
| `tone` | 视觉语气 | `default \| info \| inverse` | default |

#### 事件

- 无自定义事件。

#### Expose

- `getElement(): HTMLElement | undefined`：返回操作条根元素，可作为通用元素动效的终点。

#### 用法

~~~vue
<StickyActionBar hint="修改尚未保存">
  <a-button>取消</a-button>
  <a-button type="primary">保存</a-button>
</StickyActionBar>
~~~

#### Rules

- `default/info` 不改变按钮样式；`inverse` 统一提示文本、默认次按钮和主按钮样式，按钮权限和点击逻辑仍由调用方提供。
- JlDrawerShell 的 foot 插槽内使用 position=inline。
- `floating/inverse` 适用于跨业务保持一致的容器内浮动待提交条；`inline/info` 适用于普通文档流中的待提交提示。
- 默认 `position=bottom`、`tone=default`，现有调用方无需调整。
