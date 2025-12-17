import {provide, inject} from "vue";

const PLATFORM_KEY = Symbol('platform')
export const usePlatformContext = (platform = 'iot') => {
    provide(PLATFORM_KEY, platform)
}
export const usePlatform = () => {
    return inject(PLATFORM_KEY, 'iot')
}

export const isIotPlatform = () => {
    return usePlatform() === 'iot'
}
