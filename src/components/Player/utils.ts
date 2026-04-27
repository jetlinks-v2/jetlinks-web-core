import FlvPlugin from 'xgplayer-flv'
import HlsPlugin from "xgplayer-hls"
export const settingEnum = {
    mp4: {
        isLive: false,
    },
    flv: {
        plugins: [FlvPlugin],
        flv: {
            retryCount: 5,       // 网络错误最大重试次数
            retryDelay: 1000,    // 重试间隔 ms
            loadTimeout: 10000,  // 加载超时
            seamlesslyReload: true // 无缝重连
        }
    },
    m3u8: {
        plugins: [HlsPlugin],
        hls: {
            retryCount: 5,
            retryDelay: 1000,
            disconnectTime: 0
        }
    }
}
