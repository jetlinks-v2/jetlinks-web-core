import type { App } from 'vue'
import formatTime from './formatTime'
import hasMenu from './hasMenu'

export default {
    install(app: App) {
        app.use(formatTime)
        app.use(hasMenu)
    }
}
