<!-- 视频播放 -->
<template>
  <div class="media-player-container">
    <div ref="playerElement" v-if="protocol !== 'rtc'">
      <span v-if="!props.url"> No Video </span>
    </div>
    <canvas
      v-if="protocol !== 'rtc'"
      ref="snapshotCanvas"
      class="snapshot-overlay"
    />
    <div v-else ref="playerContentElement" class="rtc-video-content">
      <video ref="playerElement" :style="playerStyles" />
      <div class="rtc-tool">
        <div class="left">
          <AIcon
            :type="
              rtcData.playStatus === 'play'
                ? 'PauseOutlined'
                : 'CaretRightOutlined'
            "
            @click="playToggle"
          />
        </div>
        <div class="right">
          <a-space>
            <AIcon
              @click="toggle"
              :type="isFullscreen ? 'CompressOutlined' : 'ExpandOutlined'"
            />
          </a-space>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="LivePlayer">
import { ref, reactive } from "vue";
import Player, { Events } from "xgplayer";
import { settingEnum } from "./utils";
import { useFullscreen } from "@vueuse/core";
import { useI18n } from "vue-i18n";

const { t: $t } = useI18n();
type PlayerProps = {
  url?: string;
  live?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  poster?: string;
  timeout?: number;
  className?: string;
  updateTime?: number;
  key?: string | number;
  loading?: boolean;
  protocol?: "mp4" | "flv" | "m3u8" | "rtc";
  onDestroy?: (e?: any) => void;
  onMessage?: (msg: any) => void;
  onError?: (err: any) => void;
  onTimeUpdate?: (time: any) => void;
  onPause?: (e?: any) => void;
  onPlay?: (e?: any) => void;
  onFullscreen?: () => void;
  onSnapOutside?: (base64: any) => void;
  onSnapInside?: (base64: any) => void;
  onCustomButtons?: (name: any) => void;
  onEnded?: (e?: any) => void;
  onClick?: () => void;
  onCanPlay?: () => void;
};

const props = defineProps<PlayerProps>();
const isHevcSupport = ref<boolean>(true);

const playerElement = ref<HTMLVideoElement>();
const playerContentElement = ref<HTMLVideoElement>();
const snapshotCanvas = ref<HTMLCanvasElement>();
const playerStyles = ref({});
const rtcData = reactive({
  playStatus: "pause",
});

const { toggle, isFullscreen } = useFullscreen(playerContentElement);

let player: any = null;
let isRecovering = false;
let recoveryCount = 0;
let stabilityTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_RECOVERY = 3;

/**
 * 播放
 */
const play = () => {
  player?.play();
};

/**
 * 暂停
 */
const pause = () => {
  player?.pause();
};

/**
 * 暂停状态
 */
const paused = () => {
  return player?.paused;
};

const destroy = () => {
  if (player) {
    player.destroy?.();
    player = null;
  }
};

/**
 * 将当前视频帧截取到 canvas 上（用于错误恢复时保持画面）
 */
const captureSnapshot = () => {
  const canvas = snapshotCanvas.value;
  if (!canvas) return;
  const video = player?.video || playerElement.value?.querySelector?.("video");
  if (!video || !video.videoWidth || !video.videoHeight) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } catch {
    // 跨域或其他问题时忽略
  }
};

const showSnapshot = () => {
  const canvas = snapshotCanvas.value;
  if (canvas) canvas.style.display = "block";
  if (playerElement.value) playerElement.value.style.visibility = "hidden";
};

const hideSnapshot = () => {
  const canvas = snapshotCanvas.value;
  if (canvas) canvas.style.display = "none";
  if (playerElement.value) playerElement.value.style.visibility = "";
};

