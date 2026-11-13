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
import { resolveLoginBackground } from '@jetlinks-web-core/utils/login-background'
import Login from './components/Login.vue'
import LoginPageLayout from './components/LoginPageLayout.vue'
import LoginHeaderActions from './components/LoginHeaderActions.vue'

const t = i18n.global.t
const systemStore = useSystemStore()

/** 基础配置里的 front 信息，备案号由 showRecordNumber/recordNumber 控制展示。 */
const frontConfig = computed<Record<string, any>>(() => systemStore.systemInfo?.front || {})

const loginBackgroundStyle = computed(() => resolveLoginBackground(frontConfig.value.background).style)

const applyLoginThemeColor = async () => {
  await systemStore.querySingleInfo('front')
}

applyLoginThemeColor()
</script>
