<!-- 分屏组件 -->
<template>
    <div class="live-player-warp">
        <div class="live-player-content">
            <!-- 工具栏 -->
            <div
                v-if="showScreen || $slots.toolbar"
                class="player-screen-tool"
                :class="{ 'player-screen-tool--toolbar-only': !showScreen }"
            >
                <a-radio-group
                    v-if="showScreen"
                    :value="screen"
                    button-style="solid"
                    @change="handleScreenChange"
                >
                    <a-radio-button :value="1">{{ $t('Player.ScreenPlayer.521467-0') }}</a-radio-button>
                    <a-radio-button :value="4">{{ $t('Player.ScreenPlayer.521467-1') }}</a-radio-button>
                    <a-radio-button :value="9">{{ $t('Player.ScreenPlayer.521467-2') }}</a-radio-button>
                    <a-radio-button :value="0">{{ $t('Player.ScreenPlayer.521467-3') }}</a-radio-button>
                </a-radio-group>
                <div class="screen-tool-save">
                    <slot name="toolbar">
                        <a-space>
                            <a-tooltip :title="$t('Player.ScreenPlayer.521467-4')">
                                <AIcon type="QuestionCircleOutlined" />
                            </a-tooltip>
                            <a-popover
                                v-model:open="visible"
                                trigger="click"
                                :title="$t('Player.ScreenPlayer.521467-5')"
                            >
                                <template #content>
                                    <a-form
                                        ref="formRef"
                                        :model="formData"
                                        layout="vertical"
                                    >
                                        <a-form-item
                                            name="name"
                                            :rules="[
                                                {
                                                    required: true,
                                                    message: $t('Player.ScreenPlayer.521467-6'),
                                                },
                                                {
                                                    max: 64,
                                                    message: $t('Player.ScreenPlayer.521467-7'),
                                                },
                                            ]"
                                        >
                                            <a-textarea
                                                v-model:value="formData.name"
                                            />
                                        </a-form-item>
                                        <a-button
                                            type="primary"
                                            @click="saveHistory"
                                            :loading="loading"
                                            style="width: 100%; margin-top: 1rem"
                                        >
                                            {{ $t('Player.ScreenPlayer.521467-8') }}
                                        </a-button>
                                    </a-form>
                                </template>
                                <a-dropdown-button
                                    type="primary"
                                    @click="visible = true"
                                >
                                    {{ $t('Player.ScreenPlayer.521467-8') }}
                                    <template #overlay>
                                        <a-menu>
                                            <CloudEmpty
                                                v-if="!historyList.length"
                                                :description="$t('Player.ScreenPlayer.521467-9')"
                                            />
                                            <a-menu-item
                                                v-for="(item, index) in historyList"
                                                :key="`his${index}`"
                                                @click="handleHistory(item)"
                                            >
                                                <a-space>
                                                    <span>{{ item.name }}</span>
                                                    <j-permission-button
                                                        type="text"
                                                        :popConfirm="{
                                                        title: $t('Player.ScreenPlayer.521467-10'),
                                                        onConfirm: (e: any) => {
                                                            e?.stopPropagation();
                                                            deleteHistory(item.key);
                                                        }
                                                    }"
                                                    >
                                                        <AIcon
                                                            type="DeleteOutlined"
                                                        />
                                                    </j-permission-button>
                                                </a-space>
                                            </a-menu-item>
                                        </a-menu>
                                    </template>
                                </a-dropdown-button>
                            </a-popover>
                        </a-space>
                    </slot>
                </div>
            </div>
            <!-- 播放器 -->
            <div class="player-body">
                <div
                    ref="fullscreenRef"
                    class="player-screen"
                    :class="`screen-${screen}`"
                >
                    <HikvisionH5Player
                        v-if="useHikvisionH5Player"
                        ref="hikvisionPlayer"
                        class="player-screen__hikvision"
                        :streams="players"
                        :screen="screen"
                        :active-index="playerActive"
                        :playback-start-time="playbackStartTime"
                        :playback-end-time="playbackEndTime"
                        :playback-rate="playbackRate"
                        autoplay
                        @window-select="handleHikvisionWindowSelect"
                    />
                    <div
                        v-if="useHikvisionH5Player && screen > 1"
                        class="player-screen__split-grid"
                        :class="`player-screen__split-grid--${screen}`"
                        aria-hidden="true"
                    >
                        <span v-for="index in screen" :key="index" />
                    </div>
                    <template v-else v-for="(item, index) in players" :key="item.key">
                        <div
                            class="player-screen-item"
                            :class="{
                                active:
                                    showScreen &&
                                    playerActive === index &&
                                    !isFullscreen,
                                'full-screen': isFullscreen,
                            }"
                            :style="{ display: item.show ? 'block' : 'none' }"
                            @click="playerActive = index"
                        >
                            <div
                                class="media-btn-refresh refreshBtn"
                                :style="{
                                    display: item.url ? 'block' : 'none',
                                }"
                                @click="handleRefresh($event, item, index)"
                            >
                                {{ $t('Player.ScreenPlayer.521467-11') }}
                            </div>
                            <LivePlayer :live="true" :protocol="item.protocol" :url="item.url" autoplay />
                        </div>
                    </template>
                </div>
            </div>
            <div v-if="$slots.footer" class="player-screen-footer">
                <slot name="footer" />
            </div>
            <!-- 控制器 -->
        </div>
        <MediaTool
            v-if="showMediaTool !== false"
            @onMouseDown="handleMouseDown"
            @onMouseUp="handleMouseUp"
        />
    </div>
