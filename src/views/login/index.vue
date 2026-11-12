<template>
  <LoginPageLayout :style="loginBackgroundStyle">
    <template #brand>
      <img :src="systemStore.layout.logo || '/logo.png'" alt="" class="login-brand__logo" />
      <span class="login-brand__title">{{ systemStore.layout.title || 'JetLinks Cloud' }}</span>
    </template>
    <template #actions><LoginHeaderActions /></template>
    <Login />
    <template v-if="frontConfig.showRecordNumber" #record>
      <a href="https://beian.miit.gov.cn/#/Integrated/index" target="_blank" rel="noopener noreferrer" class="login-record">
        {{ t('login.index.102238-0') }}{{ frontConfig.recordNumber }}
      </a>
    </template>
  </LoginPageLayout>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import { useSystemStore } from "@jetlinks-web-core/store/system"
import { isPrivateDeployment } from '@jetlinks-web-core/utils/deployment'
import { resolvePublicAssetUrl } from '@jetlinks-web-core/utils/public-asset'
import Login from './components/Login.vue'
import LoginPageLayout from './components/LoginPageLayout.vue'
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
 * 一起发给后端，该字段恒为历史默认值 `images/login/login.png`，因此 SaaS 使用模块默认图或 core 内置图。
 */
const loginBackgroundStyle = computed((): Record<string, string> => {
  if (!isPrivateDeployment()) {
    return {}
  }

  const background = resolvePublicAssetUrl(
    frontConfig.value.background || PRIVATE_LOGIN_BACKGROUND_FALLBACK
  )

  if (!background) return {}

  // 未配置背景时优先使用业务模块声明的默认图，私有化部署仍保留历史图片兜底。
  return {
    '--login-bg-image': frontConfig.value.background
      ? toCssUrl(background)
      : `var(--jet-login-bg-image, ${toCssUrl(background)})`
  }
})

const applyLoginThemeColor = async () => {
  await systemStore.querySingleInfo('front')
}

applyLoginThemeColor()
</script>
