# SvgIcon

`SvgIcon` 会按需渲染 `jetlinks-web-core` 和业务子模块根目录 `icons/` 下的 SVG 文件，并已由 `jetlinks-web-core` 全局注册。

## 资源约定

SVG 文件放在模块根目录的 `icons/` 中，允许继续按业务建立子目录：

```text
modules/device-manager-ui/icons/device/status.svg
```

图标的 `type` 为“模块目录/相对于 `icons/` 的路径”，不包含 `.svg` 扩展名：

```vue
<svg-icon
  type="device-manager-ui/device/status"
  class="size-5 text-primary"
  aria-hidden="true"
/>
```

`jetlinks-web-core` 自己使用的图标放在 `src/icons/` 中：

```text
jetlinks-web-core/src/icons/navigation/arrow-right.svg
```

对应的 `type` 直接使用相对路径：

```vue
<svg-icon type="navigation/arrow-right" aria-hidden="true" />
```

需要表达信息时，传入本地化的 `aria-label` 与 `role="img"`；仅作装饰时使用 `aria-hidden="true"`。需要跟随文本颜色的 SVG，请在源文件中使用 `fill="currentColor"` 或 `stroke="currentColor"`。

也可以从组件入口获取按需组件或当前可用图标键：

```ts
import { getSvgIcon, svgIconTypes } from '@jetlinks-web-core/components'

const DeviceStatusIcon = getSvgIcon('device-manager-ui/device/status')
console.log(svgIconTypes)
```
