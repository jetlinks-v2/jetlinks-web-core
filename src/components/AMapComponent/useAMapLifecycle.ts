import { computed, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { initAMapApiLoader, lazyAMapApiLoaderInstance } from '@vuemap/vue-amap';
import { useSystemStore } from '@jetlinks-web-core/store/system';
import { getAMapUiPromise } from './utils';
import { normalizeAMapError } from './errors';
import type { AMapError, AMapErrorKind } from './errors';

interface AMapInstance {
    setBounds(bounds: unknown): void;
}

interface MapEvents {
    init: (map: AMapInstance) => void;
    error: (reason: unknown) => void;
    complete: () => void;
}

const INIT_TIMEOUT = 15_000;

/** 管理单个地图的加载与异常；共享 SDK 只初始化一次，不重置其他地图。 */
export function useAMapLifecycle(
    ui: MaybeRefOrGetter<string | boolean | undefined>,
    onInit: (map: AMapInstance) => void,
) {
    const system = useSystemStore();
    const amapKey = computed(() => system.systemInfo.amap?.apiKey);
    const secretKey = computed(() => system.systemInfo.amap?.secretKey);
    const isOpenUi = computed(() => toValue(ui) === true || typeof toValue(ui) === 'string');
    const sdkReady = ref(false);
    const loading = ref(false);
    const uiReady = ref(false);
    const error = shallowRef<AMapError>();
    const loadId = ref(0);
    const mapEvents = shallowRef<MapEvents>();
    let mapInstance: AMapInstance | undefined;
    let mapComplete = false;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clearTimer = () => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
    };
    const isCurrent = (id: number) => active && id === loadId.value;
    const fail = (reason: unknown, kind: AMapErrorKind, id: number) => {
        if (!isCurrent(id)) return;
        clearTimer();
        loading.value = false;
        error.value = normalizeAMapError(reason, kind);
    };
    const finish = (id: number) => {
        if (!isCurrent(id) || !mapComplete || (isOpenUi.value && !uiReady.value)) return;
        clearTimer();
        loading.value = false;
        // 超时后仍允许迟到的正常加载恢复；真实 SDK 错误保持可见。
        if (error.value?.kind === 'timeout') error.value = undefined;
    };

    watch([amapKey, secretKey, () => toValue(ui)], () => {
        const id = ++loadId.value;
        clearTimer();
        mapInstance = undefined;
        mapComplete = false;
        sdkReady.value = false;
        uiReady.value = false;
        error.value = undefined;
        loading.value = Boolean(amapKey.value);
        if (!amapKey.value) return;

        // 每次配置使用独立回调，忽略卸载后或旧地图迟到的异步结果。
        mapEvents.value = {
            init: map => {
                if (!isCurrent(id)) return;
                mapInstance = map;
                if (isOpenUi.value) {
                    const version = toValue(ui);
                    getAMapUiPromise(typeof version === 'string' && version ? version : '1.1').then(() => {
                        if (!isCurrent(id)) return;
                        uiReady.value = true;
                        finish(id);
                    }, reason => fail(reason, 'ui', id));
                }
                onInit(map);
            },
            error: reason => fail(reason, 'map', id),
            complete: () => {
                if (!isCurrent(id)) return;
                mapComplete = true;
                finish(id);
            },
        };

        timer = setTimeout(() => fail(undefined, 'timeout', id), INIT_TIMEOUT);
        try {
            initAMapApiLoader({
                key: amapKey.value,
                securityJsCode: secretKey.value,
                plugins: ['AMap.DistrictSearch', 'AMap.GeoJSON'],
            });
            // 使用依赖公开的 Promise；仅 SDK 成功后挂载 el-amap，避免在失败时创建地图。
            const promise: Promise<unknown> = lazyAMapApiLoaderInstance;
            promise.then(() => {
                if (isCurrent(id)) sdkReady.value = true;
            }, reason => fail(reason, 'sdk', id));
        } catch (reason) {
            fail(reason, 'sdk', id);
        }
    }, { immediate: true });

    onScopeDispose(() => {
        active = false;
        clearTimer();
        mapInstance = undefined;
    });

    return {
        amapKey,
        sdkReady,
        loading,
        error,
        loadId,
        mapEvents,
        canRenderLayers: computed(() => !isOpenUi.value || uiReady.value),
        setBounds: (bounds: unknown) => mapInstance?.setBounds(bounds),
    };
}
