export const usePlatformContext = (platform = 'iot') => {
    provide('platformName', platform)
}
export const usePlatform = () => {
    return inject('platformName', 'iot')
}

export const isIotPlatform = () => {
    return usePlatform() === 'iot'
}
