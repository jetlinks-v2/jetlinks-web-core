let uiPromise: Promise<void> | undefined;

const buildScriptTag = (src: string): HTMLScriptElement => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.defer = true;
    script.src = src;
    return script;
};

/** 多个地图共用脚本；失败时释放缓存，下次加载可以重新请求。 */
export const getAMapUiPromise = (version: string = '1.0'): Promise<void> => {
    const amapWindow = window as Window & { AMapUI?: unknown; initAMapUI?: () => void };
    if (amapWindow.AMapUI) {
        return Promise.resolve();
    }
    if (uiPromise) return uiPromise;
    const script = buildScriptTag(`https://webapi.amap.com/ui/${version}/main-async.js`);
    uiPromise = new Promise<void>((resolve, reject) => {
        const clearHandlers = () => {
            script.onload = null;
            script.onerror = null;
        };
        const fail = (reason: unknown) => {
            clearHandlers();
            script.remove();
            uiPromise = undefined;
            reject(reason);
        };
        script.onload = () => {
            try {
                amapWindow.initAMapUI?.();
                if (!amapWindow.AMapUI) {
                    fail(new Event('error'));
                    return;
                }
                clearHandlers();
                resolve();
            } catch (reason) {
                fail(reason);
            }
        };
        script.onerror = fail;
    });
    document.body.append(script);
    return uiPromise;
};