</template>

<script setup lang="ts">
import { useFullscreen } from '@vueuse/core';
import {
    deleteSearchHistory,
    getSearchHistory,
    saveSearchHistory,
} from '@jetlinks-web-core/api/comm';
import LivePlayer from './index.vue';
import HikvisionH5Player from './HikvisionH5Player.vue';
import MediaTool from './mediaTool.vue';
import { onlyMessage } from '@jetlinks-web-core/utils/comm';
import { useI18n } from 'vue-i18n';
import type { MediaPlayerProtocol } from './types';
import { shouldUseHikvisionH5Player } from './legacyPlayerUtils';

const { t: $t } = useI18n();
type Player = {
    id?: string;
    url?: string;
    channelId?: string;
    protocol?: MediaPlayerProtocol;
    key: string;
    show: boolean;
};

type HikvisionPlayerInstance = {
    getCurrentTime: () => Promise<number | undefined>;
};

interface ScreenProps {
    url?: string;
    id?: string;
    channelId: string;
    className?: string;
    historyHandle?: (deviceId: string, channelId: string) => string;
    /**
     *
     * @param id 当前选中播发视频ID
     * @param type 当前操作动作
     */
    onMouseDown?: (deviceId: string, channelId: string, type: string) => void;
    /**
     *
     * @param id 当前选中播发视频ID
     * @param type 当前操作动作
     */
    onMouseUp?: (deviceId: string, channelId: string, type: string) => void;
    showScreen?: boolean;
    showMediaTool?: boolean;
    historyEnabled?: boolean;
    protocol?: MediaPlayerProtocol;
    playbackStartTime?: string;
    playbackEndTime?: string;
    playbackRate?: number;
}

const props = defineProps<ScreenProps>();

const DEFAULT_SAVE_CODE = 'screen-save';

// 分屏数量 1/4/9/0
const screen = ref(1);
// 视频窗口
const players = ref<Player[]>([]);
// 当前选中的窗口
const playerActive = ref(0);
const hikvisionPlayer = ref<HikvisionPlayerInstance>();
// 历史记录
const historyList = ref<any[]>([]);
// 展示保存浮窗
const visible = ref(false);
const loading = ref(false);
// 保存表单
const formRef = ref();
const formData = ref({
    name: '',
});

const useHikvisionH5Player = computed(() =>
    shouldUseHikvisionH5Player(props.url, props.protocol)
    || players.value.some(item => shouldUseHikvisionH5Player(item.url, item.protocol)),
);

// 全屏元素
const fullscreenRef = ref(null);
const { isFullscreen, enter, exit, toggle } = useFullscreen(fullscreenRef);

/**
 * 刷新视频
 * @param id
 * @param channelId
 * @param url
 * @param index
 */
const reloadPlayer = (
    id: string,
    channelId: string,
    url: string,
    index: number,
    protocol?: MediaPlayerProtocol,
) => {
    const olPlayers = [...players.value];
    olPlayers[index] = {
        id: '',
        channelId: '',
        protocol: undefined,
        url: '',
        key: olPlayers[index].key,
        show: true,
    };
    const newPlayer = {
        id,
        url,
        channelId,
        protocol,
        key: olPlayers[index].key,
        show: true,
    };
    players.value = [...olPlayers];
    setTimeout(() => {
        olPlayers[index] = newPlayer;
        players.value = [...olPlayers];
    }, 1000);
};

/**
 * 视频链接变化, 更新播放内容
 * @param id
 * @param channelId
 * @param url
 */
