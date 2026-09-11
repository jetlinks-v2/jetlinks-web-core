# Player 使用说明

统一媒体播放器入口，按 URL 与协议自动选择 Jessibuca 或兼容播放器，并暴露播放控制方法。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `url` | 播放地址或 MediaStream | `string \| MediaStream` | - |
| `live` | 是否直播模式 | `boolean` | false |
| `autoplay` | 自动播放 | `boolean` | true |
| `muted` | 静音 | `boolean` | false |
| `poster` | 封面地址 | `string` | - |
| `timeout` | 播放超时 | `number` | - |
| `loading` | 加载态 | `boolean` | false |
| `volume` | 初始音量 | `number` | - |
| `loop` | 循环播放 | `boolean` | false |
| `protocol` | 媒体协议 | `mp4 \| flv \| m3u8 \| rtc \| string` | mp4 |
| `aiOverlay` | AI 叠加配置 | `boolean \| object` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `onPlay` | 开始播放回调 | `(event)` |
| `onPause` | 暂停回调 | `(event)` |
| `onError` | 播放异常回调 | `(error)` |
| `onTimeUpdate` | 播放进度回调 | `(time)` |
| `onEnded` | 播放结束回调 | `(event)` |

#### 用法

~~~vue
<Player ref="player" url="https://example/live.flv" protocol="flv" :autoplay="false" />
<script setup>
const player = ref()
player.value?.play()
</script>
~~~

#### Rules

- FLV 地址默认走 Jessibuca，其余协议保持兼容路径。
- 播放器实例方法包含 play、pause、screenshot、setPlaybackRate、getCurrentTime、getDuration。
