<template>
    <div
        class="amap-container"
        :style="props.style || { width: '100%', height: '100%' }"
        :class="props.class"
        :aria-busy="loading"
    >
        <div v-if="sdkReady" class="amap-canvas" :aria-hidden="Boolean(error)" :inert="Boolean(error)">
            <el-amap :key="loadId" :zooms="[3, 20]" v-on="mapEvents">
                <slot v-if="canRenderLayers"></slot>
            </el-amap>
        </div>
        <div v-if="error" class="amap-status" role="alert">
            <Result class="amap-error" status="error" :title="errorTitle">
                <template #icon>
                    <span class="amap-error-icon"><ExclamationCircleOutlined /></span>
                </template>
                <template #subTitle>
                    <div v-if="error.code" class="amap-error-detail">
                        {{ $t('AMapComponent.AMap.errorCode', { code: error.code }) }}
                    </div>
                    <div v-if="error.info" class="amap-error-detail">info：{{ error.info }}</div>
                    <div v-if="error.message && error.message !== error.info" class="amap-error-detail">
                        {{ error.message }}
                    </div>
                    <div v-if="error.kind === 'timeout'" class="amap-error-detail">
                        {{ $t('AMapComponent.AMap.timeoutDescription') }}
                    </div>
                    <div v-else-if="!error.code && !error.info && !error.message" class="amap-error-detail">
                        {{ $t('AMapComponent.AMap.unknownError') }}
                    </div>
                    <div>{{ $t('AMapComponent.AMap.errorGuide') }}</div>
                </template>
            </Result>
        </div>
        <div v-else-if="loading" class="amap-status amap-loading" role="status">
            <Spin />
            <span>{{ $t('AMapComponent.AMap.loading') }}</span>
        </div>
        <CloudEmpty v-else-if="!amapKey" :description="$t('AMapComponent.AMap.059194-0')" style="padding: 20%" />
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { CSSProperties, PropType } from 'vue';
import { Result, Spin, theme } from 'ant-design-vue';
import { ExclamationCircleOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import '@vuemap/vue-amap/dist/style.css';
import { useAMapLifecycle } from './useAMapLifecycle';

const emit = defineEmits(['init']);
const props = defineProps({
    style: Object as PropType<CSSProperties>,
    class: String,
    // 轨迹等既有调用方依赖默认加载 AMapUI；显式 false 时才跳过。
    AMapUI: { type: [String, Boolean], default: true },
    center: Array,
});

const { token } = theme.useToken();
const { t } = useI18n();
const {
    amapKey, sdkReady, loading, error, loadId, mapEvents, canRenderLayers, setBounds,
} = useAMapLifecycle(() => props.AMapUI, map => emit('init', map));
const errorTitle = computed(() => t(error.value?.kind === 'timeout'
    ? 'AMapComponent.AMap.timeoutTitle'
    : error.value?.kind === 'ui' ? 'AMapComponent.AMap.uiErrorTitle' : 'AMapComponent.AMap.errorTitle'));

defineExpose({ setBounds });
</script>

<style scoped>
.amap-container {
    position: relative;
    min-width: 0;
}
.amap-canvas {
    position: relative;
    z-index: 0;
    width: 100%;
    height: 100%;
}
.amap-status {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: v-bind('token.colorBgLayout');
}
.amap-error {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-height: 100%;
    overflow: auto;
    padding: v-bind('token.paddingLG + "px"') v-bind('token.paddingMD + "px"');
    overflow-wrap: anywhere;
}
.amap-error-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: v-bind('token.colorError');
    background: v-bind('token.colorErrorBg');
    font-size: 24px;
}
.amap-error :deep(.ant-result-icon) {
    margin-bottom: v-bind('token.marginSM + "px"');
}
.amap-error :deep(.ant-result-title) {
    font-size: v-bind('token.fontSizeLG + "px"');
    font-weight: 500;
}
.amap-error :deep(.ant-result-subtitle) {
    margin-top: v-bind('token.marginXS + "px"');
    font-size: v-bind('token.fontSizeSM + "px"');
}
.amap-error-detail {
    margin-bottom: 6px;
    white-space: pre-wrap;
}
.amap-loading {
    flex-direction: column;
    gap: v-bind('token.marginXS + "px"');
    color: v-bind('token.colorTextSecondary');
}
</style>