const replaceVideo = (
    id: string,
    channelId: string,
    url: string,
    protocol = props.protocol,
) => {
    const olPlayers = [...players.value];
    const newPlayer = {
        id,
        url,
        channelId,
        protocol,
        key: olPlayers[playerActive.value].key,
        show: true,
    };

    if (olPlayers[playerActive.value].url === url) {
        // 刷新视频
        reloadPlayer(id, channelId, url, playerActive.value, protocol);
    } else {
        olPlayers[playerActive.value] = newPlayer;
        players.value = olPlayers;
    }
    if (playerActive.value === screen.value - 1) {
        // 当前位置为分屏最后一位
        playerActive.value = 0;
    } else {
        playerActive.value += 1;
    }
};

const handleHikvisionWindowSelect = (index: number) => {
    if (Number.isInteger(index) && index >= 0 && index < screen.value) {
        playerActive.value = index;
    }
};

/**
 * 点击分屏历史记录
 * @param item
 */
const handleHistory = (item: any) => {
    if (props.historyHandle) {
        const log = JSON.parse(item.content || '{}');
        screen.value = log.screen;
        const oldPlayers = [...players.value];

        players.value = oldPlayers.map((oldPlayer, index) => {
            oldPlayer.show = false;
            if (index < log.screen) {
                const { deviceId, channelId } = log.players[index];
                return {
                    ...oldPlayer,
                    id: deviceId,
                    channelId,
                    url: deviceId
                        ? props.historyHandle!(deviceId, channelId)
                        : '',
                    show: true,
                };
            }
            return oldPlayer;
        });
    }
};

/**
 * 获取历史分屏
 */
const getHistory = async () => {
    const res = await getSearchHistory(DEFAULT_SAVE_CODE);
    if (res.success) {
        historyList.value = res.result;
    }
};

/**
 * 删除历史分屏
 * @param id
 */
const deleteHistory =  (id: string) => {
    const response =  deleteSearchHistory(DEFAULT_SAVE_CODE, id);
    response.then((res: { success?: boolean })=>{
        if(res.success){
            getHistory();
            visible.value = false;
        }
    })
    return response
};

/**
 * 保存分屏
 */
const saveHistory = async () => {
    formRef.value
        .validate()
        .then(async () => {
            const param = {
                name: formData.value.name,
                content: JSON.stringify({
                    screen: screen.value,
                    players: players.value.map((item: any) => ({
                        deviceId: item.id,
                        channelId: item.channelId,
                    })),
                }),
            };
            loading.value = true;
            const res = await saveSearchHistory(param, DEFAULT_SAVE_CODE);
            loading.value = false;
            if (res.success) {
                visible.value = false;
                getHistory();
                onlyMessage($t('Player.ScreenPlayer.521467-12'));
                formRef.value.resetFields();
            } else {
                onlyMessage($t('Player.ScreenPlayer.521467-13'), 'error');
            }
        })
        .catch((err: any) => {
            console.log(err);
        });
};

/**
 * 初始化
 */
const mediaInit = () => {
    const newArr = [];
    for (let i = 0; i < 9; i++) {
        newArr.push({
            id: '',
            channelId: '',
            url: '',
            key: 'time_' + new Date().getTime() + i,
            show: i === 0,
        });
    }
    players.value = newArr;
};

/**
 * 改变分屏数量
 * @param e
 */
const handleScreenChange = (e: any) => {
    if (e.target.value) {
        screenChange(e.target.value);
    } else {
        // 全屏操作
        toggle();
    }
};
const screenChange = (index: number) => {
    players.value = players.value.map((m: any, i: number) => ({
        id: '',
        channelId: '',
        url: '',
        updateTime: 0,
        key: m.key,
        show: i < index,
    }));
    playerActive.value = 0;
    screen.value = index;

    // if (screen.value === 4) {
    //     screenWidth.value = '21.875rem';
    //     screenHeight.value = '125rem';
    // }
};

/**
 * 刷新
 * @param e
 * @param item
 * @param index
 */
const handleRefresh = (e: any, item: any, index: number) => {
    e.stopPropagation();
    if (item.url) {
        reloadPlayer(item.id!, item.channelId!, item.url!, index);
    }
};

/**
 * 点击控制按钮
 * @param type 控制类型
 */
const handleMouseDown = (type: string) => {
    const { id, channelId } = players.value[playerActive.value];
    if (id && channelId && props.onMouseDown) {
        props.onMouseDown(id, channelId, type);
    }
};
const handleMouseUp = (type: string) => {
    const { id, channelId } = players.value[playerActive.value];
    if (id && channelId && props.onMouseUp) {
        props.onMouseUp(id, channelId, type);
    }
};