const initEvent = () => {
  const fn = player.on ? "on" : "addEventListener";

  player[fn](Events.PLAY, (ev) => {
    props.onPlay?.();
    rtcData.playStatus = Events.PLAY;
  });
  player[fn](Events.PAUSE, (ev) => {
    props.onPause?.();
    rtcData.playStatus = Events.PAUSE;
  });
  player[fn](Events.ENDED, (ev) => {
    props.onEnded?.();
  });
  player[fn](Events.TIME_UPDATE, (ev) => {
    props.onTimeUpdate?.(ev);
    if (props.live) {
      captureSnapshot();
    }
  });
  player[fn](Events.CANPLAY, (ev) => {
    console.log($t("Player.index.345076-0"), ev);
    props.onCanPlay?.();
    if (isRecovering) {
      isRecovering = false;
      hideSnapshot();
    }
    if (stabilityTimer) clearTimeout(stabilityTimer);
    stabilityTimer = setTimeout(() => {
      recoveryCount = 0;
    }, 10000);
    if (props.autoplay !== false) {
      play();
    }
  });
  player[fn](Events.SEEKED, (ev) => {
    if (props.live) {
      init();
    }
  });

  player[fn](Events.ERROR, (ev) => {
    console.warn("[Player] stream error (suppressed):", ev);
    isHevcSupport.value = Player.isHevcSupported();
    if (!isHevcSupport.value) {
      playerElement.value.querySelector(".xgplayer-error-text").innerHTML = $t(
        "Player.index.345076-1",
      );
      playerElement.value.querySelector(".xgplayer-error-tips").innerHTML = "";
      props.onError?.(ev);
      return;
    }

    if (props.live) {
      if (isRecovering) return;
      if (recoveryCount >= MAX_RECOVERY) {
        captureSnapshot();
        showSnapshot();
        props.onError?.(ev);
        return;
      }
      captureSnapshot();
      showSnapshot();
      isRecovering = true;
      recoveryCount++;
      setTimeout(() => {
        init();
      }, 2000);
    } else {
      props.onError?.(ev);
    }
  });
};

const init = () => {
  if (props.protocol === "rtc") {
    playerElement.value.srcObject = props.url;
    player = playerElement.value;

    initEvent();
  } else {
    destroy();
    setTimeout(() => {
      player = new Player({
        el: playerElement.value,
        // autoplay: props.autoplay ?? true,
        url: props.url,
        poster: props.poster,
        isLive: props.live,
        width: "100%",
        height: "100%",
        hasStart: false,
        playbackRate: false,
        ignores: ["progress", "volume", "time", "replay", "cssfullscreen", ...(props.live ? ["error"] : [])],
        closeVideoClick: true,
        closeVideoDblclick: true,
        closeVideoTouch: true,
        closePlayerBlur: true,
        closeControlsBlur: true,
        closeFocusVideoFocus: true,
        closePlayVideoFocus: true,
        ...settingEnum[props.protocol || "mp4"],
      });

      initEvent();
    }, 30);
  }
};

const playToggle = () => {
  if (player) {
    if (rtcData.playStatus === Events.PAUSE) {
      play()
    } else {
      pause()
    }
  }
}

watch(
  () => props.url,
  () => {
    if (props.url) {
      nextTick(() => {
        init();
      });
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  destroy();
});

defineExpose({
  play,
  pause,
  paused,
});
</script>
<style scoped>
:deep(.live-player-stretch-btn) {
  display: none;
}
:deep(.vjs-icon-spinner) {
  display: none;
}
.media-player-container {
  width: 100%;
  height: 100%;
  background-color: var(--ink-1);
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--accent-ink);
  position: relative;
}

.snapshot-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  display: none;
  object-fit: contain;
  pointer-events: none;
}


.rtc-video-content,
.rtc-video-content video {
  height: 100%;
  width: 100%;
}

.rtc-video-content {
  position: relative;
}

.rtc-video-content video::-webkit-media-controls-enclosure {
  display: none;
}

.rtc-tool {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background-image: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--ink-1) 37%, transparent),
    var(--ink-2),
    var(--ink-2)
  );
  transition:
    opacity 0.5s ease,
    visibility 0.5s ease;
  height: 3rem;
  font-size: var(--fs-20);
  padding: 0.25rem 0.75rem 0;
  align-items: center;

}

.rtc-tool .right {
  margin-left: auto;
}</style>
