<template>
  <div
    class="login-container"
    :style="loginBackgroundStyle"
  >
    <section class="login-side">
      <header class="login-brand">
        <img :src="systemStore.layout.logo || '/logo.png'" alt="" class="login-brand__logo" />
        <span class="login-brand__title">{{ systemStore.layout.title || 'JetLinks Cloud' }}</span>
      </header>

      <div class="login-page-actions">
        <LoginHeaderActions />
      </div>

      <main class="login-content">
        <Login />
      </main>

      <a
        v-if="frontConfig.showRecordNumber"
        href="https://beian.miit.gov.cn/#/Integrated/index"
        target="_blank"
        rel="noopener noreferrer"
        class="login-record"
      >
        {{ t('login.index.102238-0') }}{{ frontConfig.recordNumber }}
      </a>
    </section>

    <div class="login-scene" aria-hidden="true"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import { useSystemStore } from '@jetlinks-web-core/store'
import { isPrivateDeployment } from '@jetlinks-web-core/utils/deployment'
import { resolvePublicAssetUrl } from '@jetlinks-web-core/utils/public-asset'
import Login from './components/Login.vue'
import LoginHeaderActions from './components/LoginHeaderActions.vue'

/** 历史登录页在未配置背景图时使用的默认图，私有化部署沿用，避免升级后背景突变。 */
const PRIVATE_LOGIN_BACKGROUND_FALLBACK = 'images/login/login.png'

const t = i18n.global.t
const systemStore = useSystemStore()

/** 基础配置里的 front 信息，备案号由 showRecordNumber/recordNumber 控制展示。 */
const frontConfig = computed<Record<string, any>>(() => systemStore.systemInfo?.front || {})

const toCssUrl = (url: string) => `url("${url.replace(/["\\\r\n]/g, '')}")`

/**
 * 自定义登录背景图只在私有化部署生效。
 *
 * SaaS 模块隐藏了基础配置里的 `background` 字段，但 `useBasisForm` 的提交会把整个表单模型
 * 一起发给后端，该字段恒为历史默认值 `images/login/login.png`，因此 SaaS 必须继续用内置设计图。
 */
const loginBackgroundStyle = computed((): Record<string, string> => {
  if (!isPrivateDeployment()) {
    return {}
  }

  const background = resolvePublicAssetUrl(
    frontConfig.value.background || PRIVATE_LOGIN_BACKGROUND_FALLBACK
  )

  return background ? { '--login-bg-image': toCssUrl(background) } : {}
})

const applyLoginThemeColor = async () => {
  await systemStore.querySingleInfo('front')
}

applyLoginThemeColor()
</script>

<style lang="less">
.login-container {
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-text-fill-color: var(--jet-theme-text) !important;
    transition: background-color 5000s ease-in-out 0s;
  }

  * {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }

  button,
  a,
  .ant-btn {
    touch-action: manipulation;
  }

  .modern-input,
  .modern-input.ant-input-affix-wrapper,
  .submit-button.ant-btn {
    font-size: var(--fs-16) !important;
  }

  .modern-input .ant-input {
    font-size: var(--fs-16) !important;
  }

  .modern-input,
  .modern-input.ant-input-affix-wrapper {
    height: 3rem !important;
    min-height: 3rem !important;
  }

  .submit-button.ant-btn {
    height: 2.75rem !important;
    min-height: 2.75rem !important;
    border: 0;
    border-radius: var(--r-2);
    background: linear-gradient(90deg, var(--jet-theme-primary-hover), var(--jet-theme-primary));
    box-shadow: none;
  }
}
</style>

<style scoped lang="less">
.login-container {
  /* 私有化部署可在基础配置里自定义登录背景图，--login-bg-image 由行内样式覆盖。 */
  --login-bg-image: url('@jetlinks-web-core/assets/login/login-bg.png');

  position: relative;
  display: grid;
  grid-template-columns: minmax(28.5rem, 38.9%) minmax(0, 1fr);
  width: 100vw;
  min-height: 100vh;
  overflow: hidden;
  background: var(--login-bg-image) no-repeat center center;
  background-size: cover;
  color: var(--jet-theme-text);
}

.login-page-actions {
  position: absolute;
  z-index: 2;
  top: var(--space-5);
  right: var(--space-5);
}

.login-side {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 100vh;
  overflow-y: auto;
  background: color-mix(in srgb, var(--jet-theme-bg-container) 50%, transparent);
  backdrop-filter: blur(0.125rem);
}

.login-brand {
  position: absolute;
  top: var(--space-5);
  left: var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  max-width: calc(100% - 2 * var(--space-5));

  &__logo {
    width: 2.0625rem;
    height: 2.125rem;
    flex: none;
    object-fit: contain;
  }

  &__title {
    min-width: 0;
    overflow: hidden;
    color: var(--jet-theme-text-title);
    font-size: var(--fs-20);
    font-weight: 700;
    line-height: 1.75rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.login-content {
  display: flex;
  flex: 1;
  justify-content: center;
  width: min(71.43%, 25rem);
  min-width: 20rem;
  min-height: auto;
  margin: 0 auto;
  padding: clamp(7.5rem, 20.5vh, 14rem) 0 var(--space-10);
}

.login-scene {
  min-width: 0;
  min-height: 100vh;
}

/* 备案号走正常流，跟随 .login-side 的 flex 列排在表单之后，不会与表单重叠。 */
.login-record {
  flex: none;
  margin: 0 auto var(--space-4);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  text-align: center;
  text-decoration: none;

  &:hover {
    color: var(--jet-theme-primary);
  }
}

@media (min-width: 120rem) {
  .login-content {
    width: min(71.43%, 25rem);
  }
}

@media (max-width: 62rem) {
  .login-container {
    grid-template-columns: minmax(24rem, 46%) minmax(0, 1fr);
  }

  .login-content {
    width: calc(100% - 4rem);
  }
}

@media (max-width: 48rem) {
  .login-container {
    display: block;
    min-height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
    background:
      linear-gradient(
        color-mix(in srgb, var(--jet-theme-bg-container) 88%, transparent),
        color-mix(in srgb, var(--jet-theme-bg-container) 95%, transparent)
      ),
      var(--login-bg-image) no-repeat 62% center;
    background-size: cover;
  }

  .login-side {
    min-height: 100dvh;
    background: color-mix(in srgb, var(--jet-theme-bg-container) 78%, transparent);
    backdrop-filter: blur(0.125rem);
  }

  .login-brand {
    top: var(--space-4);
    left: var(--space-4);
    max-width: calc(100% - 2 * var(--space-4));
  }

  .login-page-actions {
    top: var(--space-4);
    right: var(--space-4);
  }

  .login-content {
    align-items: center;
    width: 100%;
    min-width: 0;
    /* 高度交给 .login-side 的 flex 列分配，避免 min-height:100dvh 把备案号挤出首屏。 */
    padding: 5.5rem var(--space-5) var(--space-8);
  }

  .login-record {
    margin-bottom: var(--space-3);
  }

  .login-scene {
    display: none;
  }
}

@media (max-height: 43.75rem) and (min-width: 48.01rem) {
  .login-content {
    padding-top: 6.5rem;
  }
}
</style>