watch(
    () => props.url,
    (url) => {
        if (url && props.id) {
            replaceVideo(props.id, props.channelId, url, props.protocol);
        }
    },
);

watchEffect(() => {
    if (props.showScreen !== false && props.historyEnabled !== false) {
        getHistory();
    }
    mediaInit();
});

const getCurrentTime = () => hikvisionPlayer.value?.getCurrentTime();

defineExpose({
    replaceVideo,
    getCurrentTime,
});
</script>

<style scoped>
.live-player-warp {
  display: flex;
  height: 100%;
}
.live-player-warp .live-player-content {
  display: flex;
  flex: 1;
  flex-direction: column;
}
.live-player-warp .live-player-content .player-screen-tool {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}
.live-player-warp .live-player-content .player-screen-tool .ant-radio-button-wrapper {
  height: auto;
  padding: 0.25rem 1.25rem;
}
.live-player-warp .live-player-content .player-screen-tool--toolbar-only .screen-tool-save {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
}
.live-player-warp .live-player-content .player-screen-tool--toolbar-only {
  height: 4rem;
  margin-bottom: 0;
}
.live-player-warp .live-player-content .player-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.live-player-warp .live-player-content .player-screen-footer {
  flex: none;
}
.live-player-warp .live-player-content .player-body .player-screen {
  position: relative;
  display: grid;
  box-sizing: border-box;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #000;
}
.live-player-warp .live-player-content .player-body .player-screen:fullscreen {
  height: 100%;
  aspect-ratio: auto;
}
.live-player-warp .live-player-content .player-body .player-screen.screen-1 {
  grid-template-columns: 1fr;
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
}
.live-player-warp .live-player-content .player-body .player-screen.screen-1 .player-screen-item:not(:first-of-type) {
  display: none !important;
}
.live-player-warp .live-player-content .player-body .player-screen.screen-4 {
  grid-template-rows: 1fr 1fr;
  grid-template-columns: 1fr 1fr;
}
.live-player-warp .live-player-content .player-body .player-screen.screen-9 {
  grid-template-rows: 1fr 1fr 1fr;
  grid-template-columns: 1fr 1fr 1fr;
}
.live-player-warp .live-player-content .player-body .player-screen.screen-4,
.live-player-warp .live-player-content .player-body .player-screen.screen-9 {
  grid-gap: 0.75rem;
}
.live-player-warp .live-player-content .player-body .player-screen .active {
  position: relative;
}
.live-player-warp .live-player-content .player-body .player-screen .active::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  z-index: 99;
  border: 0.125rem solid red;
  pointer-events: none;
}
.live-player-warp .live-player-content .player-body .player-screen .full-screen {
  border: 1px solid var(--bg);
}
.live-player-warp .live-player-content .player-body .player-screen .player-screen-item {
  position: relative;
}
.live-player-warp .live-player-content .player-body .player-screen .player-screen__hikvision {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  width: 100%;
  height: 100%;
}
.live-player-warp .live-player-content .player-body .player-screen .player-screen__split-grid {
  display: grid;
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  z-index: 2;
  gap: 0.125rem;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.16);
}
.live-player-warp .live-player-content .player-body .player-screen .player-screen__split-grid > span {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.22);
}
.live-player-warp .live-player-content .player-body .player-screen .player-screen__split-grid--4 {
  grid-template: repeat(2, minmax(0, 1fr)) / repeat(2, minmax(0, 1fr));
}
.live-player-warp .live-player-content .player-body .player-screen .player-screen__split-grid--9 {
  grid-template: repeat(3, minmax(0, 1fr)) / repeat(3, minmax(0, 1fr));
}
.live-player-warp .live-player-content .player-body .player-screen .player-screen-item .media-btn-refresh {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  z-index: 2;
  padding: 0.125rem 0.25rem;
  font-size: var(--fs-12);
  background-color: var(--line-strong);
  border-radius: 0.125rem;
  cursor: pointer;
}
.live-player-warp .live-player-content .player-body .player-screen .player-screen-item .media-btn-refresh:hover {
  background-color: var(--line);
}
.live-player-warp .live-player-content .player-body .player-screen .player-screen-item .media-btn-refresh:active {
  background-color: var(--ink-4);
}
:deep(.live-player-stretch-btn) {
  display: none;
}
:deep(.vjs-icon-spinner) {
  display: none;
}
.refreshBtn {
  opacity: 0;
}
.refreshBtn:hover {
  opacity: 1;
}</style>
